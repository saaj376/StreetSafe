import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, Shield, Radio } from 'lucide-react'
import Map from '../components/Map'
import { getGuardianStatus, GuardianStatus } from '../services/api'

export default function Guardian() {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<GuardianStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Invalid token')
      setLoading(false)
      return
    }

    const fetchStatus = async () => {
      try {
        const data = await getGuardianStatus(token)
        setStatus(data)
        setError(null)
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to fetch status')
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()

    // Poll for updates every 3 seconds
    const interval = setInterval(fetchStatus, 3000)

    return () => clearInterval(interval)
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading guardian dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !status) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md text-center">
          <Shield className="h-16 w-16 text-danger-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Guardian Mode Unavailable</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error || 'Status not available'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Shield className="h-10 w-10 text-primary-600" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Guardian Dashboard</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300">Real-time location tracking</p>
        </div>

        {/* Status Card */}
        <div className="card mb-6 bg-primary-50 border-primary-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={status.is_stationary ? 'h-4 w-4 bg-yellow-500 rounded-full' : 'h-4 w-4 bg-success-500 rounded-full animate-pulse'} />
              <div>
                <h2 className="font-semibold text-primary-900 dark:text-primary-300">
                  Status: {status.status === 'live' ? 'Active' : status.status}
                </h2>
                <p className="text-sm text-primary-700 dark:text-primary-400">
                  {status.is_stationary ? 'User is stationary' : 'User is moving'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-primary-600 dark:text-primary-400">Last Update</p>
              <p className="text-sm font-medium text-primary-900 dark:text-primary-300">
                {new Date(status.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="card p-0 overflow-hidden">
          <Map
            currentLocation={status.location}
            height="600px"
          />
        </div>

        {/* Location Details */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-primary-600" />
              Current Location
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Latitude:</span>
                <span className="font-mono font-medium">{status.location.lat.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Longitude:</span>
                <span className="font-mono font-medium">{status.location.lon.toFixed(6)}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <Radio className="h-5 w-5 mr-2 text-primary-600" />
              Tracking Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Update Frequency:</span>
                <span className="font-medium">Every 5 seconds</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Motion Status:</span>
                <span className="font-medium">
                  {status.is_stationary ? 'Stationary' : 'Moving'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

