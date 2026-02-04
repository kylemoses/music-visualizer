import { useState, useCallback } from 'react'
import styled from 'styled-components'
import { useAudio } from '../../context/AudioContext'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.xl};
  max-width: 500px;
  width: 100%;
`

const TabContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  padding: ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
`

const Tab = styled.button`
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: 0.875rem;
  font-weight: 500;
  color: ${({ theme, $active }) => $active ? theme.colors.text : theme.colors.textMuted};
  background: ${({ theme, $active }) => $active ? theme.colors.primary : 'transparent'};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme, $active }) => $active ? theme.colors.primary : theme.colors.border};
  }
`

const InputPanel = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const DropZone = styled.div`
  border: 2px dashed ${({ theme, $isDragging }) => 
    $isDragging ? theme.colors.primary : theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.xxl};
  text-align: center;
  background: ${({ theme, $isDragging }) => 
    $isDragging ? `${theme.colors.primary}11` : theme.colors.backgroundSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.primary}11;
  }
`

const DropZoneText = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`

const DropZoneSubtext = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.75rem;
`

const HiddenInput = styled.input`
  display: none;
`

const UrlInput = styled.input`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.text};
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.primary}33;
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textMuted};
  }
`

const Button = styled.button`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.gradientPrimary};
  color: white;
  font-size: 1rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: ${({ theme }) => theme.shadows.glow};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const MicContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  width: 100%;
`

const MicButton = styled.button`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: ${({ theme, $active }) => 
    $active ? theme.colors.error : theme.colors.gradientPrimary};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${({ theme }) => theme.transitions.fast};
  box-shadow: ${({ theme, $active }) => 
    $active ? `0 0 30px ${theme.colors.error}66` : theme.shadows.md};

  &:hover {
    transform: scale(1.05);
  }

  svg {
    width: 32px;
    height: 32px;
    fill: white;
  }
`

const MicHint = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.875rem;
  text-align: center;
  max-width: 300px;
`

const MicIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
  </svg>
)

const StopIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="12" height="12" rx="2"/>
  </svg>
)

export function AudioInput() {
  const [activeTab, setActiveTab] = useState('file')
  const [isDragging, setIsDragging] = useState(false)
  const [soundcloudUrl, setSoundcloudUrl] = useState('')
  const { uploadFile, loadFromUrl, startMicrophone, stopMicrophone, isMicActive } = useAudio()

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) {
      uploadFile(file)
    }
  }, [uploadFile])

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0]
    if (file) {
      uploadFile(file)
    }
  }, [uploadFile])

  const handleSoundcloudSubmit = useCallback(() => {
    if (soundcloudUrl.trim()) {
      loadFromUrl(soundcloudUrl.trim())
    }
  }, [soundcloudUrl, loadFromUrl])

  const handleMicToggle = useCallback(() => {
    if (isMicActive) {
      stopMicrophone()
    } else {
      startMicrophone()
    }
  }, [isMicActive, startMicrophone, stopMicrophone])

  return (
    <Container>
      <TabContainer>
        <Tab $active={activeTab === 'file'} onClick={() => setActiveTab('file')}>
          File Upload
        </Tab>
        <Tab $active={activeTab === 'url'} onClick={() => setActiveTab('url')}>
          SoundCloud
        </Tab>
        <Tab $active={activeTab === 'mic'} onClick={() => setActiveTab('mic')}>
          Microphone
        </Tab>
      </TabContainer>

      <InputPanel>
        {activeTab === 'file' && (
          <>
            <DropZone
              $isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input').click()}
            >
              <DropZoneText>
                Drag & drop an audio file here, or click to browse
              </DropZoneText>
              <DropZoneSubtext>
                Supports MP3, WAV, FLAC
              </DropZoneSubtext>
            </DropZone>
            <HiddenInput
              id="file-input"
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
            />
          </>
        )}

        {activeTab === 'url' && (
          <>
            <UrlInput
              type="url"
              placeholder="Paste SoundCloud URL..."
              value={soundcloudUrl}
              onChange={(e) => setSoundcloudUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSoundcloudSubmit()}
            />
            <Button 
              onClick={handleSoundcloudSubmit}
              disabled={!soundcloudUrl.trim()}
            >
              Load & Process
            </Button>
          </>
        )}

        {activeTab === 'mic' && (
          <MicContainer>
            <MicButton $active={isMicActive} onClick={handleMicToggle}>
              {isMicActive ? <StopIcon /> : <MicIcon />}
            </MicButton>
            <MicHint>
              {isMicActive 
                ? 'Listening... Play audio through your speakers to visualize'
                : 'Use microphone to capture audio playing through your speakers (perfect for Spotify)'}
            </MicHint>
          </MicContainer>
        )}
      </InputPanel>
    </Container>
  )
}
