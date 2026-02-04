"""
Music Visualizer Backend
FastAPI server for audio stem separation using Demucs
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from routes import separation

# Load .env from server dir or project root so SoundCloud credentials work when run from server/
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

app = FastAPI(
    title="Music Visualizer API",
    description="Audio stem separation API using Demucs",
    version="1.0.0"
)

# CORS configuration for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create output directory for separated stems
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Serve separated audio files statically
app.mount("/stems", StaticFiles(directory=OUTPUT_DIR), name="stems")

# Register routes
app.include_router(separation.router, prefix="/api", tags=["separation"])


@app.get("/")
async def root():
    return {
        "message": "Music Visualizer API",
        "docs": "/docs",
        "endpoints": {
            "separate": "POST /api/separate",
            "status": "GET /api/status/{job_id}",
            "stems": "GET /stems/{job_id}/{stem}.wav"
        }
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
