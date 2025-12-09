import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Coordinate } from '../services/api'

interface HeatmapGeoJSON extends GeoJSON.FeatureCollection {
  features: GeoJSON.Feature[]
}

interface MapProps {
  start?: Coordinate | null
  end?: Coordinate | null
  route?: Coordinate[]
  safestRoute?: Coordinate[]
  fastestRoute?: Coordinate[]
  currentLocation?: Coordinate | null
  onSegmentClick?: (segmentId: number, lngLat: { lng: number; lat: number }) => void
  height?: string
  heatmapData?: HeatmapGeoJSON | null
  showHeatmap?: boolean
  ratingMode?: boolean
}

export default function Map({
  start,
  end,
  safestRoute,
  fastestRoute,
  currentLocation,
  onSegmentClick,
  height = '600px',
  heatmapData,
  showHeatmap = true,
  ratingMode = false,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const mapLoaded = useRef(false)

  // Chennai default center
  const defaultCenter: [number, number] = [80.2707, 13.0827]
  const defaultZoom = 14

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: defaultCenter,
      zoom: defaultZoom
    })

    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right')

    mapInstance.on('load', () => {
      mapLoaded.current = true
      console.log('[MAP] Style loaded')
    })

    map.current = mapInstance

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
        mapLoaded.current = false
      }
    }
  }, [])

  // Helper to run code when map is ready
  const whenMapReady = (callback: () => void) => {
    if (!map.current) return
    if (mapLoaded.current) {
      callback()
    } else {
      map.current.once('load', callback)
    }
  }

  // Update routes when they change
  useEffect(() => {
    whenMapReady(() => {
      if (!map.current) return

      console.log('[MAP] Adding routes:', {
        safest: safestRoute?.length || 0,
        fastest: fastestRoute?.length || 0
      })

      // Remove old routes
      try {
        if (map.current.getLayer('safest-route')) map.current.removeLayer('safest-route')
        if (map.current.getSource('safest-route')) map.current.removeSource('safest-route')
        if (map.current.getLayer('fastest-route')) map.current.removeLayer('fastest-route')
        if (map.current.getSource('fastest-route')) map.current.removeSource('fastest-route')
      } catch (e: unknown) {
        // Ignore errors if layers don't exist
      }

      // Add fastest route (purple dashed)
      if (fastestRoute && fastestRoute.length > 1) {
        map.current.addSource('fastest-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: fastestRoute.map(c => [c.lon, c.lat])
            }
          }
        })

        map.current.addLayer({
          id: 'fastest-route',
          type: 'line',
          source: 'fastest-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#9333ea',
            'line-width': 6,
            'line-opacity': 0.8,
            'line-dasharray': [2, 1]
          }
        })
      }

      // Add safest route (cyan solid)
      if (safestRoute && safestRoute.length > 1) {
        map.current.addSource('safest-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: safestRoute.map(c => [c.lon, c.lat])
            }
          }
        })

        map.current.addLayer({
          id: 'safest-route',
          type: 'line',
          source: 'safest-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#06b6d4',
            'line-width': 8,
            'line-opacity': 0.9
          }
        })
      }

      // Fit to route bounds
      const routeToFit = safestRoute?.length ? safestRoute : fastestRoute
      if (routeToFit && routeToFit.length > 1) {
        const bounds = new maplibregl.LngLatBounds()
        routeToFit.forEach(c => bounds.extend([c.lon, c.lat]))
        map.current.fitBounds(bounds, { padding: 80 })
      }
    })
  }, [safestRoute, fastestRoute])

  // Update heatmap
  useEffect(() => {
    if (!heatmapData) return

    whenMapReady(() => {
      if (!map.current) return

      try {
        if (map.current.getLayer('safety-heatmap')) map.current.removeLayer('safety-heatmap')
        if (map.current.getSource('safety-data')) map.current.removeSource('safety-data')
      } catch (e: unknown) { }

      if (!showHeatmap) return

      map.current.addSource('safety-data', {
        type: 'geojson',
        data: heatmapData as GeoJSON.FeatureCollection
      })

      map.current.addLayer({
        id: 'safety-heatmap',
        type: 'line',
        source: 'safety-data',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['==', ['get', 'color'], '#666666'], 2, 5],
          'line-opacity': ['case', ['==', ['get', 'color'], '#666666'], 0.4, 0.9]
        }
      })

      if (ratingMode && onSegmentClick) {
        map.current.on('click', 'safety-heatmap', (e: maplibregl.MapMouseEvent) => {
          const features = map.current?.queryRenderedFeatures(e.point, {
            layers: ['safety-heatmap']
          })
          if (features?.[0]?.properties?.segment_id) {
            onSegmentClick(features[0].properties.segment_id, e.lngLat)
          }
        })
      }
    })
  }, [heatmapData, showHeatmap, ratingMode, onSegmentClick])

  // Update markers
  useEffect(() => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    if (!map.current) return

    // Start marker (green)
    if (start) {
      const el = document.createElement('div')
      el.innerHTML = `<svg width="32" height="48" viewBox="0 0 25 41"><path fill="#10b981" stroke="#fff" stroke-width="2" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.1 12.5 28.5 12.5 28.5S25 20.6 25 12.5C25 5.6 19.4 0 12.5 0zm0 17c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5z"/></svg>`
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([start.lon, start.lat])
        .addTo(map.current)
      markersRef.current.push(marker)
    }

    // End marker (red)
    if (end) {
      const el = document.createElement('div')
      el.innerHTML = `<svg width="32" height="48" viewBox="0 0 25 41"><path fill="#ef4444" stroke="#fff" stroke-width="2" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.1 12.5 28.5 12.5 28.5S25 20.6 25 12.5C25 5.6 19.4 0 12.5 0zm0 17c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5z"/></svg>`
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([end.lon, end.lat])
        .addTo(map.current)
      markersRef.current.push(marker)
    }

    // Current location (blue dot)
    if (currentLocation && !start && !end) {
      const el = document.createElement('div')
      el.innerHTML = `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.5);"></div>`
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([currentLocation.lon, currentLocation.lat])
        .addTo(map.current)
      markersRef.current.push(marker)
    }
  }, [start, end, currentLocation])

  return (
    <div className="w-full rounded-xl overflow-hidden shadow-lg border border-gray-200" style={{ height }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
