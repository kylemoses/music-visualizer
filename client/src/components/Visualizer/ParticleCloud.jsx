/**
 * 3D Particle Cloud Visualizer
 * Displays frequency data as particles in 3D space with stereo positioning
 * Features pitch-driven camera movement - vocals lift you up, bass brings you down
 */

import { useRef, useMemo, useEffect, useState } from 'react'
import styled from 'styled-components'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { useAudio } from '../../context/AudioContext'

const Container = styled.div`
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 100%);
`

const JourneyIndicator = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  color: white;
  font-size: 12px;
  z-index: 10;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
`

const FeatureBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  
  span {
    width: 60px;
    color: #888;
  }
`

const BarContainer = styled.div`
  flex: 1;
  height: 4px;
  background: #333;
  border-radius: 2px;
  overflow: hidden;
`

const BarFill = styled.div`
  height: 100%;
  background: ${props => props.$color || '#6366f1'};
  width: ${props => props.$value * 100}%;
  transition: width 0.1s ease-out;
`

// Stem colors matching theme
const STEM_COLORS = {
  drums: new THREE.Color('#FF6B35'),
  bass: new THREE.Color('#4ECDC4'),
  vocals: new THREE.Color('#FF6B9D'),
  other: new THREE.Color('#95E881'),
  mic: new THREE.Color('#6366f1'),
}

// Number of particles per stem
const PARTICLES_PER_STEM = 512

// Frequency bins to sample
const FREQUENCY_BINS = 64

/**
 * Particle system for a single stem
 * Particles react to frequency, stereo position, and pitch
 */
function StemParticles({ stem, data, muted }) {
  const meshRef = useRef()
  const particleCount = PARTICLES_PER_STEM
  
  // Create geometry and initial positions
  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)
    
    const color = STEM_COLORS[stem] || STEM_COLORS.mic
    
    for (let i = 0; i < particleCount; i++) {
      // Initial random positions in a sphere
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = 5 + Math.random() * 10
      
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = radius * Math.cos(phi)
      
      // Set color
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
      
      // Initial size
      sizes[i] = 0.1
    }
    
    return { positions, colors, sizes }
  }, [stem, particleCount])

  // Update particles based on audio data
  useFrame((state) => {
    if (!meshRef.current || !data || muted) return
    
    const { frequencies, stereoPositions, pitch, energy, bassEnergy } = data
    const geometry = meshRef.current.geometry
    const positionAttr = geometry.attributes.position
    const sizeAttr = geometry.attributes.size
    const colorAttr = geometry.attributes.color
    
    const binStep = Math.floor(frequencies.length / FREQUENCY_BINS)
    const time = state.clock.elapsedTime
    
    // Get pitch value (0-1) for vertical spread
    const pitchValue = pitch?.normalized || 0.5
    const energyValue = energy || 0
    
    for (let i = 0; i < particleCount; i++) {
      // Map particle to frequency bin
      const binIndex = (i % FREQUENCY_BINS) * binStep
      const amplitude = frequencies[binIndex] || 0
      const stereo = stereoPositions[binIndex] || 0
      
      // Calculate new position
      const freqNorm = (i % FREQUENCY_BINS) / FREQUENCY_BINS
      const layer = Math.floor(i / FREQUENCY_BINS)
      
      // Create spiral/helix pattern that responds to pitch
      const angle = (i / particleCount) * Math.PI * 8 + time * 0.5
      const heightOffset = pitchValue * 10 - 5 // Pitch moves everything up/down
      
      // X: stereo position + circular motion
      const baseRadius = 3 + freqNorm * 5 + amplitude * 4
      positionAttr.array[i * 3] = Math.cos(angle) * baseRadius + stereo * 6
      
      // Y: frequency-based height + pitch offset + amplitude boost
      positionAttr.array[i * 3 + 1] = (freqNorm - 0.5) * 12 + heightOffset + amplitude * 5 + Math.sin(time + i * 0.1) * energyValue * 2
      
      // Z: layer depth + wave motion
      positionAttr.array[i * 3 + 2] = Math.sin(angle) * baseRadius + layer * 2 - 4
      
      // Update size based on amplitude and energy
      sizeAttr.array[i] = 0.05 + amplitude * 0.8 + energyValue * 0.3
      
      // Pulse colors on high energy
      if (energyValue > 0.3) {
        const pulse = Math.sin(time * 10) * 0.5 + 0.5
        const color = STEM_COLORS[stem] || STEM_COLORS.mic
        colorAttr.array[i * 3] = color.r + pulse * 0.3
        colorAttr.array[i * 3 + 1] = color.g + pulse * 0.3
        colorAttr.array[i * 3 + 2] = color.b + pulse * 0.3
      }
    }
    
    positionAttr.needsUpdate = true
    sizeAttr.needsUpdate = true
    colorAttr.needsUpdate = true
  })

  if (muted) return null

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={particleCount}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

