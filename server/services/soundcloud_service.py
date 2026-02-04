"""
SoundCloud API service
Uses Client Credentials flow for app-only auth (resolve + stream public tracks).
"""

import os
import time
import base64
from typing import Optional
from urllib.parse import quote

import aiohttp

TOKEN_URL = "https://secure.soundcloud.com/oauth/token"
API_BASE = "https://api.soundcloud.com"
RESOLVE_PATH = "/resolve"
# Buffer before expiry (seconds) to refresh token early
TOKEN_REFRESH_BUFFER = 300


class SoundCloudError(Exception):
    """Raised when SoundCloud API returns an error or track is not playable."""
    def __init__(self, message: str, status_code: Optional[int] = None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class SoundCloudService:
    """
    Resolves SoundCloud track URLs and downloads stream audio using
    Client Credentials (app token). Caches token to respect rate limits.
    """

    def __init__(self):
        self._client_id = os.getenv("SOUNDCLOUD_CLIENT_ID", "").strip()
        self._client_secret = os.getenv("SOUNDCLOUD_CLIENT_SECRET", "").strip()
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0

    def is_configured(self) -> bool:
        return bool(self._client_id and self._client_secret)

    async def _get_token(self) -> str:
        """Get a valid access token, refreshing from cache if needed."""
        if self._access_token and time.monotonic() < self._token_expires_at - TOKEN_REFRESH_BUFFER:
            return self._access_token
        if not self.is_configured():
            raise SoundCloudError(
                "SoundCloud credentials not configured. Set SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET."
            )
        basic = base64.b64encode(
            f"{self._client_id}:{self._client_secret}".encode()
        ).decode()
        async with aiohttp.ClientSession() as session:
            async with session.post(
                TOKEN_URL,
                headers={
                    "Authorization": f"Basic {basic}",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json; charset=utf-8",
                },
                data={"grant_type": "client_credentials"},
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise SoundCloudError(
                        f"Failed to get SoundCloud token: {resp.status} {text}",
                        status_code=resp.status,
                    )
                data = await resp.json()
        self._access_token = data.get("access_token")
        expires_in = int(data.get("expires_in", 3600))
        self._token_expires_at = time.monotonic() + expires_in
        if not self._access_token:
            raise SoundCloudError("SoundCloud token response missing access_token")
        return self._access_token

    async def resolve_and_download(self, soundcloud_url: str, output_path: str) -> None:
        """
        Resolve a SoundCloud track URL to a track, ensure it's playable,
        then download the stream to output_path.
        Raises SoundCloudError on missing credentials, non-track, or non-playable.
        """
        token = await self._get_token()
        headers = {
            "Accept": "application/json; charset=utf-8",
            "Authorization": f"OAuth {token}",
        }

        resolve_url = f"{API_BASE}{RESOLVE_PATH}?url={quote(soundcloud_url, safe='')}"
        async with aiohttp.ClientSession() as session:
            async with session.get(
                resolve_url,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status == 401:
                    self._access_token = None
                    raise SoundCloudError("SoundCloud authentication failed. Check your credentials.", 401)
                if resp.status == 404:
                    raise SoundCloudError("SoundCloud URL not found.", 404)
                if resp.status == 403:
                    raise SoundCloudError("Access to this SoundCloud resource is forbidden.", 403)
                if resp.status != 200:
                    text = await resp.text()
                    raise SoundCloudError(
                        f"SoundCloud resolve failed: {resp.status} {text}",
                        status_code=resp.status,
                    )
                resource = await resp.json()

        kind = resource.get("kind")
        if kind != "track":
            raise SoundCloudError(
                "Only single track URLs are supported. Playlists and user pages are not supported."
            )

        access = resource.get("access", "")
        if access != "playable":
            if access == "blocked":
                raise SoundCloudError(
                    "This track is not available for streaming (e.g. restricted or paywalled)."
                )
            if access == "preview":
                raise SoundCloudError(
                    "Only full playable tracks are supported. This track has preview-only access."
                )
            raise SoundCloudError(f"This track is not streamable (access: {access}).")

        stream_url = resource.get("stream_url")
        if not stream_url:
            track_id = resource.get("id")
            if track_id is not None:
                streams_url = f"{API_BASE}/tracks/{track_id}/streams"
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        streams_url,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=15),
                    ) as streams_resp:
                        if streams_resp.status == 200:
                            streams_data = await streams_resp.json()
                            if isinstance(streams_data, dict):
                                stream_url = (
                                    streams_data.get("http_mp3_128_url")
                                    or streams_data.get("hls_mp3_128_url")
                                    or streams_data.get("preview_mp3_128_url")
                                )
            if not stream_url:
                raise SoundCloudError("No stream URL available for this track.")

        async with aiohttp.ClientSession() as session:
            async with session.get(
                stream_url,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=300),
            ) as stream_resp:
                if stream_resp.status == 401:
                    self._access_token = None
                    raise SoundCloudError("SoundCloud stream authentication failed.", 401)
                if stream_resp.status != 200:
                    raise SoundCloudError(
                        f"Failed to download stream: {stream_resp.status}",
                        status_code=stream_resp.status,
                    )
                with open(output_path, "wb") as f:
                    async for chunk in stream_resp.content.iter_chunked(8192):
                        f.write(chunk)
