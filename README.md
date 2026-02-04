# Music Visualizer

A web-based music visualizer that separates audio into stems (drums, bass, vocals, other) and visualizes each with distinct colors positioned in stereo space.

## Features

- **Stem Separation**: Uses Demucs (htdemucs_ft model) for high-quality audio source separation
- **Multiple Input Sources**:
  - File upload (drag & drop or file picker)
  - SoundCloud URL streaming
  - Microphone capture (for visualizing Spotify or other system audio)
- **Dual Visualization Modes**:
  - Radial/Circular Spectrum
  - 3D Particle Cloud
- **Stereo Positioning**: Visual elements positioned based on stereo pan location

## Project Structure

```
js-css-visualizer/
├── client/                 # React frontend (Vite + Styled Components)
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── context/        # React context providers
│   │   └── styles/         # Global styles and theme
│   └── package.json
├── server/                 # Python backend (FastAPI)
│   ├── services/           # Business logic
│   ├── routes/             # API endpoints
│   ├── main.py             # FastAPI app entry
│   └── requirements.txt
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- FFmpeg (required by Demucs)

### Backend Setup

```bash
cd server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd client
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173` and will proxy API requests to the backend at `http://localhost:8000`.

### SoundCloud

The SoundCloud tab lets you paste a track URL and run stem separation. To enable it:

1. Register an app at [soundcloud.com/you/apps](https://soundcloud.com/you/apps).
2. Create a `.env` file in the `server` directory (or project root, depending on where you run the backend) with:
   - `SOUNDCLOUD_CLIENT_ID` – your app’s client ID  
   - `SOUNDCLOUD_CLIENT_SECRET` – your app’s client secret  

Copy `.env.example` to `.env` in the same directory as your backend (e.g. project root or `server/`) and fill in your credentials.

Only **public, playable** single-track URLs are supported. Playlists, user pages, and private or preview-only tracks are not supported in this phase.

## Stem Colors

| Stem   | Color   | Hex       |
|--------|---------|-----------|
| Drums  | Orange  | `#FF6B35` |
| Bass   | Blue    | `#4ECDC4` |
| Vocals | Pink    | `#FF6B9D` |
| Other  | Green   | `#95E881` |

## Future Improvements

- [ ] Implement stem caching (SHA-256 hash-based)
- [ ] Add htdemucs_6s experimental mode for guitar/piano separation
- [ ] WebSocket support for real-time processing updates
- [ ] Preset visualization themes
