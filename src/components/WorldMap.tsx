import { useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'
import { geoMercator } from 'd3-geo'

interface WorldMapProps {
  color: string
}

const WorldMap = ({ color }: WorldMapProps) => {
  const [geoData, setGeoData] = useState<any>(null)

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/@highcharts/map-collection/custom/world-lowres.geo.json')
      .then(res => res.json())
      .then(data => {
        console.log('GeoData loaded:', data)
        setGeoData(data)
      })
      .catch(err => console.error('Failed to load GeoJSON:', err))
  }, [])

  const projection = useMemo(() => {
    return geoMercator()
      .scale(150) // Increased scale for better visibility
      .translate([0, 0])
  }, [])

  const features = useMemo(() => {
    if (!geoData) return []

    const meshes: JSX.Element[] = []

    geoData.features.forEach((feature: any, featureIndex: number) => {
      const { geometry } = feature
      if (!geometry) return

      const shapes: THREE.Shape[] = []

      if (geometry.type === 'Polygon') {
        const shape = createShape(geometry.coordinates, projection)
        if (shape) shapes.push(shape)
      } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach((coords: any) => {
          const shape = createShape(coords, projection)
          if (shape) shapes.push(shape)
        })
      }

      if (shapes.length > 0) {
        meshes.push(
          <mesh key={`${featureIndex}`} rotation={[0, 0, 0]}>
            <shapeGeometry args={[shapes]} />
            <meshBasicMaterial color={color} side={THREE.DoubleSide} />
          </mesh>
        )
      }
    })

    return meshes
  }, [geoData, color, projection])

  if (!geoData) return null

  return <group>{features}</group>
}

function createShape(coordinates: any[], projection: any): THREE.Shape | null {
  const shape = new THREE.Shape()

  coordinates.forEach((ring: any[], index: number) => {
    const points = ring.map(coord => {
      const projected = projection(coord)
      return new THREE.Vector2(projected[0], -projected[1]) // Invert Y for Three.js
    })

    if (index === 0) {
      // Outer ring
      shape.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].y)
      }
    } else {
      // Holes
      const holePath = new THREE.Path()
      holePath.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        holePath.lineTo(points[i].x, points[i].y)
      }
      shape.holes.push(holePath)
    }
  })

  return shape
}

export default WorldMap
