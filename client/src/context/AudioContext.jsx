/**
 * Audio Context Provider
 * Manages global audio state and provides audio analysis data to visualizers
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { useAudioAnalysis } from '../hooks/useAudioAnalysis'

const AudioContext = createContext(null)

export function AudioProvider({ children }) {
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState(null)
  const [isMicActive, setIsMicActive] = useState(false)
  const [mutedStems, setMutedStems] = useState([])
  const [analysisData, setAnalysisData] = useState({})
  
  const {
    loadStems,
    startMicrophoneAnalysis,
    stopMicrophoneAnalysis,
    play,
    pause,
    setMuted,
    startAnalysisLoop,
    cleanup: cleanupAudio,
  } = useAudioAnalysis()

  const pollIntervalRef = useRef(null)

  /**
   * Poll for job status
   */
  const pollJobStatus = useCallback(async (jobId) => {
    console.log('[Poll] Checking status for job:', jobId)
    try {
      const response = await fetch(`/api/status/${jobId}`)
      console.log('[Poll] Response status:', response.status)
      const data = await response.json()
      console.log('[Poll] Job data:', JSON.stringify(data, null, 2))
      
      if (data.status === 'completed' && data.stems) {
        console.log('[Poll] Job completed! Stems:', data.stems)
        // Clear polling
        clearInterval(pollIntervalRef.current)
        
        setProcessingStatus({ stage: 'downloading', progress: 0.8 })
        
        // Load the separated stems
        console.log('[Poll] Loading stems...')
        try {
          await loadStems(data.stems)
          console.log('[Poll] Stems loaded successfully')
        } catch (loadError) {
          console.error('[Poll] Failed to load stems:', loadError)
          throw loadError
        }
        
        setProcessingStatus({ stage: 'loading', progress: 0.95 })
        
        // Start analysis loop
        console.log('[Poll] Starting analysis loop')
        startAnalysisLoop(setAnalysisData)
        
        setIsProcessing(false)
        setProcessingStatus(null)
        setIsReady(true)
        console.log('[Poll] Ready to play!')
        
      } else if (data.status === 'failed') {
        console.error('[Poll] Job failed:', data.error)
        clearInterval(pollIntervalRef.current)
        setProcessingStatus({ 
          stage: 'error', 
          progress: 0, 
          message: data.error || 'Processing failed' 
        })
        setIsProcessing(false)
        
      } else {
        // Still processing
        console.log('[Poll] Still processing, progress:', data.progress)
        setProcessingStatus({ 
          stage: 'processing', 
          progress: data.progress || 0.3,
          message: 'Separating stems with Demucs...' 
        })
      }
    } catch (error) {
      console.error('[Poll] Failed to poll status:', error)
      console.error('[Poll] Error stack:', error.stack)
    }
  }, [loadStems, startAnalysisLoop])

  /**
   * Upload an audio file for processing
   */
  const uploadFile = useCallback(async (file) => {
    console.log('[Upload] Starting upload for file:', file.name, 'type:', file.type, 'size:', file.size)
    setIsProcessing(true)
    setProcessingStatus({ stage: 'uploading', progress: 0.1 })
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      console.log('[Upload] Sending POST to /api/separate')
      const response = await fetch('/api/separate', {
        method: 'POST',
        body: formData,
      })
      
      console.log('[Upload] Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Upload] Server error response:', errorText)
        throw new Error(`Upload failed: ${response.status} - ${errorText}`)
      }
      
      const data = await response.json()
      console.log('[Upload] Success, job_id:', data.job_id)
      
      setProcessingStatus({ stage: 'processing', progress: 0.2 })
      
      // Start polling for completion
      pollIntervalRef.current = setInterval(() => {
        pollJobStatus(data.job_id)
      }, 2000)
      
    } catch (error) {
      console.error('[Upload] Error:', error)
      console.error('[Upload] Error stack:', error.stack)
      setProcessingStatus({ 
        stage: 'error', 
        progress: 0, 
        message: error.message 
      })
      setIsProcessing(false)
    }
  }, [pollJobStatus])

  /**
   * Load audio from a URL (SoundCloud, direct audio links, etc.)
   * Downloads and processes through the backend
   */
  const loadFromUrl = useCallback(async (url) => {
    setIsProcessing(true)
    setProcessingStatus({ stage: 'downloading', progress: 0.05, message: 'Downloading audio from URL...' })
    
    try {
      const response = await fetch('/api/separate-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to process URL')
      }
      
      const data = await response.json()
      
      setProcessingStatus({ stage: 'processing', progress: 0.2, message: 'Processing audio...' })
      
      // Start polling for completion
      pollIntervalRef.current = setInterval(() => {
        pollJobStatus(data.job_id)
      }, 2000)
      
    } catch (error) {
      console.error('URL processing error:', error)
      setProcessingStatus({ 
        stage: 'error', 
        progress: 0, 
        message: error.message || 'Failed to process URL. Try a direct audio link (MP3, WAV, FLAC).'
      })
      setTimeout(() => {
        setIsProcessing(false)
      }, 3000)
    }
  }, [pollJobStatus])

  /**
   * Start microphone capture for live visualization
   */
  const startMicrophone = useCallback(async () => {
    const success = await startMicrophoneAnalysis()
    if (success) {
      setIsMicActive(true)
      setIsReady(true)
      startAnalysisLoop(setAnalysisData)
    }
  }, [startMicrophoneAnalysis, startAnalysisLoop])

  /**
   * Stop microphone capture
   */
  const stopMicrophone = useCallback(() => {
    stopMicrophoneAnalysis()
    setIsMicActive(false)
  }, [stopMicrophoneAnalysis])

  /**
   * Toggle play/pause
   */
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause()
      setIsPlaying(false)
    } else {
      play()
      setIsPlaying(true)
    }
  }, [isPlaying, play, pause])

  /**
   * Toggle mute for a stem
   */
  const toggleStemMute = useCallback((stem) => {
    setMutedStems(prev => {
      const isMuted = prev.includes(stem)
      setMuted(stem, !isMuted)
      
      if (isMuted) {
        return prev.filter(s => s !== stem)
      } else {
        return [...prev, stem]
      }
    })
  }, [setMuted])

  /**
   * Reset everything
   */
  const reset = useCallback(() => {
    // Clear polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }
    
    // Clean up audio
    cleanupAudio()
    
    // Reset state
    setIsReady(false)
    setIsPlaying(false)
    setIsProcessing(false)
    setProcessingStatus(null)
    setIsMicActive(false)
    setMutedStems([])
    setAnalysisData({})
  }, [cleanupAudio])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const value = {
    // State
    isReady,
    isPlaying,
    isProcessing,
    processingStatus,
    isMicActive,
    mutedStems,
    analysisData,
    
    // Actions
    uploadFile,
    loadFromUrl,
    startMicrophone,
    stopMicrophone,
    togglePlay,
    toggleStemMute,
    reset,
  }

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  )
}

export function useAudio() {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider')
  }
  return context
}
