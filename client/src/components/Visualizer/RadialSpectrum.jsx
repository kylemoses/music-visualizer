/**
 * Radial Spectrum Visualizer
 * Displays frequency data as bars radiating from center, with stereo positioning
 * Center ring shows pitch height, outer glow pulses with energy
 */

import { useRef, useEffect, useCallback } from 'react'
import styled from 'styled-components'
import { useAudio } from '../../context/AudioContext'

const CanvasContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
`

const Canvas = styled.canvas`
  width: 100%;
  height: 100%;
  display: block;
`

const PitchIndicator = styled.div`
  position: absolute;
  bottom: 20px;
  right: 20px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  color: white;
  font-size: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
`

const PitchBar = styled.div`
  width: 120px;
  height: 8px;
  background: linear-gradient(to right, #4ECDC4, #FF6B9D);
  border-radius: 4px;
  margin-top: 4px;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    width: 4px;
    height: 16px;
    background: white;
    border-radius: 2px;
    top: -4px;
    left: ${props => props.$pitch * 100}%;
    transform: translateX(-50%);
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
  }
`

// Stem colors matching theme
const STEM_COLORS = {
  drums: '#FF6B35',
  bass: '#4ECDC4',
  vocals: '#FF6B9D',
  other: '#95E881',
  mic: '#6366f1', // Purple for mic input
}

// Number of frequency bins to display (reduce for cleaner visualization)
const DISPLAY_BINS = 128

// How much stereo position affects bar angle (radians)
const STEREO_INFLUENCE = 0.3

export function RadialSpectrum() {
  const canvasRef = useRef(null)
  const animationFrameRef = useRef(null)
  const pitchRef = useRef(0.5)
  const energyRef = useRef(0)
  const { analysisData, isReady, isMicActive, mutedStems } = useAudio()

  /**
   * Draw the visualization
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    const centerX = width / 2
    const centerY = height / 2
    
    // Clear canvas with fade effect for trails
    ctx.fillStyle = 'rgba(10, 10, 15, 0.15)'
    ctx.fillRect(0, 0, width, height)
    
    // Calculate radius
    const maxRadius = Math.min(width, height) * 0.4
    const innerRadius = maxRadius * 0.2
    
    // Get stems to visualize
    const stems = Object.keys(analysisData)
    
    // Extract global pitch and energy from all stems
    let globalPitch = 0.5
    let globalEnergy = 0
    stems.forEach(stem => {
      const data = analysisData[stem]
      if (!data) return
      if (data.pitch?.normalized && (stem === 'vocals' || stem === 'mic' || globalPitch === 0.5)) {
        globalPitch = data.pitch.normalized
      }
      globalEnergy = Math.max(globalEnergy, data.energy || 0)
    })
    
    // Smooth pitch and energy
    pitchRef.current += (globalPitch - pitchRef.current) * 0.1
    energyRef.current += (globalEnergy - energyRef.current) * 0.2
    
    if (stems.length === 0) {
      // Draw placeholder circle when no data
      ctx.beginPath()
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2)
      ctx.strokeStyle = '#2a2a3a'
      ctx.lineWidth = 2
      ctx.stroke()
      return
    }
    
    // Draw energy glow behind everything
    if (energyRef.current > 0.1) {
      const glowRadius = maxRadius * (1 + energyRef.current * 0.3)
      const glow = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, glowRadius)
      const hue = 260 + pitchRef.current * 60 // Purple to pink based on pitch
      glow.addColorStop(0, `hsla(${hue}, 70%, 50%, ${energyRef.current * 0.3})`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, width, height)
    }

    // Calculate bar width based on bins and stems
    const totalBars = DISPLAY_BINS
    const barAngle = (Math.PI * 2) / totalBars
    const barWidth = barAngle * 0.8 // Leave small gaps
    
    // Layer offset for multiple stems
    const stemCount = stems.filter(s => !mutedStems.includes(s)).length
    const layerOffset = stemCount > 1 ? (maxRadius - innerRadius) / stemCount : 0

    // Draw each stem
    stems.forEach((stem, stemIndex) => {
      // Skip muted stems (but still show mic if active)
      if (mutedStems.includes(stem) && stem !== 'mic') return
      
      const data = analysisData[stem]
      if (!data) return
      
      const { frequencies, stereoPositions } = data
      const color = STEM_COLORS[stem] || STEM_COLORS.mic
      
      // Reduce frequency bins for cleaner display
      const binStep = Math.floor(frequencies.length / DISPLAY_BINS)
      
      // Calculate layer radius for this stem
      const stemInnerRadius = innerRadius + (stemIndex * layerOffset)
      const stemMaxRadius = stemCount > 1 
        ? stemInnerRadius + layerOffset 
        : maxRadius
      
      for (let i = 0; i < DISPLAY_BINS; i++) {
        const binIndex = i * binStep
        const amplitude = frequencies[binIndex] || 0
        const stereo = stereoPositions[binIndex] || 0
        
        // Skip very quiet frequencies
        if (amplitude < 0.01) continue
        
        // Calculate base angle with stereo offset
        const baseAngle = (i / DISPLAY_BINS) * Math.PI * 2 - Math.PI / 2
        const stereoOffset = stereo * STEREO_INFLUENCE
        const angle = baseAngle + stereoOffset
        
        // Calculate bar length based on amplitude
        const barLength = amplitude * (stemMaxRadius - stemInnerRadius)
        
        // Calculate bar positions
        const x1 = centerX + Math.cos(angle) * stemInnerRadius
        const y1 = centerY + Math.sin(angle) * stemInnerRadius
        const x2 = centerX + Math.cos(angle) * (stemInnerRadius + barLength)
        const y2 = centerY + Math.sin(angle) * (stemInnerRadius + barLength)
        
        // Draw the bar with gradient
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
        gradient.addColorStop(0, `${color}44`)
        gradient.addColorStop(1, color)
        
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = gradient
        ctx.lineWidth = Math.max(2, barWidth * stemInnerRadius * 0.5)
        ctx.lineCap = 'round'
        ctx.stroke()
        
        // Add glow effect for loud frequencies
        if (amplitude > 0.5) {
          ctx.shadowColor = color
          ctx.shadowBlur = amplitude * 20
          ctx.stroke()
          ctx.shadowBlur = 0
        }
      }
    })

    // Draw center circle
    ctx.beginPath()
    ctx.arc(centerX, centerY, innerRadius * 0.8, 0, Math.PI * 2)
    const centerGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, innerRadius * 0.8
    )
    centerGradient.addColorStop(0, '#1a1a2e')
    centerGradient.addColorStop(1, '#0a0a0f')
    ctx.fillStyle = centerGradient
    ctx.fill()
    
    // Draw pitch indicator ring in center
    const pitchRingRadius = innerRadius * 0.6
    const pitchArc = pitchRef.current * Math.PI * 2 - Math.PI / 2
    ctx.beginPath()
    ctx.arc(centerX, centerY, pitchRingRadius, -Math.PI / 2, pitchArc)
    ctx.strokeStyle = `hsl(${260 + pitchRef.current * 60}, 70%, 60%)`
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.stroke()
    
    // Draw pitch text in center
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const pitchLabel = pitchRef.current > 0.6 ? '▲ HIGH' : pitchRef.current < 0.4 ? '▼ LOW' : '● MID'
    ctx.fillText(pitchLabel, centerX, centerY)

    // Draw stem legend
    const legendY = height - 40
    let legendX = 20
    stems.forEach(stem => {
      if (stem === 'mic') return
      
      const isMuted = mutedStems.includes(stem)
      const color = STEM_COLORS[stem]
      
      ctx.beginPath()
      ctx.arc(legendX + 6, legendY, 6, 0, Math.PI * 2)
      ctx.fillStyle = isMuted ? '#333' : color
      ctx.fill()
      
      ctx.fillStyle = isMuted ? '#666' : '#fff'
      ctx.font = '12px -apple-system, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(stem, legendX + 18, legendY + 4)
      
      legendX += ctx.measureText(stem).width + 40
    })

  }, [analysisData, mutedStems])

  /**
   * Resize canvas to match container
   */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const container = canvas.parentElement
    const { width, height } = container.getBoundingClientRect()
    
    // Set actual pixel dimensions (for crisp rendering)
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    
    // Scale context for retina displays
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    
    // Set CSS dimensions
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }, [])

  /**
   * Animation loop
   */
  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    
    const animate = () => {
      draw()
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [draw, resizeCanvas])

  return (
    <CanvasContainer>
      <Canvas ref={canvasRef} />
      {Object.keys(analysisData).length > 0 && (
        <PitchIndicator>
          <div>Pitch</div>
          <PitchBar $pitch={pitchRef.current} />
        </PitchIndicator>
      )}
    </CanvasContainer>
  )
}
