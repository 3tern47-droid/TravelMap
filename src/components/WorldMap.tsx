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
  rank: number
  type: string
}

interface StateLabel {
  name: string
  coords: [number, number]
}

const ConstantScaleLabel = ({ name, position, rank, zoom, color = "white", fontSize = 0.4 }: { name: string, position: [number, number, number], rank: number, zoom: number, color?: string, fontSize?: number }) => {
  const ref = useRef<THREE.Group>(null!)
  
  useFrame(() => {
    if (ref.current) {
      const s = 1 / zoom
      ref.current.scale.set(s, s, s)
    }
  })

  return (
    <Billboard ref={ref} position={position}>
      <Text
        fontSize={fontSize}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={fontSize * 0.1}
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
  const [stateLabels, setStateLabels] = useState<StateLabel[]>([])
  const { camera } = useThree()
  const [zoom, setZoom] = useState(2)

  useFrame(() => {
    const currentZoom = (camera as THREE.OrthographicCamera).zoom
    if (Math.abs(zoom - currentZoom) > 0.05) {
      setZoom(currentZoom)
    }
  })

  useEffect(() => {
    // 1. Load Country Polygons (Simplified for speed)
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => {
        setGeoData(data)
        if (onLoad) onLoad()
      })
      .catch(err => onError?.(err.message))

    // 2. Load States/Provinces (High Res)
    fetch('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_admin_1_states_provinces.geojson')
      .then(res => res.json())
      .then(data => {
        setAdminData(data)
        // Extract labels for states
        const labels = data.features.map((f: any) => {
          // Use longitude/latitude from properties if available, else first point
          const coords = f.geometry.type === 'Polygon' 
            ? f.geometry.coordinates[0][0] 
            : f.geometry.coordinates[0][0][0]
          return {
            name: f.properties.name,
            coords: coords as [number, number]
          }
        })
        setStateLabels(labels)
      })
      .catch(err => console.error('States load error:', err))

    // 3. Load Populated Places
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
    return geoMercator().scale(40).translate([0, 0]).center([0, 0])
  }, [])

  // Optimizing borders: Combine all country borders into a single LineSegments object
  const countryBordersGeometry = useMemo(() => {
    if (!geoData) return null
    const points: THREE.Vector3[] = []
    geoData.features.forEach((feature: any) => {
      const coords = feature.geometry.type === 'Polygon' 
        ? [feature.geometry.coordinates] 
        : feature.geometry.coordinates
      
      coords.forEach((polygon: any) => {
        polygon.forEach((ring: any) => {
          for (let i = 0; i < ring.length - 1; i++) {
            const p1 = projection(ring[i])
            const p2 = projection(ring[i+1])
            if (p1 && p2) {
              points.push(new THREE.Vector3(p1[0], -p1[1], 0.05))
              points.push(new THREE.Vector3(p2[0], -p2[1], 0.05))
            }
          }
        })
      })
    })
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [geoData, projection])

  // Optimizing state borders: Combine all into a single LineSegments
  const stateBordersGeometry = useMemo(() => {
    if (!adminData) return null
    const points: THREE.Vector3[] = []
    adminData.features.forEach((feature: any) => {
      const coords = feature.geometry.type === 'Polygon' 
        ? [feature.geometry.coordinates] 
        : feature.geometry.coordinates
      
      coords.forEach((polygon: any) => {
        polygon.forEach((ring: any) => {
          for (let i = 0; i < ring.length - 1; i++) {
            const p1 = projection(ring[i])
            const p2 = projection(ring[i+1])
            if (p1 && p2) {
              points.push(new THREE.Vector3(p1[0], -p1[1], 0.03))
              points.push(new THREE.Vector3(p2[0], -p2[1], 0.03))
            }
          }
        })
      })
    })
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [adminData, projection])

  const countryFills = useMemo(() => {
    if (!geoData) return []
    return geoData.features.map((feature: any, idx: number) => {
      const shapes: THREE.Shape[] = []
      const coords = feature.geometry.type === 'Polygon' 
        ? [feature.geometry.coordinates] 
        : feature.geometry.coordinates
      
      coords.forEach((polygon: any) => {
        const shape = new THREE.Shape()
        polygon.forEach((ring: any, rIdx: number) => {
          const points = ring.map((c: any) => {
            const p = projection(c)
            return p ? new THREE.Vector2(p[0], -p[1]) : null
          }).filter(Boolean)
          
          if (points.length < 3) return
          if (rIdx === 0) {
            shape.moveTo(points[0].x, points[0].y)
            points.slice(1).forEach((p: any) => shape.lineTo(p.x, p.y))
          } else {
            const hole = new THREE.Path()
            hole.moveTo(points[0].x, points[0].y)
            points.slice(1).forEach((p: any) => hole.lineTo(p.x, p.y))
            shape.holes.push(hole)
          }
        })
        shapes.push(shape)
      })

      return (
        <mesh key={`fill-${idx}`} position={[0,0,-0.01]}>
          <shapeGeometry args={[shapes]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} />
        </mesh>
      )
    })
  }, [geoData, projection, color])

  return (
    <group>
      {countryFills}
      
      {countryBordersGeometry && (
        <lineSegments geometry={countryBordersGeometry}>
          <lineBasicMaterial color="white" opacity={0.6} transparent />
        </lineSegments>
      )}

      {stateBordersGeometry && zoom > 3 && (
        <lineSegments geometry={stateBordersGeometry}>
          <lineBasicMaterial 
            color="white" 
            opacity={Math.min(0.3, (zoom - 3) / 10)} 
            transparent 
          />
        </lineSegments>
      )}

      {/* State Labels */}
      {zoom > 5 && stateLabels.map((s, i) => {
        const p = projection(s.coords)
        if (!p) return null
        return (
          <ConstantScaleLabel 
            key={`state-label-${i}`}
            name={s.name}
            position={[p[0], -p[1], 0.04]}
            rank={5}
            zoom={zoom}
            color="#aaaaaa"
            fontSize={0.25}
          />
        )
      })}

      {/* Populated Places */}
      {places.map((place, i) => {
        const visible = place.rank <= 2 || (place.rank <= 5 && zoom > 6) || (place.rank <= 8 && zoom > 10) || zoom > 14
        if (!visible) return null
        const p = projection(place.coords)
        if (!p) return null
        return (
          <ConstantScaleLabel 
            key={`place-${i}`}
            name={place.name}
            position={[p[0], -p[1], 0.1]}
            rank={place.rank}
            zoom={zoom}
            fontSize={place.rank <= 2 ? 0.35 : 0.2}
          />
        )
      })}
    </group>
  )
}

export default WorldMap
