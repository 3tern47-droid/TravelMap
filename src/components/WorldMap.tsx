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

interface MapFeature {
  name: string
  coords: [number, number]
  rank: number
  type: 'country' | 'state' | 'city' | 'village'
}

const WorldMap = ({ color, onLoad, onError }: WorldMapProps) => {
  const [geoData, setGeoData] = useState<any>(null)
  const [adminData, setAdminData] = useState<any>(null)
  const [places, setPlaces] = useState<any>(null)
  const { camera } = useThree()
  const [zoom, setZoom] = useState(2)

  // 1. Projection - Fixed for consistent coordinates
  const projection = useMemo(() => {
    return geoMercator().scale(40).translate([0, 0]).center([0, 0])
  }, [])

  // 2. Data Loading
  useEffect(() => {
    Promise.all([
      fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson').then(res => res.json()),
      fetch('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_admin_1_states_provinces.geojson').then(res => res.json()),
      fetch('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_populated_places_simple.geojson').then(res => res.json())
    ]).then(([world, states, cities]) => {
      setGeoData(world)
      setAdminData(states)
      setPlaces(cities)
      onLoad?.()
    }).catch(err => onError?.(err.message))
  }, [])

  // 3. Zoom Tracking
  useFrame(() => {
    const z = (camera as THREE.OrthographicCamera).zoom
    if (Math.abs(z - zoom) > 0.01) setZoom(z)
  })

  // 4. Geometry Processing - Optimized for Batching
  const countryBorders = useMemo(() => {
    if (!geoData) return null
    const points: THREE.Vector3[] = []
    processGeoJSON(geoData, (p1, p2) => {
      points.push(new THREE.Vector3(p1[0], -p1[1], 0.05))
      points.push(new THREE.Vector3(p2[0], -p2[1], 0.05))
    }, projection)
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [geoData, projection])

  const stateBorders = useMemo(() => {
    if (!adminData) return null
    const points: THREE.Vector3[] = []
    processGeoJSON(adminData, (p1, p2) => {
      points.push(new THREE.Vector3(p1[0], -p1[1], 0.03))
      points.push(new THREE.Vector3(p2[0], -p2[1], 0.03))
    }, projection)
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [adminData, projection])

  const countryFills = useMemo(() => {
    if (!geoData) return null
    const shapes: THREE.Shape[] = []
    geoData.features.forEach((f: any) => {
      const polyShapes = getShapes(f.geometry, projection)
      shapes.push(...polyShapes)
    })
    return shapes
  }, [geoData, projection])

  // 5. Labels - Smart Filtering for Performance
  const visibleLabels = useMemo(() => {
    const labels: any[] = []
    
    // Add Country Names
    if (geoData) {
      geoData.features.forEach((f: any, i: number) => {
        const coords = getCenter(f.geometry)
        const p = projection(coords)
        if (p) labels.push({ name: f.properties.name, pos: [p[0], -p[1], 0.1], type: 'country', rank: 0 })
      })
    }

    // Add State Names (Only if zoomed in)
    if (adminData && zoom > 6) {
      adminData.features.forEach((f: any, i: number) => {
        const coords = getCenter(f.geometry)
        const p = projection(coords)
        if (p) labels.push({ name: f.properties.name, pos: [p[0], -p[1], 0.08], type: 'state', rank: 5 })
      })
    }

    // Add City/Village Names (Zoom Dependent)
    if (places) {
      places.features.forEach((f: any, i: number) => {
        const rank = f.properties.scalerank
        const visible = rank <= 2 || (rank <= 5 && zoom > 8) || (rank <= 8 && zoom > 12) || zoom > 18
        if (visible) {
          const p = projection(f.geometry.coordinates)
          if (p) labels.push({ name: f.properties.name, pos: [p[0], -p[1], 0.12], type: 'place', rank })
        }
      })
    }

    return labels
  }, [geoData, adminData, places, zoom, projection])

  return (
    <group>
      {/* 1. Country Fills - Minimal Draw Calls */}
      {countryFills && (
        <mesh position={[0,0,-0.01]}>
          <shapeGeometry args={[countryFills]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* 2. Country Borders - Batched */}
      {countryBorders && (
        <lineSegments geometry={countryBorders}>
          <lineBasicMaterial color="#ffffff" opacity={0.8} transparent />
        </lineSegments>
      )}

      {/* 3. State Borders - Batched & Zoom Sensitive */}
      {stateBorders && zoom > 3 && (
        <lineSegments geometry={stateBorders}>
          <lineBasicMaterial 
            color="#ffffff" 
            opacity={Math.min(0.4, (zoom - 3) / 10)} 
            transparent 
          />
        </lineSegments>
      )}

      {/* 4. Labels - Only the necessary ones */}
      {visibleLabels.map((l, i) => (
        <Billboard key={`${l.type}-${i}`} position={l.pos} scale={1/zoom}>
          <Text
            fontSize={l.type === 'country' ? 0.6 : l.type === 'state' ? 0.4 : 0.25}
            color={l.type === 'country' ? '#ffffff' : l.type === 'state' ? '#dddddd' : '#aaaaaa'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#000000"
          >
            {l.name}
          </Text>
        </Billboard>
      ))}
    </group>
  )
}

// Helper: Process GeoJSON into line pairs for LineSegments
function processGeoJSON(data: any, onLine: (p1: any, p2: any) => void, projection: any) {
  data.features.forEach((f: any) => {
    const coords = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    coords.forEach((poly: any) => {
      poly.forEach((ring: any) => {
        for (let i = 0; i < ring.length - 1; i++) {
          const p1 = projection(ring[i])
          const p2 = projection(ring[i+1])
          if (p1 && p2) onLine(p1, p2)
        }
      })
    })
  })
}

// Helper: Convert GeoJSON Geometry to Three.js Shapes
function getShapes(geometry: any, projection: any): THREE.Shape[] {
  const shapes: THREE.Shape[] = []
  const coords = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  coords.forEach((poly: any) => {
    const shape = new THREE.Shape()
    poly.forEach((ring: any, i: number) => {
      const pts = ring.map((c: any) => {
        const p = projection(c)
        return p ? new THREE.Vector2(p[0], -p[1]) : null
      }).filter(Boolean)
      if (pts.length < 3) return
      if (i === 0) {
        shape.moveTo(pts[0].x, pts[0].y)
        pts.slice(1).forEach((p: any) => shape.lineTo(p.x, p.y))
      } else {
        const hole = new THREE.Path()
        hole.moveTo(pts[0].x, pts[0].y)
        pts.slice(1).forEach((p: any) => hole.lineTo(p.x, p.y))
        shape.holes.push(hole)
      }
    })
    shapes.push(shape)
  })
  return shapes
}

// Helper: Get rough center for labels
function getCenter(geometry: any): [number, number] {
  if (geometry.type === 'Point') return geometry.coordinates
  const ring = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0]
  let x = 0, y = 0
  ring.forEach((c: any) => { x += c[0]; y += c[1] })
  return [x / ring.length, y / ring.length]
}

export default WorldMap
