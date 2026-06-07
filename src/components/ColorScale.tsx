import React from 'react'

interface ColorScaleProps {
  onColorSelect: (color: string) => void
}

const ColorScale = ({ onColorSelect }: ColorScaleProps) => {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = x / rect.width
    
    // Convert percentage to a color on the rainbow spectrum
    const color = `hsl(${percent * 360}, 100%, 50%)`
    
    // We need to convert HSL to Hex for Three.js meshBasicMaterial if needed, 
    // but Three.js can also handle CSS color strings.
    onColorSelect(color)
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      right: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '8px'
    }}>
      <span style={{ color: 'white', fontSize: '12px', fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Change Map Color
      </span>
      <div 
        style={{
          width: '300px',
          height: '24px',
          borderRadius: '12px',
          background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          cursor: 'pointer',
          boxShadow: '0 0 15px rgba(255, 255, 255, 0.2)',
          border: '2px solid white'
        }}
        onClick={handleClick}
        title="Click to change map color"
      />
    </div>
  )
}

export default ColorScale
