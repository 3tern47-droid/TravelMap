import { useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'
import { geoPath, geoMercator } from 'd3-geo'

interface WorldMapProps {
  color: string
}

const WorldMap = ({ color }: WorldMapProps) => {
  const [geoData, setGeoData] = useState<any>(null)

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/@highcharts/map-collection/custom/world-lowres.geo.json')
      .then(res => res.json())
      .then(data => setGeoData(data))
  }, [])

  const shapes = useMemo(() => {
    if (!geoData) return []

    // Use Mercator projection and scale it to fit the view
    const projection = geoMercator().scale(20).translate([0, 0])
    const pathGenerator = geoPath().projection(projection)

    return geoData.features.map((feature: any, index: number) => {
      const path = pathGenerator(feature)
      if (!path) return null

      // Convert SVG path to Three.js shapes
      const svgShapes = transformPathToShapes(path)
      
      return (
        <mesh key={index} rotation={[Math.PI, 0, 0]}>
          <shapeGeometry args={[svgShapes]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} />
        </mesh>
      )
    }).filter(Boolean)
  }, [geoData, color])

  if (!geoData) return null

  return <group>{shapes}</group>
}

// Helper to convert SVG path string to Three.js Shapes
function transformPathToShapes(pathStr: string): THREE.Shape[] {
  const shapes: THREE.Shape[] = []
  const commands = pathStr.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || []
  
  let currentShape: THREE.Shape | null = null
  let x = 0, y = 0

  commands.forEach(cmd => {
    const type = cmd[0].toUpperCase()
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number)

    switch (type) {
      case 'M':
        if (currentShape) shapes.push(currentShape)
        currentShape = new THREE.Shape()
        x = args[0]
        y = args[1]
        currentShape.moveTo(x, y)
        break
      case 'L':
        if (currentShape) {
          x = args[0]
          y = args[1]
          currentShape.lineTo(x, y)
        }
        break
      case 'H':
        if (currentShape) {
          x = args[0]
          currentShape.lineTo(x, y)
        }
        break
      case 'V':
        if (currentShape) {
          y = args[0]
          currentShape.lineTo(x, y)
        }
        break
      case 'Z':
        if (currentShape) {
          currentShape.closePath()
        }
        break
      // Simplified: only M, L, H, V, Z are common in low-res GeoJSON paths
    }
  })

  if (currentShape) shapes.push(currentShape)
  return shapes
}

export default WorldMap
