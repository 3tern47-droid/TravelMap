import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { MapControls } from '@react-three/drei'
import WorldMap from './components/WorldMap'
import ColorScale from './components/ColorScale'

function App() {
  const [mapColor, setMapColor] = useState('#d9392e')

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas
        camera={{ position: [0, 0, 300], fov: 60 }}
        style={{ background: 'black' }}
      >
        <color attach="background" args={['black']} />
        <ambientLight intensity={1.5} />
        <WorldMap color={mapColor} />
        <MapControls 
          enableRotate={false} 
          screenSpacePanning={true}
        />
      </Canvas>
      <ColorScale onColorSelect={setMapColor} />
    </div>
  )
}

export default App
