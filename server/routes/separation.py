"""
Audio separation routes
Handles file upload, URL download, and Demucs processing
"""

import os
import uuid
import aiohttp
import asyncio
from typing import Optional
from urllib.parse import urlparse
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from pydantic import BaseModel

from services.demucs_service import DemucsService, JobStatus
from services.soundcloud_service import SoundCloudService, SoundCloudError

router = APIRouter()
demucs_service = DemucsService()
soundcloud_service = SoundCloudService()


class SeparationResponse(BaseModel):
    job_id: str
    status: str
    message: str


class UrlRequest(BaseModel):
    url: str


class StatusResponse(BaseModel):
    job_id: str
    status: str
    progress: Optional[float] = None
    stems: Optional[dict] = None
    error: Optional[str] = None


async def download_audio_from_url(url: str, output_path: str) -> bool:
    """Download audio from a URL to a local file."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=300)) as response:
                if response.status != 200:
                    return False
                
                with open(output_path, 'wb') as f:
                    while True:
                        chunk = await response.content.read(8192)
                        if not chunk:
                            break
                        f.write(chunk)
        return True
    except Exception as e:
        print(f"Download error: {e}")
        return False


@router.post("/separate", response_model=SeparationResponse)
async def separate_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Upload an audio file for stem separation.
    Returns a job_id to poll for status.
    """
    # Validate file type by MIME type or file extension
    allowed_types = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav", "audio/flac", "audio/m4a", "audio/x-m4a", "audio/mp4", "application/octet-stream"]
    allowed_extensions = [".mp3", ".wav", ".flac", ".m4a", ".mp4", ".aac"]
    
    file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    
    # Allow if MIME type matches OR if extension matches (for octet-stream fallback)
    if file.content_type not in allowed_types and file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Allowed audio formats: MP3, WAV, FLAC, M4A"
        )
    
    # If content type is octet-stream, verify the extension is allowed
    if file.content_type == "application/octet-stream" and file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file extension: {file_ext}. Allowed: {allowed_extensions}"
        )
    
    # Generate job ID
    job_id = str(uuid.uuid4())
    
    # Save uploaded file
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    
    # Use the extension we already extracted, default to .mp3
    if not file_ext:
        file_ext = ".mp3"
    input_path = os.path.join(upload_dir, f"{job_id}{file_ext}")
    
    try:
        contents = await file.read()
        with open(input_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Start separation in background
    background_tasks.add_task(demucs_service.separate, job_id, input_path)
    
    return SeparationResponse(
        job_id=job_id,
        status="processing",
        message="Audio separation started. Poll /api/status/{job_id} for progress."
    )


def _is_soundcloud_url(parsed) -> bool:
    host = (parsed.netloc or "").lower()
    return "soundcloud.com" in host


@router.post("/separate-url", response_model=SeparationResponse)
async def separate_from_url(
    background_tasks: BackgroundTasks,
    request: UrlRequest,
):
    """
    Download audio from URL and process for stem separation.
    Supports direct audio URLs and SoundCloud track URLs (requires app credentials).
    """
    url = request.url.strip()

    # Validate URL
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            raise ValueError("Invalid URL scheme")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL")

    # Generate job ID
    job_id = str(uuid.uuid4())

    # SoundCloud track URLs: resolve and download via API
    if _is_soundcloud_url(parsed):
        if not soundcloud_service.is_configured():
            raise HTTPException(
                status_code=503,
                detail="SoundCloud is not configured. Set SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET."
            )
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        input_path = os.path.join(upload_dir, f"{job_id}.mp3")
        demucs_service.jobs[job_id] = JobStatus(status="downloading", progress=0.05)
        try:
            await soundcloud_service.resolve_and_download(url, input_path)
        except SoundCloudError as e:
            demucs_service.jobs[job_id] = JobStatus(status="failed", error=e.message)
            status = e.status_code or 400
            if "not configured" in e.message.lower():
                status = 503
            raise HTTPException(status_code=status, detail=e.message)
        if not os.path.exists(input_path) or os.path.getsize(input_path) == 0:
            demucs_service.jobs[job_id] = JobStatus(
                status="failed",
                error="Failed to download SoundCloud stream."
            )
            raise HTTPException(
                status_code=400,
                detail="Failed to download SoundCloud audio."
            )
        background_tasks.add_task(demucs_service.separate, job_id, input_path)
        return SeparationResponse(
            job_id=job_id,
            status="processing",
            message="Audio downloaded. Separation started. Poll /api/status/{job_id} for progress."
        )

    # Direct audio URL: download as before
    path = parsed.path.lower()
    if path.endswith('.wav'):
        file_ext = '.wav'
    elif path.endswith('.flac'):
        file_ext = '.flac'
    elif path.endswith('.ogg'):
        file_ext = '.ogg'
    else:
        file_ext = '.mp3'

    upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    input_path = os.path.join(upload_dir, f"{job_id}{file_ext}")

    demucs_service.jobs[job_id] = JobStatus(status="downloading", progress=0.05)

    success = await download_audio_from_url(url, input_path)

    if not success or not os.path.exists(input_path) or os.path.getsize(input_path) == 0:
        demucs_service.jobs[job_id] = JobStatus(
            status="failed",
            error="Failed to download audio from URL. Make sure it's a direct audio link."
        )
        raise HTTPException(
            status_code=400,
            detail="Failed to download audio. Please provide a direct link to an audio file (MP3, WAV, FLAC)."
        )

    background_tasks.add_task(demucs_service.separate, job_id, input_path)

    return SeparationResponse(
        job_id=job_id,
        status="processing",
        message="Audio downloaded. Separation started. Poll /api/status/{job_id} for progress."
    )


@router.get("/status/{job_id}", response_model=StatusResponse)
async def get_status(job_id: str):
    """
    Get the status of a separation job.
    Returns stem URLs when complete.
    """
    job = demucs_service.get_job_status(job_id)
    
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    
    response = StatusResponse(
        job_id=job_id,
        status=job.status,
        progress=job.progress,
        error=job.error
    )
    
    if job.status == "completed" and job.stems:
        # Return URLs for each stem
        response.stems = {
            stem: f"/stems/{job_id}/{stem}.wav"
            for stem in job.stems
        }
    
    return response


@router.delete("/job/{job_id}")
async def cancel_job(job_id: str):
    """
    Cancel a running job and clean up files.
    """
    success = demucs_service.cancel_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    
    return {"message": f"Job {job_id} cancelled"}
