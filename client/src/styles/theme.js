/**
 * Theme configuration for the music visualizer
 * Stem colors are designed to be visually distinct and aesthetically pleasing
 */
export const theme = {
  colors: {
    // Base colors
    background: '#0a0a0f',
    backgroundSecondary: '#12121a',
    text: '#ffffff',
    textMuted: '#888899',
    border: '#2a2a3a',
    
    // Stem colors
    drums: '#FF6B35',   // Orange
    bass: '#4ECDC4',    // Teal/Cyan
    vocals: '#FF6B9D',  // Pink
    other: '#95E881',   // Green
    
    // UI colors
    primary: '#6366f1',
    primaryHover: '#818cf8',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    
    // Gradients
    gradientPrimary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  },
  
  // Stem color array for iteration
  stemColors: {
    drums: '#FF6B35',
    bass: '#4ECDC4',
    vocals: '#FF6B9D',
    other: '#95E881',
  },
  
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.5)',
    md: '0 4px 6px rgba(0, 0, 0, 0.5)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
    glow: '0 0 20px rgba(99, 102, 241, 0.3)',
  },
  
  transitions: {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '400ms ease',
  },
}
