/**
 * Audio Analysis Hook
 * Provides frequency data, stereo pan, pitch detection, and musical features per stem
 */

import { useCallback, useRef, useState, useEffect } from 'react'
import {
  detectPitch,
  calculateEnergy,
  calculateSpectralCentroid,
  calculateSpectralFlux,
  calculateBassEnergy,
  calculateTrebleEnergy,
} from './usePitchDetection'

// Stem names matching Demucs output
const STEMS = ['drums', 'bass', 'vocals', 'other']

// FFT configuration
const FFT_SIZE = 2048
const SMOOTHING = 0.8

/**
 * Creates an audio analysis pipeline for a single audio source
 * Splits stereo channels and provides frequency + stereo + pitch data
 */
function createStemAnalyzer(audioContext, source) {
  // Create channel splitter for stereo analysis
  const splitter = audioContext.createChannelSplitter(2)
  const analyserL = audioContext.createAnalyser()
  const analyserR = audioContext.createAnalyser()
  
  // Create a combined mono analyser for pitch detection
  const analyserMono = audioContext.createAnalyser()
  analyserMono.fftSize = FFT_SIZE
  analyserMono.smoothingTimeConstant = SMOOTHING
  
  // Configure analyzers
  analyserL.fftSize = FFT_SIZE
  analyserR.fftSize = FFT_SIZE
  analyserL.smoothingTimeConstant = SMOOTHING
  analyserR.smoothingTimeConstant = SMOOTHING
  
  // Connect: source -> splitter -> L/R analyzers
  source.connect(splitter)
  source.connect(analyserMono) // Also connect to mono analyser
  splitter.connect(analyserL, 0) // Left channel
  splitter.connect(analyserR, 1) // Right channel
  
  // Create data arrays
  const frequencyBinCount = analyserL.frequencyBinCount
  const leftData = new Uint8Array(frequencyBinCount)
  const rightData = new Uint8Array(frequencyBinCount)
  
  // Store previous spectrum for flux calculation
  let previousSpectrum = null
  
  return {
    analyserL,
    analyserR,
    analyserMono,
    audioContext,
    leftData,
    rightData,
    frequencyBinCount,
    
    /**
     * Get current frequency data, stereo positions, and musical features
     * Returns { frequencies, stereoPositions, pitch, energy, spectralCentroid, bassEnergy, trebleEnergy, flux }
     */
    getData() {
      analyserL.getByteFrequencyData(leftData)
      analyserR.getByteFrequencyData(rightData)
      
      const frequencies = new Float32Array(frequencyBinCount)
      const stereoPositions = new Float32Array(frequencyBinCount)
      
      for (let i = 0; i < frequencyBinCount; i++) {
        const L = leftData[i]
        const R = rightData[i]
        
        // Average amplitude (0-255 normalized to 0-1)
        frequencies[i] = (L + R) / 2 / 255
        
        // Stereo position: -1 (left) to 1 (right)
        // Avoid division by zero
        if (L + R > 0) {
          stereoPositions[i] = (R - L) / (R + L)
        } else {
          stereoPositions[i] = 0
        }
      }
      
      // Calculate musical features
      const sampleRate = audioContext.sampleRate
      const pitch = detectPitch(analyserMono, audioContext)
      const energy = calculateEnergy(analyserMono)
      const spectralCentroid = calculateSpectralCentroid(analyserMono, sampleRate)
      const bassEnergy = calculateBassEnergy(analyserL, sampleRate)
      const trebleEnergy = calculateTrebleEnergy(analyserL, sampleRate)
      
      // Spectral flux for beat detection
      const currentSpectrum = new Float32Array(frequencies)
      const flux = calculateSpectralFlux(currentSpectrum, previousSpectrum)
      previousSpectrum = currentSpectrum
      
      return { 
        frequencies, 
        stereoPositions,
        // Musical features
        pitch,           // { frequency, confidence, midiNote, normalized } or null
        energy,          // 0-1 RMS energy
        spectralCentroid, // 0-1 brightness
        bassEnergy,      // 0-1 low frequency energy
        trebleEnergy,    // 0-1 high frequency energy
        flux,            // Spectral flux (beat/onset indicator)
      }
    }
  }
}

/**
 * Hook for analyzing audio from multiple stems or microphone input
 */
