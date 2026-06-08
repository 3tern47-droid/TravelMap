import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { MapControls } from '@react-three/drei'
import WorldMap from './components/WorldMap'
import ColorScale from './components/ColorScale'

function App() {
  const [mapColor, setMapColor] = useState('#d9392e')
  const [status, setStatus] = useState('Loading map data...')
  
  console.log('App rendering, color:', mapColor, 'status:', status)

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#2a2a2a', position: 'relative', border: '1px solid #333' }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: 'white',
        zIndex: 100,
        fontFamily: 'sans-serif',
        pointerEvents: 'none'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '300', letterSpacing: '2px' }}>TRAVEL MAP</h1>
        <p style={{ margin: '5px 0', opacity: 0.7 }}>{status}</p>
      </div>

      <Canvas
        orthographic
        camera={{ zoom: 2, position: [0, 0, 100] }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={1} />
        
        <WorldMap 
          color={mapColor} 
          onLoad={() => setStatus('Global Exploration Ready')}
          onError={(err) => setStatus(`Error: ${err}`)}
        />

        <MapControls 
          makeDefault
          enableRotate={false}
          enableDamping={true}
          dampingFactor={0.1}
          screenSpacePanning={true}
          minZoom={0.5}
          maxZoom={50}
        />
      </Canvas>
      <ColorScale onColorSelect={setMapColor} />
    </div>
  )
}

export default App
