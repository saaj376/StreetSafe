import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Navigation, Shield, AlertTriangle, Radio, X } from 'lucide-react'
import Map from '../components/Map'
import {
  calculateRoute,
  checkSafetyStatus,
  activateSOS,
  updateLocation,
  deactivateSOS,
  healthCheck,
  Coordinate,
  RouteResponse,
  AlertResponse,
} from '../services/api'
import { geocodeLocation, searchLocations, GeocodingResult } from '../services/geocoding'
import clsx from 'clsx'

type RouteMode = 'safe' | 'balanced' | 'stealth' | 'escort'

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [startLocation, setStartLocation] = useState<string>('')
  const [endLocation, setEndLocation] = useState<string>('')
  const [start, setStart] = useState<Coordinate | null>(null)
  const [end, setEnd] = useState<Coordinate | null>(null)
  const [geocodingLoading, setGeocodingLoading] = useState(false)
  const [startSuggestions, setStartSuggestions] = useState<GeocodingResult[]>([])
  const [endSuggestions, setEndSuggestions] = useState<GeocodingResult[]>([])
  const [route, setRoute] = useState<Coordinate[]>([])
  const [mode, setMode] = useState<RouteMode>('safe')
  const [loading, setLoading] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null)
  const [sosActive, setSosActive] = useState(false)
  const [sosToken, setSosToken] = useState<string | null>(null)
  const [alertResponse, setAlertResponse] = useState<AlertResponse | null>(null)
  const [routeInfo, setRouteInfo] = useState<{ distance: number; mode: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null)
  const [spacebarPresses, setSpacebarPresses] = useState(0)

  const monitoringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sosIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startSuggestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endSuggestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigationStartedRef = useRef<boolean>(false)
  const spacebarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check for POI location in URL params
  useEffect(() => {
    const lat = searchParams.get('lat')
    const lon = searchParams.get('lon')
    const name = searchParams.get('name')

    if (lat && lon) {
      const coordinate: Coordinate = {
        lat: parseFloat(lat),
        lon: parseFloat(lon)
      }
      setEnd(coordinate)
      if (name) {
        setEndLocation(name)
      }
      // Clear the params after setting
      setSearchParams({})
    }
  }, [searchParams, setSearchParams])

  // Check backend connection on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await healthCheck()
        setBackendConnected(true)
      } catch (error) {
        setBackendConnected(false)
        setError('Backend server is not reachable. Please ensure it is running on http://localhost:8000')
      }
    }
    checkBackend()
  }, [])

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          })
          if (!start) {
            setStart({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            })
          }
        },
        (error) => {
          console.error('Error getting location:', error)
        }
      )
    }
  }, [])

  const handleCalculateRoute = async () => {
    if (!start || !end) {
      setError('Please set both start and end points')
      setTimeout(() => setError(null), 5000)
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log(`[FRONTEND] Calculating ${mode} route from (${start.lat}, ${start.lon}) to (${end.lat}, ${end.lon})`)

      const response: RouteResponse = await calculateRoute(mode, {
        start_lat: start.lat,
        start_lon: start.lon,
        end_lat: end.lat,
        end_lon: end.lon,
      })

      console.log(`[FRONTEND] Route received: ${response.route_coords.length} waypoints, ${response.distance_approx_km} km, mode: ${response.mode_used}`)

      if (!response.route_coords || response.route_coords.length === 0) {
        throw new Error('Route calculation returned empty coordinates')
      }

      setRoute(response.route_coords)
      setRouteInfo({
        distance: response.distance_approx_km,
        mode: response.mode_used,
      })
      startNavigation(response.route_coords, {
        distanceKm: response.distance_approx_km,
        mode,
      })

      // Start monitoring if route is active
      startMonitoring(response.route_coords)
    } catch (error: any) {
      console.error('[FRONTEND] Error calculating route:', error)
      const errorMessage = error.response?.data?.detail
        || error.message
        || 'Failed to calculate route. Please check if the backend server is running.'
      setError(errorMessage)
      setRoute([]) // Clear any previous route
      setRouteInfo(null)
      navigationStartedRef.current = false
    } finally {
      setLoading(false)
    }
  }

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(text)
    window.speechSynthesis.speak(utterance)
  }

  const calculateBearing = (a: Coordinate, b: Coordinate) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const dLon = toRad(b.lon - a.lon)
    const y = Math.sin(dLon) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    const bearing = (Math.atan2(y, x) * 180) / Math.PI
    return (bearing + 360) % 360
  }

  const bearingToDirection = (bearing: number) => {
    const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']
    const index = Math.round(bearing / 45) % 8
    return directions[index]
  }

  const segmentDistanceKm = (a: Coordinate, b: Coordinate) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const R = 6371 // km
    const dLat = toRad(b.lat - a.lat)
    const dLon = toRad(b.lon - a.lon)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  }

  const startNavigation = (
    routeCoords: Coordinate[],
    summary?: { distanceKm?: number; mode?: RouteMode }
  ) => {
    if (!routeCoords.length) return
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    // Avoid restarting the prompt if the same route is re-set
    if (navigationStartedRef.current) {
      window.speechSynthesis.cancel()
    }

    navigationStartedRef.current = true
    const messages: string[] = []

    const distancePart = summary?.distanceKm
      ? `about ${summary.distanceKm.toFixed(1)} kilometers`
      : 'the planned route'

    messages.push(
      `Starting ${summary?.mode || 'safe'} navigation. Route is ${distancePart}.`
    )

    if (routeCoords.length >= 2) {
      const first = routeCoords[0]
      const second = routeCoords[1]
      const bearing = calculateBearing(first, second)
      const direction = bearingToDirection(bearing)
      const legDistance = segmentDistanceKm(first, second)
      messages.push(
        `Head ${direction} on the first segment for roughly ${legDistance.toFixed(2)} kilometers.`
      )
    }

    messages.push('Navigation voice prompts are active. Watch for safety alerts during your trip.')

    messages.forEach((text) => speak(text))
  }

  const startMonitoring = (routeCoords: Coordinate[]) => {
    // Clear existing interval
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current)
    }

    // Check safety status every 10 seconds
    monitoringIntervalRef.current = setInterval(async () => {
      if (!currentLocation || routeCoords.length === 0) return

      try {
        const alertResponse = await checkSafetyStatus({
          user_id: 'user_123', // In real app, get from auth
          current_lat: currentLocation.lat,
          current_lon: currentLocation.lon,
          planned_route_coords: routeCoords.map(c => [c.lat, c.lon] as [number, number]),
          planned_route_nodes: [], // Would need to be calculated from route
          mode_used: mode,
        })

        if (alertResponse.alert_type) {
          setAlertResponse(alertResponse)
        }
      } catch (error) {
        console.error('Error checking safety status:', error)
      }
    }, 10000)
  }

  const handleActivateSOS = async () => {
    if (!currentLocation) {
      alert('Unable to get your location. Please enable location services.')
      return
    }

    // Send WhatsApp message with live location immediately
    const mapsLink = `https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lon}`
    const message = `SOS activated via SafeRoute. My location: ${currentLocation.lat.toFixed(5)}, ${currentLocation.lon.toFixed(5)}. ${mapsLink}`
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/919444082981?text=${encodedMessage}`
    window.open(whatsappUrl, '_blank')

    // Set SOS as active in UI
    setSosActive(true)
    setSosToken('sos_' + Date.now())
  }

  const sendWhatsAppSOS = (location: Coordinate) => {
    const mapsLink = `https://maps.google.com/?q=${location.lat},${location.lon}`
    const message = `SOS activated via SafeRoute. My location: ${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}. ${mapsLink}`
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/919444082981?text=${encodedMessage}`
    window.open(whatsappUrl, '_blank')
  }

  const handleSpacebarPress = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !sosActive) {
      e.preventDefault()

      // Clear previous timeout if exists
      if (spacebarTimeoutRef.current) {
        clearTimeout(spacebarTimeoutRef.current)
      }

      // Increment spacebar press count
      setSpacebarPresses(prev => {
        const newCount = prev + 1

        // Reset after 2 seconds of inactivity
        spacebarTimeoutRef.current = setTimeout(() => {
          setSpacebarPresses(0)
        }, 2000)

        // Trigger SOS on 3rd press
        if (newCount === 3) {
          setSpacebarPresses(0)
          handleActivateSOS()
        }

        return newCount
      })
    }
  }

  const handleDeactivateSOS = async () => {
    if (!sosToken) return

    try {
      setSosActive(false)
      setSosToken(null)

      if (sosIntervalRef.current) {
        clearInterval(sosIntervalRef.current)
      }
    } catch (error: any) {
      console.error('Error deactivating SOS:', error)
    }
  }

  // Add keyboard listener for spacebar SOS trigger
  useEffect(() => {
    window.addEventListener('keydown', handleSpacebarPress)
    return () => {
      window.removeEventListener('keydown', handleSpacebarPress)
    }
  }, [sosActive])

  useEffect(() => {
    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current)
      }
      if (sosIntervalRef.current) {
        clearInterval(sosIntervalRef.current)
      }
    }
  }, [])

  const modeOptions: { value: RouteMode; label: string; description: string; icon: any }[] = [
    { value: 'safe', label: 'Safe', description: 'Maximum safety priority', icon: Shield },
    { value: 'balanced', label: 'Balanced', description: 'Balance safety and speed', icon: Navigation },
    { value: 'stealth', label: 'Stealth', description: 'Minimize visibility', icon: Radio },
    { value: 'escort', label: 'Escort', description: 'Maximum protection mode', icon: Shield },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              SafeRoute Planner
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Intelligent safety routing with real-time hazard monitoring
            </p>
            <p className="text-sm text-primary-600 mt-1">
              📍 Currently serving Chennai, Tamil Nadu, India
            </p>
          </div>
          {backendConnected !== null && (
            <div className="flex items-center space-x-2">
              <div className={`h-3 w-3 rounded-full ${backendConnected ? 'bg-success-500' : 'bg-danger-500'}`} />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {backendConnected ? 'Backend Connected' : 'Backend Offline'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 card bg-danger-50 border-danger-200">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-danger-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-danger-900">Error</h3>
                <p className="text-danger-700 mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-danger-600 hover:text-danger-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Alert Banner */}
      {alertResponse && alertResponse.alert_type && (
        <div className="mb-6 card bg-danger-50 border-danger-200">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-danger-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-danger-900">{alertResponse.alert_type}</h3>
                <p className="text-danger-700 mt-1">{alertResponse.message}</p>
                {alertResponse.action_required && (
                  <button
                    onClick={() => {
                      setAlertResponse(null)
                      // Trigger reroute logic here
                    }}
                    className="mt-2 btn btn-danger text-sm"
                  >
                    Reroute Now
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setAlertResponse(null)}
              className="text-danger-600 hover:text-danger-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* SOS Status */}
      {sosActive && sosToken && (
        <div className="mb-6 card bg-danger-50 border-danger-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-3 w-3 bg-danger-600 rounded-full animate-pulse" />
              <div>
                <h3 className="font-semibold text-danger-900">SOS Active</h3>
                <p className="text-sm text-danger-700">
                  Share this link with guardians: {window.location.origin}/guardian/{sosToken}
                </p>
              </div>
            </div>
            <button onClick={handleDeactivateSOS} className="btn btn-danger">
              Deactivate
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Route Mode Selection */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Route Mode</h2>
            <div className="grid grid-cols-2 gap-3">
              {modeOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    onClick={() => setMode(option.value)}
                    className={clsx(
                      'p-4 rounded-lg border-2 transition-all text-left',
                      mode === option.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-navy-800'
                        : 'border-gray-200 hover:border-gray-300 dark:border-navy-700 dark:hover:border-navy-600'
                    )}
                  >
                    <Icon className="h-5 w-5 mb-2 text-primary-600" />
                    <div className="font-medium text-sm dark:text-gray-200">{option.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{option.description}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Start/End Points */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Route Points</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Point
                </label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Enter start location (e.g., 'Marina Beach', 'T Nagar', 'Anna Nagar')"
                      value={startLocation}
                      onChange={(e) => {
                        const value = e.target.value
                        setStartLocation(value)
                        if (startSuggestTimeout.current) clearTimeout(startSuggestTimeout.current)
                        if (!value.trim()) {
                          setStartSuggestions([])
                          return
                        }
                        startSuggestTimeout.current = setTimeout(async () => {
                          const results = await searchLocations(value)
                          setStartSuggestions(results)
                        }, 250)
                      }}
                      className="input w-full"
                      autoComplete="off"
                    />
                    {startSuggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                        {startSuggestions.map((s) => (
                          <button
                            key={`${s.lat}-${s.lon}`}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                            onClick={() => {
                              setStart({ lat: s.lat, lon: s.lon })
                              setStartLocation(s.name)
                              setStartSuggestions([])
                            }}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      setGeocodingLoading(true)
                      const result = await geocodeLocation(startLocation)
                      if (result) {
                        setStart({ lat: result.lat, lon: result.lon })
                        setStartLocation(result.name)
                        setStartSuggestions([])
                      } else {
                        setError('Location not found. Please try another search.')
                      }
                      setGeocodingLoading(false)
                    }}
                    disabled={geocodingLoading || !startLocation.trim()}
                    className="btn btn-secondary disabled:opacity-50"
                  >
                    Search
                  </button>
                </div>
                {currentLocation && (
                  <button
                    onClick={() => {
                      setStart(currentLocation)
                      setStartLocation('Current Location')
                      setStartSuggestions([])
                    }}
                    className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                  >
                    Use Current Location
                  </button>
                )}
                {start && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    ✓ Set to ({start.lat.toFixed(4)}, {start.lon.toFixed(4)})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Point
                </label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Enter end location (e.g., 'Chennai Central', 'Adyar', 'Velachery')"
                      value={endLocation}
                      onChange={(e) => {
                        const value = e.target.value
                        setEndLocation(value)
                        if (endSuggestTimeout.current) clearTimeout(endSuggestTimeout.current)
                        if (!value.trim()) {
                          setEndSuggestions([])
                          return
                        }
                        endSuggestTimeout.current = setTimeout(async () => {
                          const results = await searchLocations(value)
                          setEndSuggestions(results)
                        }, 250)
                      }}
                      className="input w-full"
                      autoComplete="off"
                    />
                    {endSuggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                        {endSuggestions.map((s) => (
                          <button
                            key={`${s.lat}-${s.lon}`}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                            onClick={() => {
                              setEnd({ lat: s.lat, lon: s.lon })
                              setEndLocation(s.name)
                              setEndSuggestions([])
                            }}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      setGeocodingLoading(true)
                      const result = await geocodeLocation(endLocation)
                      if (result) {
                        setEnd({ lat: result.lat, lon: result.lon })
                        setEndLocation(result.name)
                        setEndSuggestions([])
                      } else {
                        setError('Location not found. Please try another search.')
                      }
                      setGeocodingLoading(false)
                    }}
                    disabled={geocodingLoading || !endLocation.trim()}
                    className="btn btn-secondary disabled:opacity-50"
                  >
                    Search
                  </button>
                </div>
                {end && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    ✓ Set to ({end.lat.toFixed(4)}, {end.lon.toFixed(4)})
                  </p>
                )}
              </div>

              <button
                onClick={handleCalculateRoute}
                disabled={loading || !start || !end || backendConnected === false}
                className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Calculating...
                  </span>
                ) : backendConnected === false ? (
                  'Backend Offline'
                ) : (
                  'Calculate Route'
                )}
              </button>
            </div>
          </div>

          {/* Route Info */}
          {routeInfo && (
            <div className="card bg-primary-50 border-primary-200">
              <h3 className="font-semibold text-primary-900 mb-2">Route Information</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-primary-700">Distance:</span>
                  <span className="font-medium text-primary-900">
                    {routeInfo.distance.toFixed(2)} km
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-700">Mode:</span>
                  <span className="font-medium text-primary-900 capitalize">
                    {routeInfo.mode}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SOS Button */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Emergency SOS</h2>
            {!sosActive ? (
              <div className="space-y-3">
                <button
                  onClick={handleActivateSOS}
                  disabled={!currentLocation}
                  className="w-full btn btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <AlertTriangle className="h-5 w-5 inline mr-2" />
                  Activate SOS
                </button>
                <div className="p-3 bg-blue-50 dark:bg-navy-800 rounded-lg border border-blue-200 dark:border-navy-700">
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-semibold">⌨️ Quick Emergency Trigger</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Press SPACEBAR 3 times rapidly to activate SOS in case of emergency</p>
                  {spacebarPresses > 0 && (
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 font-semibold">
                      Spacebar presses: {spacebarPresses}/3
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm font-bold text-red-700 animate-pulse">
                    🚨 SOS ACTIVE 🚨
                  </p>
                  <p className="text-xs text-red-600 mt-2">
                    Your live location is being shared with emergency contacts via WhatsApp. Help is on the way!
                  </p>
                </div>
                <button
                  onClick={handleDeactivateSOS}
                  className="w-full btn bg-gray-600 hover:bg-gray-700 text-white"
                >
                  <X className="h-5 w-5 inline mr-2" />
                  Deactivate SOS
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Map */}
        <div className="lg:col-span-2">
          <Map
            start={start}
            end={end}
            route={route}
            currentLocation={currentLocation}
            height="800px"
          />
        </div>
      </div>
    </div>
  )
}

