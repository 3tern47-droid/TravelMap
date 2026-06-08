import { useEffect, useState, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { geoMercator } from 'd3-geo'
import { Text, Billboard } from '@react-three/drei'
import { useThree, useFrame } from '@react-three/fiber'

interface WorldMapProps {
  color: string
  onLoad?: () => void
  onError?: (error: string) => void
}

const LANDMARKS = [
  { name: 'Paris', coords: [2.3522, 48.8566] as [number, number], type: 'city' },
  { name: 'New York', coords: [-74.006, 40.7128] as [number, number], type: 'city' },
  { name: 'Tokyo', coords: [139.6503, 35.6762] as [number, number], type: 'city' },
  { name: 'London', coords: [-0.1278, 51.5074] as [number, number], type: 'city' },
  { name: 'Sydney', coords: [151.2093, -33.8688] as [number, number], type: 'city' },
  { name: 'Cairo', coords: [31.2357, 30.0444] as [number, number], type: 'city' },
  { name: 'Rio de Janeiro', coords: [-43.1729, -22.9068] as [number, number], type: 'city' },
  { name: 'Beijing', coords: [116.4074, 39.9042] as [number, number], type: 'city' },
  { name: 'Moscow', coords: [37.6173, 55.7558] as [number, number], type: 'city' },
  { name: 'Mumbai', coords: [72.8777, 19.0760] as [number, number], type: 'city' },
  { name: 'Cape Town', coords: [18.4233, -33.9249] as [number, number], type: 'city' },
  { name: 'Mexico City', coords: [-99.1332, 19.4326] as [number, number], type: 'city' },
  // Adding more "villages" / local places
  { name: 'Versailles', coords: [2.1301, 48.8014] as [number, number], type: 'village' },
  { name: 'Hoboken', coords: [-74.0324, 40.7440] as [number, number], type: 'village' },
  { name: 'Yokohama', coords: [139.6380, 35.4437] as [number, number], type: 'village' },
  { name: 'Cambridge', coords: [0.1218, 52.2053] as [number, number], type: 'village' },
  { name: 'Byron Bay', coords: [153.6120, -28.6474] as [number, number], type: 'village' },
  { name: 'Giza', coords: [31.2132, 30.0131] as [number, number], type: 'village' },
  { name: 'Niteroi', coords: [-43.1244, -22.8859] as [number, number], type: 'village' },
  { name: 'Tianjin', coords: [117.2008, 39.0842] as [number, number], type: 'village' },
]

// Component for a label that stays the same size on screen
const ConstantScaleLabel = ({ name, position, type }: { name: string, position: [number, number, number], type: string }) => {
  const ref = useRef<THREE.Group>(null!)
  const { camera } = useThree()

  useFrame(() => {
    if (ref.current) {
      const zoom = (camera as THREE.OrthographicCamera).zoom
      const s = 1 / zoom
      ref.current.scale.set(s, s, s)
      
      // Hide village labels if zoomed out
      if (type === 'village') {
        ref.current.visible = zoom > 6
      }
    }
  })

  return (
    <Billboard ref={ref} position={position}>
      <mesh>
        <circleGeometry args={[type === 'city' ? 0.15 : 0.1, 16]} />
        <meshBasicMaterial color={type === 'city' ? '#ffffff' : '#aaaaaa'} />
      </mesh>
      <Text
        position={[0, 0.4, 0]}
        fontSize={type === 'city' ? 0.4 : 0.3}
        color="white"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {name}
      </Text>
    </Billboard>
  )
}

const WorldMap = ({ color, onLoad, onError }: WorldMapProps) => {
  const [geoData, setGeoData] = useState<any>(null)
  const [adminData, setAdminData] = useState<any>(null)
  const { camera } = useThree()
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const updateZoom = () => {
      if ((camera as THREE.OrthographicCamera).zoom) {
        setZoom((camera as THREE.OrthographicCamera).zoom)
      }
    }
    const interval = setInterval(updateZoom, 100)
    return () => clearInterval(interval)
  }, [camera])

  useEffect(() => {
    // Load country boundaries
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => {
        setGeoData(data)
        if (onLoad) onLoad()
      })
      .catch(err => {
        if (onError) onError(err.message)
      })

    // Load admin-1 boundaries (States/Provinces) for detail
    // Using a simplified version to maintain performance
    fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_1_states_provinces.geojson')
      .then(res => res.json())
      .then(data => {
        console.log('Admin-1 data loaded:', data.features.length)
        setAdminData(data)
      })
      .catch(err => console.error('Failed to load admin-1 data:', err))
  }, [onLoad, onError])

  const projection = useMemo(() => {
    return geoMercator()
      .scale(40) 
      .translate([0, 0])
      .center([0, 0])
  }, [])

  const mapElements = useMemo(() => {
    if (!geoData) return []
    const elements: JSX.Element[] = []

    // 1. Countries Fill
    geoData.features.forEach((feature: any, featureIndex: number) => {
      const { geometry } = feature
      if (!geometry) return
      const shapes: THREE.Shape[] = []
      if (geometry.type === 'Polygon') {
        const result = processPolygon(geometry.coordinates, projection)
        if (result.shape) shapes.push(result.shape)
      } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach((coords: any) => {
          const result = processPolygon(coords, projection)
          if (result.shape) shapes.push(result.shape)
        })
      }
      if (shapes.length > 0) {
        elements.push(
          <mesh key={`country-fill-${featureIndex}`} position={[0, 0, -0.01]}>
            <shapeGeometry args={[shapes]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
          </mesh>
        )
      }
    })

    // 2. Political Borders (Country Level)
    geoData.features.forEach((feature: any, featureIndex: number) => {
      const { geometry } = feature
      if (!geometry) return
      const borders: THREE.Vector3[][] = []
      if (geometry.type === 'Polygon') {
        const result = processPolygon(geometry.coordinates, projection)
        if (result.borders) borders.push(...result.borders)
      } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach((coords: any) => {
          const result = processPolygon(coords, projection)
          if (result.borders) borders.push(...result.borders)
        })
      }
      borders.forEach((points, bIndex) => {
        const borderGeo = new THREE.BufferGeometry().setFromPoints(points)
        const LineElement = 'line' as any
        elements.push(
          <LineElement key={`border-country-${featureIndex}-${bIndex}`} geometry={borderGeo} position={[0, 0, 0.05]}>
            <lineBasicMaterial color="#ffffff" transparent opacity={0.6} />
          </LineElement>
        )
      })
    })

    // 3. States/Provinces (Admin-1) - Adaptive Visibility
    if (adminData && zoom > 4) {
      adminData.features.forEach((feature: any, featureIndex: number) => {
        const { geometry } = feature
        if (!geometry) return
        const borders: THREE.Vector3[][] = []
        if (geometry.type === 'Polygon') {
          const result = processPolygon(geometry.coordinates, projection)
          if (result.borders) borders.push(...result.borders)
        } else if (geometry.type === 'MultiPolygon') {
          geometry.coordinates.forEach((coords: any) => {
            const result = processPolygon(coords, projection)
            if (result.borders) borders.push(...result.borders)
          })
        }
        borders.forEach((points, bIndex) => {
          const borderGeo = new THREE.BufferGeometry().setFromPoints(points)
          const LineElement = 'line' as any
          elements.push(
            <LineElement key={`border-state-${featureIndex}-${bIndex}`} geometry={borderGeo} position={[0, 0, 0.04]}>
              <lineBasicMaterial color="#ffffff" transparent opacity={0.2} />
            </LineElement>
          )
        })
      })
    }

    // 4. Landmarks / Cities
    LANDMARKS.forEach((landmark, index) => {
      const projected = projection(landmark.coords)
      if (projected) {
        const x = projected[0]
        const y = -projected[1]
        elements.push(
          <ConstantScaleLabel 
            key={`landmark-${index}`} 
            name={landmark.name} 
            position={[x, y, 0.1]} 
            type={landmark.type}
          />
        )
      }
    })

    return elements
  }, [geoData, adminData, color, projection, zoom])

  if (!geoData) return null

  return <group>{mapElements}</group>
}

function processPolygon(coordinates: any[], projection: any) {
  const shape = new THREE.Shape()
  const borders: THREE.Vector3[][] = []

  coordinates.forEach((ring: any[], index: number) => {
    if (!Array.isArray(ring) || ring.length < 3) return

    const points = ring.map(coord => {
      const projected = projection(coord)
      return projected ? new THREE.Vector2(projected[0], -projected[1]) : null
    }).filter((p): p is THREE.Vector2 => p !== null)

    if (points.length < 3) return

    const borderPts = points.map(p => new THREE.Vector3(p.x, p.y, 0))
    borderPts.push(borderPts[0].clone())
    borders.push(borderPts)

    if (index === 0) {
      shape.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].y)
      }
      shape.closePath()
    } else {
      const holePath = new THREE.Path()
      holePath.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        holePath.lineTo(points[i].x, points[i].y)
      }
      holePath.closePath()
      shape.holes.push(holePath)
    }
  })

  return { shape, borders }
}

export default WorldMap
