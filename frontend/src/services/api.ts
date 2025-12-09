import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
})

// Add request interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = 'Request timeout. Please check if the backend server is running.'
    } else if (error.message === 'Network Error') {
      error.message = 'Cannot connect to backend server. Please ensure it is running on ' + API_BASE_URL
    }
    return Promise.reject(error)
  }
)

export interface Coordinate {
  lat: number
  lon: number
}

export interface RouteRequest {
  start_lat: number
  start_lon: number
  end_lat: number
  end_lon: number
}

export interface RouteResponse {
  route_coords: Coordinate[]
  distance_approx_km: number
  mode_used: string
}

export interface MonitoringRequest {
  user_id: string
  current_lat: number
  current_lon: number
  planned_route_coords: [number, number][]
  planned_route_nodes: number[]
  mode_used: string
}

export interface AlertResponse {
  alert_type: string | null
  message: string | null
  action_required: boolean
  details?: Record<string, any>
}

export interface SOSActivateRequest {
  user_id: string
  current_lat: number
  current_lon: number
}

export interface SOSActivateResponse {
  status: string
  token: string
  guardian_url: string
}

export interface LocationUpdateRequest {
  token: string
  lat: number
  lon: number
  is_stationary?: boolean
}

export interface GuardianStatus {
  status: string
  timestamp: string
  location: {
    lat: number
    lon: number
  }
  is_stationary: boolean
}

export interface HeatmapGeoJSON extends GeoJSON.FeatureCollection {
  features: GeoJSON.Feature[]
}

export interface SegmentInfo {
  segment_id: number
  road_name?: string
  avg_rating?: number
  total_ratings?: number
}

export interface TagsResponse {
  positive: string[]
  negative: string[]
}

export interface FeedbackRequest {
  segment_id: number
  rating: number
  tags: string[]
  persona: string
}

// Routing API
export const calculateRoute = async (
  mode: string,
  request: RouteRequest
): Promise<RouteResponse> => {
  const response = await api.post<RouteResponse>(`/route/${mode}`, request)
  return response.data
}

// Safety Alerts API
export const checkSafetyStatus = async (
  request: MonitoringRequest
): Promise<AlertResponse> => {
  const response = await api.post<AlertResponse>('/alerts/check-status', request)
  return response.data
}

export const reroute = async (
  currentLat: number,
  currentLon: number,
  plannedRouteCoords: [number, number][],
  mode: string
): Promise<{ new_route_coords: Coordinate[] }> => {
  const response = await api.post('/alerts/reroute', {
    current_lat: currentLat,
    current_lon: currentLon,
    planned_route_coords: plannedRouteCoords,
    mode_used: mode,
  })
  return response.data
}

// SOS API
export const activateSOS = async (
  request: SOSActivateRequest
): Promise<SOSActivateResponse> => {
  const response = await api.post<SOSActivateResponse>('/sos/activate', request)
  return response.data
}

export const updateLocation = async (
  request: LocationUpdateRequest
): Promise<void> => {
  await api.post('/sos/location-update', request)
}

export const getGuardianStatus = async (
  token: string
): Promise<GuardianStatus> => {
  const response = await api.get<GuardianStatus>(`/sos/status/${token}`)
  return response.data
}

export const deactivateSOS = async (token: string): Promise<void> => {
  await api.post('/sos/deactivate', { token })
}

// Health check
export const healthCheck = async (): Promise<any> => {
  const response = await api.get('/')
  return response.data
}

// Feedback/Rating API
export const submitFeedback = async (
  request: FeedbackRequest
): Promise<{ message: string }> => {
  const response = await api.post('/api/feedback', request)
  return response.data
}

export const getSegmentInfo = async (
  segmentId: number
): Promise<SegmentInfo> => {
  const response = await api.get<SegmentInfo>(`/api/segment/${segmentId}`)
  return response.data
}

export const getAvailableTags = async (): Promise<TagsResponse> => {
  const response = await api.get<TagsResponse>('/api/tags')
  return response.data
}

export const getSafetyHeatmap = async (): Promise<HeatmapGeoJSON> => {
  const response = await api.get<HeatmapGeoJSON>('/api/heatmap')
  return response.data
}

export default api

