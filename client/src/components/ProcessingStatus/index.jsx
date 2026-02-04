import styled, { keyframes } from 'styled-components'

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.xl};
  max-width: 400px;
  text-align: center;
`

const SpinnerContainer = styled.div`
  position: relative;
  width: 80px;
  height: 80px;
`

const Spinner = styled.div`
  width: 80px;
  height: 80px;
  border: 3px solid ${({ theme }) => theme.colors.border};
  border-top-color: ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`

const ProgressRing = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  width: 80px;
  height: 80px;
  transform: rotate(-90deg);
`

const ProgressCircle = styled.circle`
  fill: none;
  stroke: ${({ theme }) => theme.colors.primary};
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: ${({ $progress }) => `${$progress * 226} 226`};
  transition: stroke-dasharray 0.3s ease;
`

const StatusText = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`

const StatusSubtext = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.875rem;
  animation: ${pulse} 2s ease-in-out infinite;
`

const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background: ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  overflow: hidden;
`

const ProgressFill = styled.div`
  height: 100%;
  background: ${({ theme }) => theme.colors.gradientPrimary};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  width: ${({ $progress }) => `${$progress * 100}%`};
  transition: width 0.3s ease;
`

const StageList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
`

const Stage = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme, $completed, $active }) => 
    $completed ? theme.colors.success : 
    $active ? theme.colors.text : 
    theme.colors.textMuted};
  font-size: 0.875rem;

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
`

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
  </svg>
)

const DotIcon = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  margin: 0 4px;
`

const STAGES = [
  { key: 'uploading', label: 'Uploading audio file...' },
  { key: 'processing', label: 'Separating stems with Demucs...' },
  { key: 'downloading', label: 'Downloading separated stems...' },
  { key: 'loading', label: 'Loading audio buffers...' },
]

export function ProcessingStatus({ status }) {
  const { stage = 'uploading', progress = 0, message } = status || {}
  
  const currentStageIndex = STAGES.findIndex(s => s.key === stage)
  
  return (
    <Container>
      <SpinnerContainer>
        {progress > 0 ? (
          <ProgressRing viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="#2a2a3a"
              strokeWidth="3"
            />
            <ProgressCircle
              cx="40"
              cy="40"
              r="36"
              $progress={progress}
            />
          </ProgressRing>
        ) : (
          <Spinner />
        )}
      </SpinnerContainer>
      
      <StatusText>Processing Audio</StatusText>
      <StatusSubtext>
        {message || STAGES[currentStageIndex]?.label || 'Please wait...'}
      </StatusSubtext>
      
      <ProgressBar>
        <ProgressFill $progress={progress} />
      </ProgressBar>
      
      <StageList>
        {STAGES.map((s, index) => (
          <Stage 
            key={s.key}
            $completed={index < currentStageIndex}
            $active={index === currentStageIndex}
          >
            {index < currentStageIndex ? <CheckIcon /> : <DotIcon />}
            {s.label}
          </Stage>
        ))}
      </StageList>
    </Container>
  )
}