export function useAudioAnalysis() {
  const audioContextRef = useRef(null)
  const analyzersRef = useRef({})
  const sourcesRef = useRef({})
  const gainNodesRef = useRef({})
  const micStreamRef = useRef(null)
  const animationFrameRef = useRef(null)
  
  const [isInitialized, setIsInitialized] = useState(false)
  const [analysisData, setAnalysisData] = useState({})

  /**
   * Initialize AudioContext (must be called after user interaction)
   */
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])

  /**
   * Load stems from URLs and set up analysis pipeline
   */
  const loadStems = useCallback(async (stemUrls) => {
    const ctx = initAudioContext()
    
    // Load all stem audio files
    const loadPromises = STEMS.map(async (stem) => {
      if (!stemUrls[stem]) return null
      
      const response = await fetch(stemUrls[stem])
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      
      return { stem, audioBuffer }
    })
    
    const results = await Promise.all(loadPromises)
    
    // Create sources, gain nodes, and analyzers for each stem
    results.forEach(result => {
      if (!result) return
      
      const { stem, audioBuffer } = result
      
      // Create buffer source
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.loop = true
      
      // Create gain node for muting
      const gainNode = ctx.createGain()
      gainNode.gain.value = 1
      
      // Connect: source -> gain -> destination (for audio output)
      source.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      // Create analyzer for visualization
      const analyzer = createStemAnalyzer(ctx, gainNode)
      
      sourcesRef.current[stem] = source
      gainNodesRef.current[stem] = gainNode
      analyzersRef.current[stem] = analyzer
    })
    
    setIsInitialized(true)
    return true
  }, [initAudioContext])

  /**
   * Start microphone input for live visualization
   */
  const startMicrophoneAnalysis = useCallback(async () => {
    const ctx = initAudioContext()
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })
      
      micStreamRef.current = stream
      
      // Create media stream source
      const source = ctx.createMediaStreamSource(stream)
      
      // For mic input, we treat it as a single "mixed" source
      // Create analyzer without connecting to destination (no feedback)
      const analyzer = createStemAnalyzer(ctx, source)
      
      analyzersRef.current['mic'] = analyzer
      setIsInitialized(true)
      
      return true
    } catch (error) {
      console.error('Microphone access denied:', error)
      return false
    }
  }, [initAudioContext])

  /**
   * Stop microphone input
   */
  const stopMicrophoneAnalysis = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop())
      micStreamRef.current = null
    }
    delete analyzersRef.current['mic']
  }, [])

  /**
   * Start playback of all stems
   */
  const play = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx) return
    
    // Resume context if suspended
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
    
    // Start all sources at the same time
    const startTime = ctx.currentTime
    Object.values(sourcesRef.current).forEach(source => {
      if (source.buffer && !source._started) {
        source.start(startTime)
        source._started = true
      }
    })
  }, [])

  /**
   * Pause playback
   */
  const pause = useCallback(() => {
    const ctx = audioContextRef.current
    if (ctx) {
      ctx.suspend()
    }
  }, [])

  /**
   * Mute/unmute a specific stem
   */
  const setMuted = useCallback((stem, muted) => {
    const gainNode = gainNodesRef.current[stem]
    if (gainNode) {
      gainNode.gain.value = muted ? 0 : 1
    }
  }, [])

  /**
   * Start the analysis animation loop
   * Returns a function that provides current analysis data
   */
  const startAnalysisLoop = useCallback((onUpdate) => {
    const update = () => {
      const data = {}
      
      Object.entries(analyzersRef.current).forEach(([stem, analyzer]) => {
        data[stem] = analyzer.getData()
      })
      
      onUpdate(data)
      animationFrameRef.current = requestAnimationFrame(update)
    }
    
    update()
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  /**
   * Clean up all audio resources
   */
  const cleanup = useCallback(() => {
    // Stop animation loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    // Stop microphone
    stopMicrophoneAnalysis()
    
    // Disconnect and stop all sources
    Object.values(sourcesRef.current).forEach(source => {
      try {
        source.stop()
        source.disconnect()
      } catch (e) {
        // Source may not have been started
      }
    })
    
    // Clear refs
    sourcesRef.current = {}
    gainNodesRef.current = {}
    analyzersRef.current = {}
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    setIsInitialized(false)
  }, [stopMicrophoneAnalysis])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    isInitialized,
    loadStems,
    startMicrophoneAnalysis,
    stopMicrophoneAnalysis,
    play,
    pause,
    setMuted,
    startAnalysisLoop,
    cleanup,
  }
}
