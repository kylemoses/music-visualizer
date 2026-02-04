"""
Demucs Service
Handles audio stem separation using the Demucs model
"""

import os
import shutil
import subprocess
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from enum import Enum

# Set up FFmpeg path from imageio-ffmpeg if available (for portability)
try:
    import imageio_ffmpeg
    ffmpeg_path = os.path.dirname(imageio_ffmpeg.get_ffmpeg_exe())
    os.environ["PATH"] = ffmpeg_path + os.pathsep + os.environ.get("PATH", "")
except ImportError:
    pass  # Fall back to system FFmpeg


class JobStatusEnum(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class JobStatus:
    status: str = JobStatusEnum.PENDING
    progress: float = 0.0
    stems: Optional[List[str]] = None
    error: Optional[str] = None


class DemucsService:
    """
    Service for separating audio into stems using Demucs.
    Uses htdemucs_ft model for highest quality separation.
    """
    
    # Demucs model to use - htdemucs_ft provides best quality
    MODEL = "htdemucs_ft"
    
    # Output stems from the model
    STEMS = ["drums", "bass", "vocals", "other"]
    
    def __init__(self):
        self.jobs: Dict[str, JobStatus] = {}
        self.output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output")
        os.makedirs(self.output_dir, exist_ok=True)
    
    def get_job_status(self, job_id: str) -> Optional[JobStatus]:
        """Get the status of a job by ID."""
        return self.jobs.get(job_id)
    
    def separate(self, job_id: str, input_path: str) -> None:
        """
        Run Demucs separation on the input file.
        This is meant to be run as a background task.
        """
        self.jobs[job_id] = JobStatus(status=JobStatusEnum.PROCESSING, progress=0.1)
        
        job_output_dir = os.path.join(self.output_dir, job_id)
        os.makedirs(job_output_dir, exist_ok=True)
        
        try:
            # Run demucs command
            # Using subprocess to run demucs CLI for simplicity
            cmd = [
                "python", "-m", "demucs",
                "-n", self.MODEL,
                "-o", job_output_dir,
                input_path
            ]
            
            self.jobs[job_id].progress = 0.2
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600  # 10 minute timeout
            )
            
            if result.returncode != 0:
                raise Exception(f"Demucs failed: {result.stderr}")
            
            self.jobs[job_id].progress = 0.9
            
            # Demucs outputs to: output_dir/htdemucs_ft/filename/stem.wav
            # We need to move files to: output_dir/job_id/stem.wav
            input_filename = os.path.splitext(os.path.basename(input_path))[0]
            demucs_output = os.path.join(job_output_dir, self.MODEL, input_filename)
            
            stems_found = []
            for stem in self.STEMS:
                src = os.path.join(demucs_output, f"{stem}.wav")
                dst = os.path.join(job_output_dir, f"{stem}.wav")
                if os.path.exists(src):
                    shutil.move(src, dst)
                    stems_found.append(stem)
            
            # Clean up demucs subdirectories
            demucs_subdir = os.path.join(job_output_dir, self.MODEL)
            if os.path.exists(demucs_subdir):
                shutil.rmtree(demucs_subdir)
            
            # Clean up input file
            if os.path.exists(input_path):
                os.remove(input_path)
            
            self.jobs[job_id] = JobStatus(
                status=JobStatusEnum.COMPLETED,
                progress=1.0,
                stems=stems_found
            )
            
        except subprocess.TimeoutExpired:
            self.jobs[job_id] = JobStatus(
                status=JobStatusEnum.FAILED,
                error="Processing timeout - file may be too large"
            )
        except Exception as e:
            self.jobs[job_id] = JobStatus(
                status=JobStatusEnum.FAILED,
                error=str(e)
            )
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a job and clean up its files."""
        if job_id not in self.jobs:
            return False
        
        self.jobs[job_id].status = JobStatusEnum.CANCELLED
        
        # Clean up output directory
        job_output_dir = os.path.join(self.output_dir, job_id)
        if os.path.exists(job_output_dir):
            shutil.rmtree(job_output_dir)
        
        return True


# TODO: Future caching implementation
# 
# class StemCache:
#     """
#     Cache for separated stems to avoid re-processing the same audio.
#     
#     Implementation notes:
#     - Key stems by SHA-256 hash of source audio file
#     - Store stems in a dedicated cache directory
#     - Implement LRU eviction when cache exceeds size limit
#     - Consider using Redis for distributed caching in production
#     
#     Usage:
#         cache = StemCache(cache_dir="/path/to/cache", max_size_gb=10)
#         
#         # Check cache before processing
#         audio_hash = cache.hash_file(input_path)
#         cached_stems = cache.get(audio_hash)
#         
#         if cached_stems:
#             return cached_stems
#         
#         # Process and cache
#         stems = demucs_service.separate(input_path)
#         cache.put(audio_hash, stems)
#     """
#     pass
