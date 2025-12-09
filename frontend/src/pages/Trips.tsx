import { Route, Clock, MapPin, Sparkles, Package, Calendar, Users, MapPinIcon, Search, Utensils, Camera, Train, Navigation } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

interface ItineraryItem {
  time: string
  activity: string
  location: string
  duration: string
  notes: string
}

interface PackingItem {
  category: string
  items: string[]
}

interface POI {
  name: string
  type: string
  address: string
  rating?: number
  distance?: string
}

export default function Trips() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'builder' | 'packing'>('builder')
  const [showItineraryBuilder, setShowItineraryBuilder] = useState(false)
  const [showPackingAssistant, setShowPackingAssistant] = useState(false)

  // Itinerary Builder State
  const [destination, setDestination] = useState('')
  const [tripDays, setTripDays] = useState(3)
  const [travelStyle, setTravelStyle] = useState<'adventure' | 'relaxation' | 'cultural' | 'budget'>('adventure')
  const [interests, setInterests] = useState<string[]>([])
  const [itinerary, setItinerary] = useState<ItineraryItem[] | null>(null)
  const [itineraryLoading, setItineraryLoading] = useState(false)

  // Packing Assistant State
  const [packingDestination, setPackingDestination] = useState('')
  const [packingWeather, setPackingWeather] = useState<'hot' | 'cold' | 'rainy' | 'mixed'>('mixed')
  const [packingDuration, setPackingDuration] = useState(3)
  const [packingActivities, setPackingActivities] = useState<string[]>([])
  const [packingList, setPackingList] = useState<PackingItem[] | null>(null)
  const [packingLoading, setPackingLoading] = useState(false)

  // POI Search State
  const [showPOISearch, setShowPOISearch] = useState(false)
  const [poiLocation, setPoiLocation] = useState('')
  const [poiType, setPoiType] = useState<'restaurants' | 'attractions' | 'transport'>('restaurants')
  const [poiResults, setPoiResults] = useState<POI[] | null>(null)
  const [poiLoading, setPoiLoading] = useState(false)

  const interestOptions = ['Beach', 'Mountains', 'History', 'Food', 'Art', 'Shopping', 'Nightlife', 'Nature']
  const activityOptions = ['Hiking', 'Swimming', 'Business Meetings', 'Formal Events', 'Casual Walking', 'Photography']

  const generateItinerary = async () => {
    if (!destination || !tripDays) {
      alert('Please fill in all fields')
      return
    }

    setItineraryLoading(true)
    try {
      const response = await fetch('http://localhost:8001/ai/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          days: tripDays,
          travel_style: travelStyle,
          interests: interests.length > 0 ? interests : []
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `API error: ${response.status}`)
      }

      const data = await response.json()
      setItinerary(data.itinerary)
    } catch (error) {
      console.error('Error generating itinerary:', error)
      alert(`Failed to generate itinerary: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setItineraryLoading(false)
    }
  }

  const generatePackingList = async () => {
    if (!packingDestination || !packingDuration) {
      alert('Please fill in all fields')
      return
    }

    setPackingLoading(true)
    try {
      const response = await fetch('http://localhost:8001/ai/generate-packing-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: packingDestination,
          duration: packingDuration,
          weather: packingWeather,
          activities: packingActivities.length > 0 ? packingActivities : []
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `API error: ${response.status}`)
      }

      const data = await response.json()
      setPackingList(data.packing_list)
    } catch (error) {
      console.error('Error generating packing list:', error)
      alert(`Failed to generate packing list: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setPackingLoading(false)
    }
  }

  const searchPOI = async () => {
    if (!poiLocation) {
      alert('Please enter a location')
      return
    }

    setPoiLoading(true)
    try {
      const response = await fetch('http://localhost:8001/ai/search-poi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: poiLocation,
          poi_type: poiType
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `API error: ${response.status}`)
      }

      const data = await response.json()
      setPoiResults(data.results)
    } catch (error) {
      console.error('Error searching POI:', error)
      alert(`Failed to search POI: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setPoiLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Trips</h1>
          <p className="text-gray-600">View, plan, and manage your travel adventures</p>
        </div>

        {/* AI Tools Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* AI Itinerary Builder */}
          <div className="card">
            <div className="flex items-center space-x-3 mb-4 pb-4 border-b">
              <Sparkles className="h-6 w-6 text-primary-600" />
              <h2 className="text-xl font-semibold text-gray-900">AI Itinerary Builder</h2>
            </div>

            {!showItineraryBuilder ? (
              <button
                onClick={() => setShowItineraryBuilder(true)}
                className="w-full btn btn-primary text-center py-8 flex flex-col items-center justify-center space-y-3"
              >
                <Calendar className="h-8 w-8" />
                <span>Create AI-Powered Itinerary</span>
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g., Paris, Bali, Tokyo"
                    className="input w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration (days)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={tripDays}
                      onChange={(e) => setTripDays(parseInt(e.target.value))}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Travel Style</label>
                    <select
                      value={travelStyle}
                      onChange={(e) => setTravelStyle(e.target.value as any)}
                      className="input w-full"
                    >
                      <option value="adventure">Adventure</option>
                      <option value="relaxation">Relaxation</option>
                      <option value="cultural">Cultural</option>
                      <option value="budget">Budget</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Interests</label>
                  <div className="grid grid-cols-2 gap-2">
                    {interestOptions.map((interest) => (
                      <button
                        key={interest}
                        onClick={() =>
                          setInterests(
                            interests.includes(interest)
                              ? interests.filter((i) => i !== interest)
                              : [...interests, interest]
                          )
                        }
                        className={clsx(
                          'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          interests.includes(interest)
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generateItinerary}
                  disabled={itineraryLoading}
                  className="w-full btn btn-primary disabled:opacity-50"
                >
                  {itineraryLoading ? 'Generating...' : 'Generate Itinerary'}
                </button>

                {itinerary && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <h3 className="font-semibold text-gray-900">Your Itinerary</h3>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {itinerary.map((item, idx) => (
                        <div key={idx} className="p-3 bg-primary-50 rounded-lg">
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-medium text-primary-900">{item.time}</span>
                            <span className="text-xs text-primary-700">{item.duration}</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{item.activity}</p>
                          <p className="text-xs text-gray-600 flex items-center mt-1">
                            <MapPin className="h-3 w-3 mr-1" />
                            {item.location}
                          </p>
                          {item.notes && <p className="text-xs text-gray-700 mt-2">{item.notes}</p>}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowItineraryBuilder(false)}
                      className="w-full btn btn-secondary text-sm"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Packing Assistant */}
          <div className="card">
            <div className="flex items-center space-x-3 mb-4 pb-4 border-b">
              <Package className="h-6 w-6 text-success-600" />
              <h2 className="text-xl font-semibold text-gray-900">AI Packing Assistant</h2>
            </div>

            {!showPackingAssistant ? (
              <button
                onClick={() => setShowPackingAssistant(true)}
                className="w-full btn btn-success text-center py-8 flex flex-col items-center justify-center space-y-3"
              >
                <Package className="h-8 w-8" />
                <span>Generate Smart Packing List</span>
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                  <input
                    type="text"
                    value={packingDestination}
                    onChange={(e) => setPackingDestination(e.target.value)}
                    placeholder="e.g., Bangkok, London, Dubai"
                    className="input w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Trip Duration</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={packingDuration}
                      onChange={(e) => setPackingDuration(parseInt(e.target.value))}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Weather</label>
                    <select
                      value={packingWeather}
                      onChange={(e) => setPackingWeather(e.target.value as any)}
                      className="input w-full"
                    >
                      <option value="hot">Hot & Sunny</option>
                      <option value="cold">Cold & Snowy</option>
                      <option value="rainy">Rainy & Humid</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Activities</label>
                  <div className="grid grid-cols-2 gap-2">
                    {activityOptions.map((activity) => (
                      <button
                        key={activity}
                        onClick={() =>
                          setPackingActivities(
                            packingActivities.includes(activity)
                              ? packingActivities.filter((a) => a !== activity)
                              : [...packingActivities, activity]
                          )
                        }
                        className={clsx(
                          'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          packingActivities.includes(activity)
                            ? 'bg-success-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        {activity}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generatePackingList}
                  disabled={packingLoading}
                  className="w-full btn btn-success disabled:opacity-50"
                >
                  {packingLoading ? 'Generating...' : 'Generate Packing List'}
                </button>

                {packingList && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <h3 className="font-semibold text-gray-900">Packing Checklist</h3>
                    <div className="max-h-96 overflow-y-auto space-y-3">
                      {packingList.map((category, idx) => (
                        <div key={idx} className="p-3 bg-success-50 rounded-lg">
                          <h4 className="font-semibold text-success-900 mb-2">{category.category}</h4>
                          <ul className="space-y-1">
                            {category.items.map((item, itemIdx) => (
                              <li key={itemIdx} className="flex items-center text-sm text-gray-700">
                                <input type="checkbox" className="mr-2 rounded" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowPackingAssistant(false)}
                      className="w-full btn btn-secondary text-sm"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* POI Search */}
          <div className="card lg:col-span-2">
            <div className="flex items-center space-x-3 mb-4 pb-4 border-b">
              <Search className="h-6 w-6 text-warning-600" />
              <h2 className="text-xl font-semibold text-gray-900">POI Search</h2>
              <span className="text-sm text-gray-500">(Restaurants, Attractions, Transport)</span>
            </div>

            {!showPOISearch ? (
              <button
                onClick={() => setShowPOISearch(true)}
                className="w-full btn btn-warning text-center py-8 flex flex-col items-center justify-center space-y-3"
              >
                <Search className="h-8 w-8" />
                <span>Search Points of Interest</span>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={poiLocation}
                      onChange={(e) => setPoiLocation(e.target.value)}
                      placeholder="e.g., Marina Beach, Chennai"
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={poiType}
                      onChange={(e) => setPoiType(e.target.value as any)}
                      className="input w-full"
                    >
                      <option value="restaurants">Restaurants</option>
                      <option value="attractions">Attractions</option>
                      <option value="transport">Transport</option>
                    </select>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={searchPOI}
                    disabled={poiLoading}
                    className="flex-1 btn btn-warning disabled:opacity-50"
                  >
                    {poiLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Searching...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <Search className="h-4 w-4 mr-2" />
                        Search {poiType.charAt(0).toUpperCase() + poiType.slice(1)}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowPOISearch(false)
                      setPoiResults(null)
                    }}
                    className="btn btn-secondary"
                  >
                    Close
                  </button>
                </div>

                {poiResults && poiResults.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      {poiType === 'restaurants' && <Utensils className="h-5 w-5 mr-2 text-warning-600" />}
                      {poiType === 'attractions' && <Camera className="h-5 w-5 mr-2 text-warning-600" />}
                      {poiType === 'transport' && <Train className="h-5 w-5 mr-2 text-warning-600" />}
                      Found {poiResults.length} {poiType}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                      {poiResults.map((poi, idx) => (
                        <div key={idx} className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 mb-1">{poi.name}</h4>
                              <p className="text-sm text-gray-600 mb-2 flex items-start">
                                <MapPin className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                                <span className="line-clamp-2">{poi.address}</span>
                              </p>
                            </div>
                            <button
                              onClick={async () => {
                                // Use geocoding to get coordinates for the address
                                try {
                                  const response = await fetch(
                                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(poi.address)}&limit=1`,
                                    {
                                      headers: {
                                        'Accept': 'application/json',
                                      }
                                    }
                                  )
                                  const results = await response.json()
                                  if (results && results.length > 0) {
                                    const lat = parseFloat(results[0].lat)
                                    const lon = parseFloat(results[0].lon)
                                    // Navigate to home page with location as query params
                                    navigate(`/?lat=${lat}&lon=${lon}&name=${encodeURIComponent(poi.name)}`)
                                  } else {
                                    alert('Could not find location on map')
                                  }
                                } catch (error) {
                                  console.error('Error geocoding address:', error)
                                  alert('Failed to locate on map')
                                }
                              }}
                              className="ml-2 p-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors flex-shrink-0"
                              title="View on Map"
                            >
                              <Navigation className="h-4 w-4" />
                            </button>
                          </div>
                          {poi.rating && (
                            <div className="flex items-center space-x-2 text-sm">
                              <span className="text-yellow-600">★ {poi.rating}</span>
                              {poi.distance && <span className="text-gray-500">• {poi.distance}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {poiResults && poiResults.length === 0 && (
                  <div className="mt-4 pt-4 border-t text-center py-6">
                    <p className="text-gray-600">No results found for this location</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Empty State for Saved Trips */}
        <div className="card text-center py-12">
          <Route className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No saved trips yet</h2>
          <p className="text-gray-600">Use the AI tools above or start planning your first safe route</p>
        </div>
      </div>
    </div>
  )
}
