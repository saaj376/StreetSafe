import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, X, Star, Map as MapIcon, Eye, EyeOff } from 'lucide-react'
import Map from '../components/Map'
import {
  activateSOS,
  updateLocation,
  deactivateSOS,
  healthCheck,
  Coordinate,
  submitFeedback,
  getSegmentInfo,
  getAvailableTags,
  getSafetyHeatmap,
  HeatmapGeoJSON,
  SegmentInfo,
  TagsResponse,
} from '../services/api'
import { searchLocations, GeocodingResult } from '../services/geocoding'
import clsx from 'clsx'

type TabMode = 'route' | 'rate'
type RouteType = 'fastest' | 'safest' | 'both'

// Tag display config
const TAG_DISPLAY: Record<string, { emoji: string; label: string; type: 'positive' | 'negative' }> = {
  dark: { emoji: '🌑', label: 'Dark', type: 'negative' },
  isolated: { emoji: '😶', label: 'Isolated', type: 'negative' },
  harassment: { emoji: '⚠️', label: 'Harassment', type: 'negative' },
  dogs: { emoji: '🐕', label: 'Stray Dogs', type: 'negative' },
  nolight: { emoji: '💡', label: 'No Lights', type: 'negative' },
  crowd: { emoji: '👥', label: 'Crowded', type: 'positive' },
  welllit: { emoji: '💡', label: 'Well Lit', type: 'positive' },
  busy: { emoji: '👥', label: 'Busy Area', type: 'positive' },
  safe: { emoji: '✅', label: 'Feels Safe', type: 'positive' },
  cameras: { emoji: '📹', label: 'CCTV Cameras', type: 'positive' },
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [startLocation, setStartLocation] = useState<string>('')
  const [endLocation, setEndLocation] = useState<string>('')
  const [start, setStart] = useState<Coordinate | null>(null)
  const [end, setEnd] = useState<Coordinate | null>(null)
  const [startSuggestions, setStartSuggestions] = useState<GeocodingResult[]>([])
  const [endSuggestions, setEndSuggestions] = useState<GeocodingResult[]>([])
  const [safestRoute, setSafestRoute] = useState<Coordinate[]>([])
  const [fastestRoute, setFastestRoute] = useState<Coordinate[]>([])
  const [loading, setLoading] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null)
  const [sosActive, setSosActive] = useState(false)
  const [sosToken, setSosToken] = useState<string | null>(null)
  const [routeInfo, setRouteInfo] = useState<{ distance: number; mode: string; safestDistance?: number; fastestDistance?: number; safestSafety?: number; fastestSafety?: number; safestTime?: number; fastestTime?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null)

  // Tab state
  const [activeTab, setActiveTab] = useState<TabMode>('route')
  const [routeType, setRouteType] = useState<RouteType>('both')

  // Heatmap state
  const [heatmapData, setHeatmapData] = useState<HeatmapGeoJSON | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(true)

  // Rating state
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null)
  const [selectedSegmentInfo, setSelectedSegmentInfo] = useState<SegmentInfo | null>(null)
  const [selectedRating, setSelectedRating] = useState(0)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<TagsResponse | null>(null)
  const [ratingLoading, setRatingLoading] = useState(false)
  const [ratingSuccess, setRatingSuccess] = useState<string | null>(null)

  // Journey tracking state
  interface RouteSegment {
    segment_id: number
    length: number
    score: number
    road_name?: string
  }
  const [journeyActive, setJourneyActive] = useState(false)
  const [journeySegments, setJourneySegments] = useState<RouteSegment[]>([])
  const [showJourneyRating, setShowJourneyRating] = useState(false)
  const [overallRating, setOverallRating] = useState(0)

  // SOS state
  const [showSOSSettings, setShowSOSSettings] = useState(false)
  const [emergencyContact, setEmergencyContact] = useState('')
  const [emergencyName, setEmergencyName] = useState('')

  // Camera Report state
  const [showReportModal, setShowReportModal] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [reportDescription, setReportDescription] = useState('')
  const [selectedIssueTags, setSelectedIssueTags] = useState<string[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const monitoringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sosIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startSuggestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endSuggestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load heatmap and tags on mount
  useEffect(() => {
    const loadHeatmapAndTags = async () => {
      try {
        const [heatmap, tags] = await Promise.all([
          getSafetyHeatmap(),
          getAvailableTags()
        ])
        setHeatmapData(heatmap)
        setAvailableTags(tags)
      } catch (err) {
        console.error('Error loading heatmap/tags:', err)
      }
    }
    loadHeatmapAndTags()
  }, [])

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
        setError('Backend server is not reachable. Please ensure it is running on http://localhost:8001')
      }
    }
    checkBackend()
  }, [])

  // Get user's current location (for display only, not for start point)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          })
          // Don't auto-set start - let user choose their start point
        },
        (error) => {
          console.error('Error getting location:', error)
        }
      )
    }
  }, [])

  // Handle segment click for rating
  const handleSegmentClick = async (segmentId: number, _lngLat: { lng: number; lat: number }) => {
    if (activeTab !== 'rate') return

    setSelectedSegmentId(segmentId)
    setSelectedRating(0)
    setSelectedTags([])
    setRatingSuccess(null)

    try {
      const info = await getSegmentInfo(segmentId)
      setSelectedSegmentInfo(info)
    } catch (err) {
      console.error('Error getting segment info:', err)
      setSelectedSegmentInfo(null)
    }
  }

  // Submit rating
  const handleSubmitRating = async () => {
    if (!selectedSegmentId || selectedRating === 0) {
      setError('Please select a segment and rating')
      setTimeout(() => setError(null), 3000)
      return
    }

    setRatingLoading(true)
    try {
      const response = await submitFeedback({
        segment_id: selectedSegmentId,
        rating: selectedRating,
        tags: selectedTags,
        persona: 'walker'
      })

      setRatingSuccess(response.message)

      // Refresh heatmap
      const newHeatmap = await getSafetyHeatmap()
      setHeatmapData(newHeatmap)

      // Reset form
      setTimeout(() => {
        setSelectedSegmentId(null)
        setSelectedSegmentInfo(null)
        setSelectedRating(0)
        setSelectedTags([])
        setRatingSuccess(null)
      }, 2000)
    } catch (err) {
      console.error('Error submitting rating:', err)
      setError('Failed to submit rating')
      setTimeout(() => setError(null), 3000)
    } finally {
      setRatingLoading(false)
    }
  }

  // Cancel rating
  const handleCancelRating = () => {
    setSelectedSegmentId(null)
    setSelectedSegmentInfo(null)
    setSelectedRating(0)
    setSelectedTags([])
    setRatingSuccess(null)
  }

  const handleCalculateRoute = async () => {
    if (!start || !end) {
      setError('Please set both start and end points')
      setTimeout(() => setError(null), 5000)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Use the new API endpoint that returns both routes
      const response = await fetch('http://localhost:8001/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_lat: start.lat,
          start_lng: start.lon,
          end_lat: end.lat,
          end_lng: end.lon,
          route_type: routeType
        })
      })

      if (!response.ok) {
        throw new Error('Failed to calculate route')
      }

      const data = await response.json()

      // Set routes based on response
      if (data.fastest) {
        const coords = data.fastest.coordinates.map((c: [number, number]) => ({ lat: c[1], lon: c[0] }))
        setFastestRoute(coords)
      } else {
        setFastestRoute([])
      }

      if (data.safest) {
        const coords = data.safest.coordinates.map((c: [number, number]) => ({ lat: c[1], lon: c[0] }))
        setSafestRoute(coords)
      } else {
        setSafestRoute([])
      }

      // Store segments for journey rating (use safest if available, else fastest)
      // Just store segment data directly - don't fetch road names (too slow)
      const routeData = data.safest || data.fastest
      if (routeData?.segments) {
        setJourneySegments(routeData.segments.map((seg: { segment_id: number; length: number; score: number }) => ({
          ...seg,
          road_name: `Segment ${seg.segment_id}`
        })))
      }

      // Set route info for display
      setRouteInfo({
        distance: data.safest?.total_length || data.fastest?.total_length || 0,
        mode: routeType,
        safestDistance: data.safest?.total_length,
        fastestDistance: data.fastest?.total_length,
        safestSafety: data.safest?.avg_safety_score,
        fastestSafety: data.fastest?.avg_safety_score,
        safestTime: data.safest?.estimated_time_mins,
        fastestTime: data.fastest?.estimated_time_mins,
      })

      // Don't auto-start navigation, wait for user to click Start Journey
    } catch (error: any) {
      console.error('[FRONTEND] Error calculating route:', error)
      setError(error.message || 'Failed to calculate route')
      setFastestRoute([])
      setSafestRoute([])
      setRouteInfo(null)
      setJourneySegments([])
    } finally {
      setLoading(false)
    }
  }

  // Start journey
  const handleStartJourney = () => {
    if (!routeInfo || journeySegments.length === 0) {
      setError('Please calculate a route first')
      return
    }

    setJourneyActive(true)
    setShowJourneyRating(false)
    setOverallRating(0)

    // Voice announcement
    const distance = routeInfo.safestDistance || routeInfo.fastestDistance || 0
    speak(`Starting your journey. Route is ${(distance / 1000).toFixed(1)} kilometers. Stay safe!`)
  }

  // End journey and show rating modal
  const handleEndJourney = () => {
    setJourneyActive(false)
    setShowJourneyRating(true)
    speak('Journey complete! Please rate your experience.')
  }

  // Submit overall rating to ALL segments
  const handleSubmitJourneyRating = async () => {
    if (overallRating === 0) {
      setError('Please select a rating')
      setTimeout(() => setError(null), 3000)
      return
    }

    setRatingLoading(true)
    try {
      console.log(`[JOURNEY] Submitting rating ${overallRating} to ${journeySegments.length} segments sequentially`)

      // Submit ratings one at a time (sequential)
      for (const segment of journeySegments) {
        await submitFeedback({
          segment_id: segment.segment_id,
          rating: overallRating,
          tags: [],
          persona: 'walker'
        })
      }

      // Refresh heatmap
      const newHeatmap = await getSafetyHeatmap()
      setHeatmapData(newHeatmap)

      setRatingSuccess(`Rated ${journeySegments.length} road segments with ${overallRating} stars. Thank you!`)

      // Reset journey state
      setTimeout(() => {
        setShowJourneyRating(false)
        setJourneySegments([])
        setOverallRating(0)
        setRatingSuccess(null)
        // Clear route
        setSafestRoute([])
        setFastestRoute([])
        setRouteInfo(null)
        setStartLocation('')
        setEndLocation('')
        setStart(null)
        setEnd(null)
      }, 3000)
    } catch (err) {
      console.error('Error submitting journey rating:', err)
      setError('Failed to submit rating. Please try again.')
      setTimeout(() => setError(null), 3000)
    } finally {
      setRatingLoading(false)
    }
  }

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(text)
    window.speechSynthesis.speak(utterance)
  }

  // SOS Functions
  const handleTriggerSOS = () => {
    if (!emergencyContact) {
      setShowSOSSettings(true)
      return
    }

    // Get current location and send SOS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(5)
          const lng = position.coords.longitude.toFixed(5)
          sendSOSMessage(lat, lng)
        },
        () => {
          sendSOSMessage('Unknown', 'Unknown')
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    } else {
      sendSOSMessage('Unknown', 'Unknown')
    }
  }

  const sendSOSMessage = (lat: string, lng: string) => {
    const cleanNumber = emergencyContact.replace(/[^0-9]/g, '')
    const message = encodeURIComponent(
      `🚨 SOS ALERT from SafeTrace!\n\n` +
      `I need help! This is an emergency.\n\n` +
      `📍 My Location:\nhttps://www.google.com/maps?q=${lat},${lng}\n\n` +
      `Coordinates: ${lat}, ${lng}\n` +
      `Time: ${new Date().toLocaleString()}`
    )

    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${message}`
    window.open(whatsappUrl, '_blank')
    speak('SOS alert sent. Help is on the way.')
  }

  const saveSOSSettings = () => {
    if (!emergencyContact) {
      setError('Please enter a phone number')
      setTimeout(() => setError(null), 3000)
      return
    }
    setShowSOSSettings(false)
  }

  // Camera Report Functions
  const openReportModal = async () => {
    setShowReportModal(true)
    setCapturedImage(null)
    setReportDescription('')
    setSelectedIssueTags([])

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error('Camera access denied:', err)
      setError('Camera access denied')
      setTimeout(() => setError(null), 3000)
    }
  }

  const closeReportModal = () => {
    setShowReportModal(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)

    const imageData = canvas.toDataURL('image/jpeg')
    setCapturedImage(imageData)
  }

  const retakePhoto = () => {
    setCapturedImage(null)
  }

  const toggleIssueTag = (tag: string) => {
    setSelectedIssueTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const submitReport = () => {
    // In a real app, this would send to the backend
    console.log('Report submitted:', {
      image: capturedImage?.substring(0, 50) + '...',
      description: reportDescription,
      tags: selectedIssueTags
    })
    closeReportModal()
    setRatingSuccess('Report submitted! Thank you for helping keep the community safe.')
    setTimeout(() => setRatingSuccess(null), 3000)
  }


  const handleActivateSOS = async () => {
    if (!currentLocation) {
      alert('Unable to get your location. Please enable location services.')
      return
    }

    try {
      const response = await activateSOS({
        user_id: 'user_123',
        current_lat: currentLocation.lat,
        current_lon: currentLocation.lon,
      })

      setSosActive(true)
      setSosToken(response.token)

      sosIntervalRef.current = setInterval(async () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const newLocation = {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
              }
              setCurrentLocation(newLocation)

              try {
                await updateLocation({
                  token: response.token,
                  lat: newLocation.lat,
                  lon: newLocation.lon,
                  is_stationary: false,
                })
              } catch (error) {
                console.error('Error updating location:', error)
              }
            },
            (error) => console.error('Error getting location:', error)
          )
        }
      }, 5000)
    } catch (error: any) {
      console.error('Error activating SOS:', error)
      alert(error.response?.data?.detail || 'Failed to activate SOS')
    }
  }

  const handleDeactivateSOS = async () => {
    if (!sosToken) return

    try {
      await deactivateSOS(sosToken)
      setSosActive(false)
      setSosToken(null)

      if (sosIntervalRef.current) {
        clearInterval(sosIntervalRef.current)
      }
    } catch (error: any) {
      console.error('Error deactivating SOS:', error)
    }
  }

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

  startSuggestTimeout.current
  endSuggestTimeout.current

  const routeTypeOptions: { value: RouteType; label: string; emoji: string }[] = [
    { value: 'fastest', label: 'Fastest', emoji: '⚡' },
    { value: 'safest', label: 'Safest', emoji: '🛡️' },
    { value: 'both', label: 'Compare', emoji: '📍' },
  ]

  // Format helpers
  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`
    return `${(meters / 1000).toFixed(1)}km`
  }

  const formatTime = (mins: number) => {
    if (mins < 1) return '< 1 min'
    if (mins < 60) return `${Math.round(mins)} min`
    const hours = Math.floor(mins / 60)
    const remainMins = Math.round(mins % 60)
    if (remainMins === 0) return `${hours}h`
    return `${hours}h ${remainMins}m`
  }

  const getSafetyClass = (score: number) => {
    if (score >= 0.7) return 'bg-green-500'
    if (score >= 0.4) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              SafeTrace
            </h1>
            <p className="text-gray-600">
              Navigate safely with real-time safety ratings
            </p>
            <p className="text-sm text-primary-600 mt-1">
              📍 Currently serving Chennai, Tamil Nadu, India
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Heatmap Toggle */}
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                showHeatmap
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              )}
            >
              {showHeatmap ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Heatmap
            </button>
            {backendConnected !== null && (
              <div className="flex items-center space-x-2">
                <div className={`h-3 w-3 rounded-full ${backendConnected ? 'bg-success-500' : 'bg-danger-500'}`} />
                <span className="text-sm text-gray-600">
                  {backendConnected ? 'Connected' : 'Offline'}
                </span>
              </div>
            )}
          </div>
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
            <button onClick={() => setError(null)} className="text-danger-600 hover:text-danger-800">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {ratingSuccess && (
        <div className="mb-6 card bg-green-50 border-green-200">
          <div className="flex items-center space-x-3">
            <Star className="h-6 w-6 text-green-600" />
            <p className="text-green-700">{ratingSuccess}</p>
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
          {/* Tab Selection */}
          <div className="card">
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => { setActiveTab('route'); handleCancelRating(); }}
                className={clsx(
                  'flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
                  activeTab === 'route'
                    ? 'bg-gradient-to-r from-primary-500 to-pink-500 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <MapIcon className="h-4 w-4" />
                Route
              </button>
              <button
                onClick={() => setActiveTab('rate')}
                className={clsx(
                  'flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
                  activeTab === 'rate'
                    ? 'bg-gradient-to-r from-primary-500 to-pink-500 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <Star className="h-4 w-4" />
                Rate
              </button>
            </div>
          </div>

          {/* Route Tab Content */}
          {activeTab === 'route' && (
            <>
              {/* Route Type Selection */}
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Route Type</h2>
                <div className="grid grid-cols-3 gap-2">
                  {routeTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setRouteType(option.value)}
                      className={clsx(
                        'p-3 rounded-lg border-2 transition-all text-center',
                        routeType === option.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <span className="text-xl">{option.emoji}</span>
                      <div className="font-medium text-sm mt-1">{option.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Start/End Points */}
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Route Points</h2>
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      Start Location
                    </label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Search for a place..."
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
                    </div>
                    {currentLocation && (
                      <button
                        onClick={() => {
                          setStart(currentLocation)
                          setStartLocation('📍 Current Location')
                          setStartSuggestions([])
                        }}
                        className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                      >
                        Use Current Location
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      Destination
                    </label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Search for a place..."
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
                    </div>
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
                    ) : (
                      '🚀 Get Route'
                    )}
                  </button>
                </div>
              </div>

              {/* Route Info Cards */}
              {routeInfo && (
                <div className="space-y-4">
                  {/* Fastest Route Card */}
                  {(routeType === 'fastest' || routeType === 'both') && routeInfo.fastestDistance && (
                    <div className="card border-l-4 border-purple-500">
                      <h3 className="font-semibold text-purple-600 mb-3 flex items-center gap-2">
                        ⚡ Fastest Route
                        <span className="w-8 h-1 bg-purple-500 rounded" style={{ borderStyle: 'dashed', borderWidth: '1px' }}></span>
                      </h3>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-xl font-bold text-gray-900">
                            {formatDistance(routeInfo.fastestDistance)}
                          </div>
                          <div className="text-xs text-gray-500 uppercase">Distance</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-gray-900">
                            {formatTime(routeInfo.fastestTime || 0)}
                          </div>
                          <div className="text-xs text-gray-500 uppercase">Est. Time</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-gray-900">
                            {routeInfo.fastestSafety?.toFixed(2) || '--'}
                          </div>
                          <div className="text-xs text-gray-500 uppercase">Safety</div>
                        </div>
                      </div>
                      <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getSafetyClass(routeInfo.fastestSafety || 0)} transition-all`}
                          style={{ width: `${(routeInfo.fastestSafety || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Safest Route Card */}
                  {(routeType === 'safest' || routeType === 'both') && routeInfo.safestDistance && (
                    <div className="card border-l-4 border-cyan-500">
                      <h3 className="font-semibold text-cyan-600 mb-3 flex items-center gap-2">
                        🛡️ Safest Route
                        <span className="w-8 h-1 bg-cyan-500 rounded"></span>
                      </h3>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-xl font-bold text-gray-900">
                            {formatDistance(routeInfo.safestDistance)}
                          </div>
                          <div className="text-xs text-gray-500 uppercase">Distance</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-gray-900">
                            {formatTime(routeInfo.safestTime || 0)}
                          </div>
                          <div className="text-xs text-gray-500 uppercase">Est. Time</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-gray-900">
                            {routeInfo.safestSafety?.toFixed(2) || '--'}
                          </div>
                          <div className="text-xs text-gray-500 uppercase">Safety</div>
                        </div>
                      </div>
                      <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getSafetyClass(routeInfo.safestSafety || 0)} transition-all`}
                          style={{ width: `${(routeInfo.safestSafety || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Journey Control Buttons */}
              {routeInfo && journeySegments.length > 0 && !showJourneyRating && (
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4">Journey</h2>
                  {!journeyActive ? (
                    <button
                      onClick={handleStartJourney}
                      className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
                    >
                      🚶 Start Journey
                    </button>
                  ) : (
                    <button
                      onClick={handleEndJourney}
                      className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 transition-all shadow-lg animate-pulse"
                    >
                      🏁 End Journey & Rate
                    </button>
                  )}
                  {journeyActive && (
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      Journey in progress... Click when you arrive at your destination
                    </p>
                  )}
                </div>
              )}

              {/* Journey Rating Modal */}
              {showJourneyRating && (
                <div className="card border-2 border-primary-500 bg-primary-50">
                  <h2 className="text-xl font-bold mb-4 text-primary-700">
                    Rate Your Journey 🌟
                  </h2>

                  <div className="space-y-4">
                    <p className="text-gray-600">How was your journey? This rating will be applied to all {journeySegments.length} road segments.</p>

                    {/* Rating Stars - Always clickable */}
                    <div className="flex justify-center gap-2 py-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setOverallRating(star)}
                          className="transition-transform hover:scale-110 focus:outline-none"
                          type="button"
                        >
                          <Star
                            className={clsx(
                              'h-10 w-10 transition-colors cursor-pointer',
                              star <= overallRating
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-300 hover:text-yellow-200'
                            )}
                          />
                        </button>
                      ))}
                    </div>

                    <div className="text-center text-sm text-gray-500">
                      {overallRating === 1 && '😟 Very Unsafe'}
                      {overallRating === 2 && '😕 Somewhat Unsafe'}
                      {overallRating === 3 && '😐 Neutral'}
                      {overallRating === 4 && '🙂 Mostly Safe'}
                      {overallRating === 5 && '😊 Very Safe'}
                    </div>

                    {ratingLoading && (
                      <div className="text-center text-sm text-primary-600 animate-pulse">
                        Submitting ratings... This may take a moment.
                      </div>
                    )}

                    <button
                      onClick={handleSubmitJourneyRating}
                      disabled={overallRating === 0 || ratingLoading}
                      className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-pink-500 text-white font-semibold rounded-lg hover:from-primary-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                    >
                      {ratingLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Submitting...
                        </span>
                      ) : (
                        `Submit Rating for ${journeySegments.length} Roads`
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* SOS Button */}
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Emergency SOS</h2>
                {!sosActive ? (
                  <button
                    onClick={handleActivateSOS}
                    disabled={!currentLocation}
                    className="w-full btn btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <AlertTriangle className="h-5 w-5 inline mr-2" />
                    Activate SOS
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-danger-50 rounded-lg">
                      <p className="text-sm text-danger-700">
                        SOS is active. Your location is being shared with guardians.
                      </p>
                    </div>
                    <button onClick={handleDeactivateSOS} className="w-full btn btn-secondary">
                      Deactivate SOS
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Rate Tab Content */}
          {activeTab === 'rate' && (
            <>
              {/* Instructions */}
              {!selectedSegmentId && (
                <div className="card bg-gradient-to-br from-primary-50 to-pink-50 border-primary-200">
                  <div className="flex items-start gap-3">
                    <Star className="h-6 w-6 text-primary-600 mt-1" />
                    <div>
                      <h3 className="font-semibold text-primary-900 mb-1">Rate a street segment</h3>
                      <p className="text-sm text-primary-700">
                        Click on any street on the map to rate its safety. Your feedback helps others stay safe!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rating Form */}
              {selectedSegmentId && (
                <div className="card space-y-4">
                  {/* Segment Info */}
                  <div className="p-3 bg-primary-50 rounded-lg">
                    <span className="text-sm text-primary-600">📍 Rating:</span>
                    <span className="ml-2 font-semibold text-primary-900">
                      {selectedSegmentInfo?.road_name || `Segment ${selectedSegmentId}`}
                    </span>
                  </div>

                  {/* Star Rating */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">How safe did you feel? (1-5)</h3>
                    <div className="flex gap-2 justify-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setSelectedRating(star)}
                          className={clsx(
                            'text-3xl transition-all transform',
                            selectedRating >= star ? 'scale-110' : 'opacity-40 grayscale'
                          )}
                        >
                          ⭐
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Negative Tags */}
                  {availableTags && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">🚨 Issues (optional)</h4>
                      <div className="flex flex-wrap gap-2">
                        {availableTags.negative.map((tag: string) => {
                          const tagInfo = TAG_DISPLAY[tag] || { emoji: '🏷️', label: tag, type: 'negative' }
                          return (
                            <button
                              key={tag}
                              onClick={() => {
                                setSelectedTags(prev =>
                                  prev.includes(tag)
                                    ? prev.filter(t => t !== tag)
                                    : [...prev, tag]
                                )
                              }}
                              className={clsx(
                                'px-3 py-1.5 rounded-full text-sm font-medium transition-all border',
                                selectedTags.includes(tag)
                                  ? 'bg-red-500 border-red-500 text-white'
                                  : 'border-gray-300 text-gray-600 hover:border-red-300'
                              )}
                            >
                              {tagInfo.emoji} {tagInfo.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Positive Tags */}
                  {availableTags && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">✅ Positives (optional)</h4>
                      <div className="flex flex-wrap gap-2">
                        {availableTags.positive.map((tag: string) => {
                          const tagInfo = TAG_DISPLAY[tag] || { emoji: '🏷️', label: tag, type: 'positive' }
                          return (
                            <button
                              key={tag}
                              onClick={() => {
                                setSelectedTags(prev =>
                                  prev.includes(tag)
                                    ? prev.filter(t => t !== tag)
                                    : [...prev, tag]
                                )
                              }}
                              className={clsx(
                                'px-3 py-1.5 rounded-full text-sm font-medium transition-all border',
                                selectedTags.includes(tag)
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 text-gray-600 hover:border-green-300'
                              )}
                            >
                              {tagInfo.emoji} {tagInfo.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmitRating}
                    disabled={ratingLoading || selectedRating === 0}
                    className="w-full btn btn-primary disabled:opacity-50"
                  >
                    {ratingLoading ? '⏳ Submitting...' : '📤 Submit Rating'}
                  </button>

                  {/* Cancel Button */}
                  <button
                    onClick={handleCancelRating}
                    className="w-full btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Legend */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3">Legend</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-1.5 bg-green-500 rounded"></div>
                    <span className="text-sm text-gray-600">Safe (0.8+)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-1.5 bg-yellow-500 rounded"></div>
                    <span className="text-sm text-gray-600">Moderate (0.5-0.8)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-1.5 bg-pink-500 rounded"></div>
                    <span className="text-sm text-gray-600">Avoid (&lt;0.5)</span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <div className="w-6 h-1.5 bg-purple-500 rounded" style={{ border: '1px dashed #6b21a8' }}></div>
                    <span className="text-sm text-gray-600">Fastest Route</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-1.5 bg-cyan-500 rounded"></div>
                    <span className="text-sm text-gray-600">Safest Route</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Panel - Map */}
        <div className="lg:col-span-2">
          <Map
            start={start}
            end={end}
            safestRoute={routeType === 'fastest' ? undefined : safestRoute}
            fastestRoute={routeType === 'safest' ? undefined : fastestRoute}
            currentLocation={currentLocation}
            height="800px"
            heatmapData={heatmapData}
            showHeatmap={showHeatmap}
            ratingMode={activeTab === 'rate'}
            onSegmentClick={handleSegmentClick}
          />
        </div>
      </div>

      {/* Floating SOS Button */}
      <button
        onClick={handleTriggerSOS}
        className="fixed bottom-24 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-4 border-red-300 text-white font-bold text-sm shadow-lg hover:scale-110 transition-transform z-50 animate-pulse flex items-center justify-center"
        style={{ animation: 'sosPulse 2s infinite' }}
      >
        SOS
      </button>

      {/* Floating Camera Report Button */}
      <button
        onClick={openReportModal}
        className="fixed bottom-44 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 border-2 border-amber-300 text-white text-xl shadow-lg hover:scale-110 transition-transform z-50 flex items-center justify-center"
      >
        📷
      </button>

      {/* SOS Settings Modal */}
      {showSOSSettings && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-2">🚨 SOS Settings</h3>
            <p className="text-gray-600 mb-4">Set your emergency contact for SOS alerts</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Number</label>
              <input
                type="tel"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="+91 9043044776"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input
                type="text"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="Mom / Dad / Friend"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSOSSettings(false)}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={saveSOSSettings}
                className="flex-1 py-2 px-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                💾 Save Contact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-2">📷 Report Safety Issue</h3>
            <p className="text-gray-600 mb-4">Capture and report a safety concern</p>

            {/* Camera Preview */}
            <div className="relative w-full h-48 bg-gray-900 rounded-xl mb-4 overflow-hidden">
              {!capturedImage ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={capturePhoto}
                    className="absolute bottom-3 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full bg-white border-4 border-primary-500"
                  />
                </>
              ) : (
                <>
                  <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                  <button
                    onClick={retakePhoto}
                    className="absolute top-2 right-2 px-3 py-1 bg-black/70 text-white rounded-lg text-sm"
                  >
                    ↩️ Retake
                  </button>
                </>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Description */}
            <textarea
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              placeholder="Describe the safety issue (e.g., Poor lighting, Suspicious activity, Stray dogs...)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none mb-4"
              rows={3}
            />

            {/* Issue Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {['poor_lighting', 'suspicious', 'harassment', 'stray_dogs', 'road_damage'].map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleIssueTag(tag)}
                  className={clsx(
                    'px-3 py-1 rounded-full text-sm font-medium transition-all',
                    selectedIssueTags.includes(tag)
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {tag === 'poor_lighting' && '💡 Poor Lighting'}
                  {tag === 'suspicious' && '👁️ Suspicious'}
                  {tag === 'harassment' && '⚠️ Harassment'}
                  {tag === 'stray_dogs' && '🐕 Stray Dogs'}
                  {tag === 'road_damage' && '🚧 Road Damage'}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeReportModal}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={submitReport}
                className="flex-1 py-2 px-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                📤 Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS for SOS pulse animation */}
      <style>{`
        @keyframes sosPulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  )
}
