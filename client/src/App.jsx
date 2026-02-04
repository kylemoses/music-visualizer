import styled from 'styled-components'
import { AudioInput } from './components/AudioInput'
import { ProcessingStatus } from './components/ProcessingStatus'
import { Controls } from './components/Controls'
import { ParticleCloud } from './components/Visualizer/ParticleCloud'
import { useAudio } from './context/AudioContext'

const AppContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
`

const Header = styled.header`
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  background: linear-gradient(135deg, 
    ${({ theme }) => theme.colors.drums} 0%, 
    ${({ theme }) => theme.colors.vocals} 50%, 
    ${({ theme }) => theme.colors.bass} 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
`

const VisualizerContainer = styled.div`
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`

const InputOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.background}ee;
  z-index: 10;
`

function App() {
  const { isReady, isProcessing, processingStatus } = useAudio()

  return (
    <AppContainer>
      <Header>
        <Title>Music Visualizer</Title>
        <Controls />
      </Header>
      
      <MainContent>
        <VisualizerContainer>
          <ParticleCloud />
        </VisualizerContainer>
        
        {!isReady && (
          <InputOverlay>
            {isProcessing ? (
              <ProcessingStatus status={processingStatus} />
            ) : (
              <AudioInput />
            )}
          </InputOverlay>
        )}
      </MainContent>
    </AppContainer>
  )
}

export default App
