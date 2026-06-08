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

interface PopulatedPlace {
  name: string
  coords: [number, number]
  rank: number // scalerank 0-10, lower is more important
  type: string
}

// Component for a label that stays the same size on screen
const ConstantScaleLabel = ({ name, position, rank, zoom }: { name: string, position: [number, number, number], rank: number, zoom: number }) => {
  const ref = useRef<THREE.Group>(null!)
  
  // Visibility logic based on zoom and importance (rank)
  // Higher rank = less important = requires higher zoom to see
  const visible = useMemo(() => {
    if (rank <= 2) return true // major cities always visible
    if (rank <= 5) return zoom > 4 // medium cities
    if (rank <= 8) return zoom > 8 // towns
    return zoom > 12 // villages/small places
  }, [rank, zoom])

  useFrame(() => {
    if (ref.current) {
      const s = 1 / zoom
      ref.current.scale.set(s, s, s)
    }
  })

  if (!visible) return null

  return (
    <Billboard ref={ref} position={position}>
      <mesh>
        <circleGeometry args={[rank <= 2 ? 0.15 : 0.08, 16]} />
        <meshBasicMaterial color={rank <= 2 ? '#ffffff' : '#cccccc'} />
      </mesh>
      <Text
        position={[0, 0.4, 0]}
        fontSize={rank <= 2 ? 0.4 : 0.25}
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
  const [places, setPlaces] = useState<PopulatedPlace[]>([])
  const { camera } = useThree()
  const [zoom, setZoom] = useState(2)

  useFrame(() => {
    const currentZoom = (camera as THREE.OrthographicCamera).zoom
    if (Math.abs(zoom - currentZoom) > 0.01) {
      setZoom(currentZoom)
    }
  })

  useEffect(() => {
    // 1. Load Country Polygons (Medium Res)
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => {
        setGeoData(data)
        if (onLoad) onLoad()
      })
      .catch(err => onError?.(err.message))

    // 2. Load States/Provinces (High Res - 10m)
    fetch('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_admin_1_states_provinces.geojson')
      .then(res => res.json())
      .then(data => setAdminData(data))
      .catch(err => console.error('States load error:', err))

    // 3. Load Populated Places (Cities, Towns, Villages)
    fetch('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_populated_places_simple.geojson')
      .then(res => res.json())
      .then(data => {
        const processedPlaces = data.features.map((f: any) => ({
          name: f.properties.name,
          coords: f.geometry.coordinates as [number, number],
          rank: f.properties.scalerank,
          type: f.properties.featurecla
        }))
        setPlaces(processedPlaces)
      })
      .catch(err => console.error('Places load error:', err))
  }, [])

  const projection = useMemo(() => {
    return geoMercator()
      .scale(40) 
      .translate([0, 0])
      .center([0, 0])
  }, [])

  const LineElement = 'line' as any

  const countryElements = useMemo(() => {
    if (!geoData) return []
    const elements: JSX.Element[] = []

    geoData.features.forEach((feature: any, featureIndex: number) => {
      const { geometry } = feature
      if (!geometry) return
      const shapes: THREE.Shape[] = []
      const borders: THREE.Vector3[][] = []

      if (geometry.type === 'Polygon') {
        const result = processPolygon(geometry.coordinates, projection)
        if (result.shape) shapes.push(result.shape)
        if (result.borders) borders.push(...result.borders)
      } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach((coords: any) => {
          const result = processPolygon(coords, projection)
          if (result.shape) shapes.push(result.shape)
          if (result.borders) borders.push(...result.borders)
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

      borders.forEach((points, bIndex) => {
        const borderGeo = new THREE.BufferGeometry().setFromPoints(points)
        elements.push(
          <LineElement key={`country-border-${featureIndex}-${bIndex}`} geometry={borderGeo} position={[0, 0, 0.05]}>
            <lineBasicMaterial color="#ffffff" transparent opacity={0.8} />
          </LineElement>
        )
      })
    })
    return elements
  }, [geoData, color, projection])

  const stateElements = useMemo(() => {
    if (!adminData || zoom < 3) return []
    const elements: JSX.Element[] = []

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
        elements.push(
          <LineElement 
            key={`state-border-${featureIndex}-${bIndex}`} 
            geometry={borderGeo} 
            position={[0, 0, 0.03]}
          >
            <lineBasicMaterial 
              color="#ffffff" 
              transparent 
              opacity={Math.min(0.4, (zoom - 3) / 10)} 
            />
          </LineElement>
        )
      })
    })
    return elements
  }, [adminData, zoom, projection])

  const placeElements = useMemo(() => {
    return places.map((place, index) => {
      const projected = projection(place.coords)
      if (!projected) return null
      return (
        <ConstantScaleLabel 
          key={`place-${index}`}
          name={place.name}
          position={[projected[0], -projected[1], 0.1]}
          rank={place.rank}
          zoom={zoom}
        />
      )
    }).filter(Boolean)
  }, [places, zoom, projection])

  if (!geoData) return null

  return (
    <group>
      {countryElements}
      {stateElements}
      {placeElements}
    </group>
  )
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