/**
 * Grid helper for spatial reference
 */
function Grid() {
  return (
    <gridHelper
      args={[40, 40, '#2a2a3a', '#1a1a2a']}
      rotation={[0, 0, 0]}
      position={[0, -10, 0]}
    />
  )
}

/**
 * Audio-reactive camera controller
 * Pitch → Y position (higher notes = camera rises)
 * Energy → Forward movement speed
 * Bass → Camera shake/pulse
 * Stereo → X drift
 */
function AudioReactiveCamera({ journeyMode = true }) {
  const { camera } = useThree()
  const { analysisData } = useAudio()
  
  // Smoothed values for gradual transitions
  const smoothedRef = useRef({
    pitch: 0.5,
    energy: 0,
    bass: 0,
    stereo: 0,
    centroid: 0.5,
  })
  
  // Camera path state
  const pathRef = useRef({
    z: 0,        // Forward position (journey progress)
    angle: 0,    // Rotation around Y axis
  })
  
  useEffect(() => {
    camera.position.set(0, 5, 15)
    camera.lookAt(0, 0, 0)
  }, [camera])
  
  useFrame((state, delta) => {
    if (!journeyMode) return
    
    // Aggregate features from all stems
    let totalPitch = 0.5
    let totalEnergy = 0
    let totalBass = 0
    let totalStereo = 0
    let totalCentroid = 0.5
    let stemCount = 0
    
    Object.entries(analysisData).forEach(([stem, data]) => {
      if (!data) return
      
      stemCount++
      totalEnergy += data.energy || 0
      totalBass += data.bassEnergy || 0
      totalCentroid += data.spectralCentroid || 0.5
      
      // Use vocal pitch as primary, fallback to other stems
      if (data.pitch && data.pitch.confidence > 0.1) {
        if (stem === 'vocals' || stem === 'mic') {
          totalPitch = data.pitch.normalized
        } else if (totalPitch === 0.5) {
          totalPitch = data.pitch.normalized
        }
      }
      
      // Average stereo position across frequency bands
      if (data.stereoPositions) {
        const avgStereo = data.stereoPositions.reduce((a, b) => a + b, 0) / data.stereoPositions.length
        totalStereo += avgStereo
      }
    })
    
    if (stemCount > 0) {
      totalEnergy /= stemCount
      totalBass /= stemCount
      totalStereo /= stemCount
      totalCentroid /= stemCount
    }
    
    // Smooth the values for gradual camera movement
    const smoothing = 0.05
    const s = smoothedRef.current
    s.pitch += (totalPitch - s.pitch) * smoothing
    s.energy += (totalEnergy - s.energy) * smoothing * 2
    s.bass += (totalBass - s.bass) * smoothing * 3
    s.stereo += (totalStereo - s.stereo) * smoothing
    s.centroid += (totalCentroid - s.centroid) * smoothing
    
    // Update path
    const p = pathRef.current
    p.z += delta * (0.5 + s.energy * 3) // Move forward faster with more energy
    p.angle += delta * 0.1 * (1 + s.energy) // Rotate slowly, faster with energy
    
    // Calculate camera position
    // Y: -5 (low pitch) to 20 (high pitch)
    const targetY = -5 + s.pitch * 25
    
    // X: Drift based on stereo position
    const targetX = s.stereo * 8
    
    // Z: Oscillate forward/back based on journey + bass pulses
    const bassPulse = Math.sin(state.clock.elapsedTime * 2) * s.bass * 2
    const baseZ = 15 + Math.sin(p.z * 0.1) * 5
    const targetZ = baseZ + bassPulse
    
    // Apply camera position with smoothing
    camera.position.x += (targetX - camera.position.x) * 0.02
    camera.position.y += (targetY - camera.position.y) * 0.03
    camera.position.z += (targetZ - camera.position.z) * 0.02
    
    // Camera shake on bass hits
    if (s.bass > 0.5) {
      camera.position.x += (Math.random() - 0.5) * s.bass * 0.3
      camera.position.y += (Math.random() - 0.5) * s.bass * 0.2
    }
    
    // Look at a point that also moves with the music
    const lookAtY = s.pitch * 5 - 2
    camera.lookAt(0, lookAtY, 0)
    
    // Tilt camera based on spectral centroid (brightness)
    camera.rotation.z = (s.centroid - 0.5) * 0.1
  })
  
  return null
}

