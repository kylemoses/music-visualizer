/**
 * Pitch Detection Hook
 * Uses autocorrelation algorithm to detect fundamental frequency
 * Optimized for vocal/melodic content
 */

// Minimum and maximum frequencies to detect (Hz)
const MIN_FREQ = 80   // ~E2 (low male voice)
const MAX_FREQ = 1000 // ~B5 (high female voice/instruments)

/**
 * Autocorrelation-based pitch detection
 * More accurate for musical content than simple FFT peak detection
 */
export function detectPitch(analyser, audioContext) {
  const bufferLength = analyser.fftSize
  const buffer = new Float32Array(bufferLength)
  analyser.getFloatTimeDomainData(buffer)
  
  // Check if there's enough signal (RMS)
  let rms = 0
  for (let i = 0; i < bufferLength; i++) {
    rms += buffer[i] * buffer[i]
  }
  rms = Math.sqrt(rms / bufferLength)
  
  // If signal is too quiet, return null
  if (rms < 0.01) {
    return null
  }
  
  // Autocorrelation
  const sampleRate = audioContext.sampleRate
  const minPeriod = Math.floor(sampleRate / MAX_FREQ)
  const maxPeriod = Math.floor(sampleRate / MIN_FREQ)
  
  let bestCorrelation = 0
  let bestPeriod = 0
  
  for (let period = minPeriod; period <= maxPeriod; period++) {
    let correlation = 0
    
    for (let i = 0; i < bufferLength - period; i++) {
      correlation += buffer[i] * buffer[i + period]
    }
    
    correlation /= (bufferLength - period)
    
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation
      bestPeriod = period
    }
  }
  
  // Require minimum correlation confidence
  if (bestCorrelation < 0.01 || bestPeriod === 0) {
    return null
  }
  
  const frequency = sampleRate / bestPeriod
  
  return {
    frequency,
    confidence: bestCorrelation,
    // Convert to MIDI note number for easier mapping
    midiNote: frequencyToMidi(frequency),
    // Normalized pitch (0-1) within typical vocal range
    normalized: Math.max(0, Math.min(1, (frequency - MIN_FREQ) / (MAX_FREQ - MIN_FREQ)))
  }
}

/**
 * Convert frequency to MIDI note number
 * A4 = 440Hz = MIDI note 69
 */
function frequencyToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440)
}

/**
 * Calculate RMS energy from time domain data
 */
export function calculateEnergy(analyser) {
  const bufferLength = analyser.fftSize
  const buffer = new Float32Array(bufferLength)
  analyser.getFloatTimeDomainData(buffer)
  
  let sum = 0
  for (let i = 0; i < bufferLength; i++) {
    sum += buffer[i] * buffer[i]
  }
  
  return Math.sqrt(sum / bufferLength)
}

/**
 * Detect spectral centroid (brightness)
 * Higher values = brighter/more treble-heavy sound
 */
export function calculateSpectralCentroid(analyser, sampleRate) {
  const frequencies = new Float32Array(analyser.frequencyBinCount)
  analyser.getFloatFrequencyData(frequencies)
  
  let weightedSum = 0
  let sum = 0
  
  for (let i = 0; i < frequencies.length; i++) {
    // Convert from dB to linear magnitude
    const magnitude = Math.pow(10, frequencies[i] / 20)
    const freq = (i * sampleRate) / (analyser.fftSize)
    
    weightedSum += freq * magnitude
    sum += magnitude
  }
  
  if (sum === 0) return 0
  
  const centroid = weightedSum / sum
  // Normalize to 0-1 (typical range 0-8000 Hz)
  return Math.min(1, centroid / 8000)
}

/**
 * Simple beat/onset detection using spectral flux
 */
export function calculateSpectralFlux(currentSpectrum, previousSpectrum) {
  if (!previousSpectrum) return 0
  
  let flux = 0
  for (let i = 0; i < currentSpectrum.length; i++) {
    const diff = currentSpectrum[i] - previousSpectrum[i]
    // Only count increases (onsets)
    if (diff > 0) {
      flux += diff
    }
  }
  
  return flux / currentSpectrum.length
}

/**
 * Calculate bass energy (low frequency content)
 */
export function calculateBassEnergy(analyser, sampleRate) {
  const frequencies = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(frequencies)
  
  // Sum energy in bass range (0-200 Hz)
  const bassEndBin = Math.floor(200 / (sampleRate / analyser.fftSize))
  
  let sum = 0
  for (let i = 0; i < bassEndBin; i++) {
    sum += frequencies[i]
  }
  
  return sum / (bassEndBin * 255)
}

/**
 * Calculate treble energy (high frequency content)
 */
export function calculateTrebleEnergy(analyser, sampleRate) {
  const frequencies = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(frequencies)
  
  // Sum energy in treble range (4000+ Hz)
  const trebleStartBin = Math.floor(4000 / (sampleRate / analyser.fftSize))
  
  let sum = 0
  let count = 0
  for (let i = trebleStartBin; i < frequencies.length; i++) {
    sum += frequencies[i]
    count++
  }
  
  return count > 0 ? sum / (count * 255) : 0
}
