import styled from 'styled-components'
import { useAudio } from '../../context/AudioContext'

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`

const ModeToggle = styled.div`
  display: flex;
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  padding: ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.md};
`

const ModeButton = styled.button`
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 0.875rem;
  font-weight: 500;
  color: ${({ theme, $active }) => $active ? theme.colors.text : theme.colors.textMuted};
  background: ${({ theme, $active }) => $active ? theme.colors.primary : 'transparent'};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`

const StemControls = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
`

const StemButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ $color, $muted }) => $muted ? '#333' : $color};
  opacity: ${({ $muted }) => $muted ? 0.3 : 1};
  transition: all ${({ theme }) => theme.transitions.fast};
  position: relative;
  
  &:hover {
    transform: scale(1.1);
  }

  &::after {
    content: '${({ $label }) => $label}';
    position: absolute;
    bottom: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.625rem;
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
    opacity: 0;
    transition: opacity ${({ theme }) => theme.transitions.fast};
  }

  &:hover::after {
    opacity: 1;
  }
`

const PlaybackControls = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`

const PlayButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.gradientPrimary};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    transform: scale(1.05);
    box-shadow: ${({ theme }) => theme.shadows.glow};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  svg {
    width: 18px;
    height: 18px;
    fill: white;
  }
`

const ResetButton = styled.button`
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: 0.875rem;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.border};
  }
`

const MicIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.error}22;
  border: 1px solid ${({ theme }) => theme.colors.error};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.error};
  font-size: 0.75rem;
  font-weight: 500;
`

const PulseDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.error};
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }
`

const PlayIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z"/>
  </svg>
)

const PauseIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
  </svg>
)

const STEM_CONFIG = [
  { key: 'drums', label: 'D', color: '#FF6B35' },
  { key: 'bass', label: 'B', color: '#4ECDC4' },
  { key: 'vocals', label: 'V', color: '#FF6B9D' },
  { key: 'other', label: 'O', color: '#95E881' },
]

export function Controls({ mode, onModeChange }) {
  const { 
    isReady, 
    isPlaying, 
    isMicActive,
    mutedStems,
    togglePlay, 
    toggleStemMute,
    reset 
  } = useAudio()

  return (
    <Container>
      {isMicActive && (
        <MicIndicator>
          <PulseDot />
          LIVE MIC
        </MicIndicator>
      )}
      
      {isReady && !isMicActive && (
        <>
          <StemControls>
            {STEM_CONFIG.map(stem => (
              <StemButton
                key={stem.key}
                $color={stem.color}
                $label={stem.key}
                $muted={mutedStems.includes(stem.key)}
                onClick={() => toggleStemMute(stem.key)}
                title={`Toggle ${stem.key}`}
              />
            ))}
          </StemControls>
          
          <PlaybackControls>
            <PlayButton onClick={togglePlay} disabled={!isReady}>
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </PlayButton>
          </PlaybackControls>
        </>
      )}
      
      <ModeToggle>
        <ModeButton 
          $active={mode === 'radial'} 
          onClick={() => onModeChange('radial')}
        >
          Radial
        </ModeButton>
        <ModeButton 
          $active={mode === 'particle'} 
          onClick={() => onModeChange('particle')}
        >
          3D Particles
        </ModeButton>
      </ModeToggle>
      
      {(isReady || isMicActive) && (
        <ResetButton onClick={reset}>
          Reset
        </ResetButton>
      )}
    </Container>
  )
}