/**
 * Fallback camera with orbit controls (when journey mode is off)
 */
function OrbitCamera() {
  const { camera } = useThree()
  
  useEffect(() => {
    camera.position.set(0, 5, 15)
    camera.lookAt(0, 0, 0)
  }, [camera])
  
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      enablePan={false}
      minDistance={5}
      maxDistance={30}
      autoRotate
      autoRotateSpeed={0.5}
    />
  )
}

/**
 * Scene containing all particle systems
 */
function Scene({ journeyMode }) {
  const { analysisData, mutedStems } = useAudio()
  
  return (
    <>
      {journeyMode ? (
        <AudioReactiveCamera journeyMode={journeyMode} />
      ) : (
        <OrbitCamera />
      )}
      <Grid />
      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
      <ambientLight intensity={0.2} />
      <fog attach="fog" args={['#0a0a0f', 10, 50]} />
      
      {Object.entries(analysisData).map(([stem, data]) => (
        <StemParticles
          key={stem}
          stem={stem}
          data={data}
          muted={mutedStems.includes(stem)}
        />
      ))}
    </>
  )
}

/**
 * Fallback content when no audio is loaded
 */
function Placeholder() {
  const meshRef = useRef()
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.2
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.2
    }
  })
  
  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[2, 1]} />
      <meshBasicMaterial
        color="#2a2a3a"
        wireframe
      />
    </mesh>
  )
}

/**
 * Main particle cloud component
 */
export function ParticleCloud() {
  const { isReady, isMicActive, analysisData } = useAudio()
  const [journeyMode, setJourneyMode] = useState(true)
  const hasData = isReady || isMicActive
  
  // Extract musical features for display
  const features = useMemo(() => {
    let pitch = 0.5
    let energy = 0
    let bass = 0
    let treble = 0
    
    Object.values(analysisData).forEach(data => {
      if (!data) return
      if (data.pitch?.normalized) pitch = data.pitch.normalized
      energy = Math.max(energy, data.energy || 0)
      bass = Math.max(bass, data.bassEnergy || 0)
      treble = Math.max(treble, data.trebleEnergy || 0)
    })
    
    return { pitch, energy, bass, treble }
  }, [analysisData])
  
  return (
    <Container>
      <Canvas
        camera={{ position: [0, 5, 15], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
      >
        {hasData ? <Scene journeyMode={journeyMode} /> : <Placeholder />}
      </Canvas>
      
      {hasData && (
        <JourneyIndicator>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontWeight: 'bold' }}>Journey Mode</span>
            <button
              onClick={() => setJourneyMode(!journeyMode)}
              style={{
                padding: '4px 8px',
                background: journeyMode ? '#6366f1' : '#333',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              {journeyMode ? 'ON' : 'OFF'}
            </button>
          </div>
          <FeatureBar>
            <span>Pitch</span>
            <BarContainer>
              <BarFill $value={features.pitch} $color="#FF6B9D" />
            </BarContainer>
          </FeatureBar>
          <FeatureBar>
            <span>Energy</span>
            <BarContainer>
              <BarFill $value={features.energy} $color="#95E881" />
            </BarContainer>
          </FeatureBar>
          <FeatureBar>
            <span>Bass</span>
            <BarContainer>
              <BarFill $value={features.bass} $color="#4ECDC4" />
            </BarContainer>
          </FeatureBar>
          <FeatureBar>
            <span>Treble</span>
            <BarContainer>
              <BarFill $value={features.treble} $color="#FF6B35" />
            </BarContainer>
          </FeatureBar>
        </JourneyIndicator>
      )}
    </Container>
  )
}
