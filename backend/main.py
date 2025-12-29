"""
SafeTrace API Server (FastAPI)
Provides routing endpoints for fastest and safest routes
+ Feedback collection and scoring (Person 3 + 4 functionality)
+ Geoapify Place Search integration
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import json
import networkx as nx
import math
import time
import httpx
from shapely.geometry import Point, LineString
from routes import aiservice, routingservice, sosservice, safetyalertservice

app = FastAPI(title="StreetSafe API", description="Safe routing for pedestrians")

@app.on_event("startup")
async def startup_event():
    from services.riskscoreservice import load_risk_and_graph_data
    load_risk_and_graph_data()

# Geoapify API Configuration
GEOAPIFY_API_KEY = "850a27a332bf474a9c0646d7ee8df85b"
GEOAPIFY_GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search"
GEOAPIFY_AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete"
GEOAPIFY_ROUTING_URL = "https://api.geoapify.com/v1/routing"

# Chennai city center for biasing search results
CHENNAI_CENTER = {"lat": 13.0827, "lng": 80.2707}

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(aiservice.router)
app.include_router(routingservice.router)
app.include_router(sosservice.router)
app.include_router(safetyalertservice.router)

# --------------------------------------------------------------
# LOAD DATA
# --------------------------------------------------------------
SCORES_FILE = "segment_scores.json"
SEGMENTS_FILE = "segments.json"

print(f"Loading segments from {SEGMENTS_FILE}...")
with open(SEGMENTS_FILE) as f:
    SEGMENTS = json.load(f)
print(f"Loaded {len(SEGMENTS)} segments covering Chennai")

# Load or create scores file
print("Loading safety scores...")
try:
    with open(SCORES_FILE) as f:
        SCORES = json.load(f)
    print(f"Loaded {len(SCORES)} existing scores")
except FileNotFoundError:
    print("No scores file found, creating empty scores...")
    SCORES = {}
    with open(SCORES_FILE, "w") as f:
        json.dump(SCORES, f)

# Build segment lookup by ID (lazy load lines for performance)
print("Building segment lookup...")
SEG_BY_ID = {seg["segment_id"]: seg for seg in SEGMENTS}

# Lazy-load segment lines only when needed for performance
_SEG_LINES_CACHE = {}
def get_seg_line(segment_id):
    if segment_id not in _SEG_LINES_CACHE:
        seg = SEG_BY_ID.get(segment_id)
        if seg:
            _SEG_LINES_CACHE[segment_id] = LineString(seg["coordinates"])
    return _SEG_LINES_CACHE.get(segment_id)

# --------------------------------------------------------------
# BUILD GRAPH
# --------------------------------------------------------------
print("Building road network graph...")
G = nx.DiGraph()

for seg in SEGMENTS:
    u = seg["u"]
    v = seg["v"]
    length = seg["length"]
    seg_id = seg["segment_id"]
    
    G.add_edge(u, v, length=length, segment_id=seg_id)
    G.add_edge(v, u, length=length, segment_id=seg_id)

# --------------------------------------------------------------
# BUILD NODE COORD MAP
# --------------------------------------------------------------
NODE_COORDS = {}
for seg in SEGMENTS:
    u = seg["u"]
    v = seg["v"]
    coords = seg["coordinates"]
    
    if u not in NODE_COORDS:
        NODE_COORDS[u] = coords[0]
    if v not in NODE_COORDS:
        NODE_COORDS[v] = coords[-1]

print(f"Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

# --------------------------------------------------------------
# FEEDBACK STORAGE
# --------------------------------------------------------------
FEEDBACK_FILE = "feedback.json"
try:
    with open(FEEDBACK_FILE) as f:
        FEEDBACK_LIST = json.load(f)
    print(f"Loaded {len(FEEDBACK_LIST)} existing feedback entries")
except:
    FEEDBACK_LIST = []
    print("Starting with empty feedback list")

# --------------------------------------------------------------
# TAG EFFECTS
# --------------------------------------------------------------
TAG_EFFECTS = {
    "dark": -0.20,
    "isolated": -0.15,
    "harassment": -0.35,
    "dogs": -0.10,
    "nolight": -0.25,
    "crowd": +0.05,
    "welllit": +0.15,
    "busy": +0.10,
    "safe": +0.20,
    "cameras": +0.10,
}

# --------------------------------------------------------------
# PYDANTIC MODELS
# --------------------------------------------------------------
class RouteRequest(BaseModel):
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float
    route_type: Optional[str] = "both"

class PlaceSearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 5

class PlaceResult(BaseModel):
    name: str
    formatted: str
    lat: float
    lng: float
    place_id: str

class PlaceSearchResponse(BaseModel):
    results: List[PlaceResult]

class RouteByPlaceRequest(BaseModel):
    start_query: str
    end_query: str
    route_type: Optional[str] = "both"

class SegmentInfo(BaseModel):
    segment_id: int
    length: float
    score: float

class RouteInfo(BaseModel):
    coordinates: List[List[float]]
    segments: List[SegmentInfo]
    total_length: float
    avg_safety_score: float
    estimated_time_mins: float  # Walking time in minutes

class RouteResponse(BaseModel):
    start_node: int
    end_node: int
    start_coords: List[float]
    end_coords: List[float]
    start_place: Optional[str] = None
    end_place: Optional[str] = None
    fastest: Optional[RouteInfo] = None
    safest: Optional[RouteInfo] = None

class FeedbackRequest(BaseModel):
    segment_id: Optional[int] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: int
    tags: Optional[List[str]] = []
    persona: Optional[str] = "walker"
    comment: Optional[str] = ""

class FeedbackResponse(BaseModel):
    success: bool
    segment_id: int
    new_score: float
    message: str

class BulkFeedbackRequest(BaseModel):
    segment_ids: List[int]
    rating: int
    tags: Optional[List[str]] = []
    persona: Optional[str] = "walker"

class BulkFeedbackResponse(BaseModel):
    success: bool
    segments_updated: int
    message: str

# --------------------------------------------------------------
# GEOAPIFY GEOCODING FUNCTIONS
# --------------------------------------------------------------
async def geocode_place(query: str, limit: int = 5) -> List[dict]:
    """Search for places using Geoapify Geocoding API"""
    async with httpx.AsyncClient() as client:
        params = {
            "text": query,
            "apiKey": GEOAPIFY_API_KEY,
            "format": "json",
            "limit": limit,
            # Bias towards Anna Nagar, Chennai
            "bias": f"proximity:{CHENNAI_CENTER['lng']},{CHENNAI_CENTER['lat']}",
            # Filter to India for better results
            "filter": "countrycode:in"
        }
        
        response = await client.get(GEOAPIFY_GEOCODE_URL, params=params)
        
        if response.status_code != 200:
            print(f"Geoapify error: {response.status_code} - {response.text}")
            return []
        
        data = response.json()
        results = []
        
        for item in data.get("results", []):
            results.append({
                "name": item.get("name", item.get("address_line1", query)),
                "formatted": item.get("formatted", ""),
                "lat": item.get("lat"),
                "lng": item.get("lon"),
                "place_id": item.get("place_id", "")
            })
        
        return results

async def autocomplete_place(query: str, limit: int = 5) -> List[dict]:
    """Autocomplete places using Geoapify Autocomplete API"""
    async with httpx.AsyncClient() as client:
        params = {
            "text": query,
            "apiKey": GEOAPIFY_API_KEY,
            "format": "json",
            "limit": limit,
            "bias": f"proximity:{CHENNAI_CENTER['lng']},{CHENNAI_CENTER['lat']}",
            "filter": "countrycode:in"
        }
        
        response = await client.get(GEOAPIFY_AUTOCOMPLETE_URL, params=params)
        
        if response.status_code != 200:
            return []
        
        data = response.json()
        results = []
        
        for item in data.get("results", []):
            results.append({
                "name": item.get("name", item.get("address_line1", query)),
                "formatted": item.get("formatted", ""),
                "lat": item.get("lat"),
                "lng": item.get("lon"),
                "place_id": item.get("place_id", "")
            })
        
        return results

async def get_walking_time_from_api(start_lat: float, start_lng: float, end_lat: float, end_lng: float) -> dict:
    """Get real-time walking time estimate from Geoapify Routing API"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Format: lat,lng|lat,lng
        waypoints = f"{start_lat},{start_lng}|{end_lat},{end_lng}"
        
        params = {
            "waypoints": waypoints,
            "mode": "walk",
            "format": "json",
            "apiKey": GEOAPIFY_API_KEY
        }
        
        try:
            response = await client.get(GEOAPIFY_ROUTING_URL, params=params)
            
            if response.status_code != 200:
                print(f"Geoapify Routing API error: {response.status_code}")
                return None
            
            data = response.json()
            
            # Extract route info from response
            if "results" in data and len(data["results"]) > 0:
                route = data["results"][0]
                return {
                    "distance_m": route.get("distance", 0),
                    "time_seconds": route.get("time", 0),
                    "time_mins": round(route.get("time", 0) / 60, 1)
                }
            
            return None
        except Exception as e:
            print(f"Geoapify Routing API exception: {e}")
            return None

# Road name cache
ROAD_NAME_CACHE = {}

async def get_road_name_from_osm(osmid: int) -> str:
    """Get road name from OpenStreetMap Nominatim API using osmid"""
    # Check cache first
    if osmid in ROAD_NAME_CACHE:
        return ROAD_NAME_CACHE[osmid]
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            # Nominatim lookup by OSM way ID
            url = f"https://nominatim.openstreetmap.org/lookup"
            params = {
                "osm_ids": f"W{osmid}",
                "format": "json"
            }
            headers = {
                "User-Agent": "StreetSafe/1.0 (pedestrian safety app)"
            }
            
            response = await client.get(url, params=params, headers=headers)
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            
            if data and len(data) > 0:
                road_name = data[0].get("name") or data[0].get("display_name", "").split(",")[0]
                ROAD_NAME_CACHE[osmid] = road_name
                return road_name
            
            return None
        except Exception as e:
            print(f"OSM Nominatim error: {e}")
            return None

async def get_segment_road_name(segment_id: int) -> str:
    """Get road name for a segment"""
    seg = SEG_BY_ID.get(segment_id)
    if not seg:
        return None
    
    osmid = seg.get("osmid")
    if not osmid:
        return None
    
    return await get_road_name_from_osm(osmid)

# --------------------------------------------------------------
# SCORING ENGINE
# --------------------------------------------------------------
def tag_adjust(tags):
    return sum(TAG_EFFECTS.get(tag.lower(), 0) for tag in tags)

def persona_adjust(persona, tags):
    if persona == "woman" and "harassment" in [t.lower() for t in tags]:
        return -0.10
    return 0

def time_decay(age_seconds):
    days = age_seconds / 86400
    return math.exp(-0.08 * days)

def time_of_day():
    hour = time.localtime().tm_hour
    if 5 <= hour < 11: return "morning"
    if 11 <= hour < 17: return "afternoon"
    if 17 <= hour < 22: return "evening"
    return "night"

def compute_segment_score(segment_id):
    now = int(time.time())
    fb_items = [fb for fb in FEEDBACK_LIST if fb["segment_id"] == segment_id]
    
    if not fb_items:
        return {"segment_id": segment_id, "score": 0.5, "confidence": 0, "num_feedback": 0}
    
    weighted_sum = 0
    total_weight = 0
    
    for fb in fb_items:
        base = fb["rating"] / 5
        adj = base + tag_adjust(fb.get("tags", []))
        adj += persona_adjust(fb.get("persona", "walker"), fb.get("tags", []))
        adj = max(0, min(1, adj))
        
        age = now - fb.get("timestamp", now)
        w = time_decay(age) * fb.get("trust_weight", 1.0)
        
        weighted_sum += adj * w
        total_weight += w
    
    score = weighted_sum / total_weight if total_weight > 0 else 0.5
    confidence = 1 - math.exp(-len(fb_items) / 4)
    
    return {
        "segment_id": segment_id,
        "score": round(score, 3),
        "confidence": round(confidence, 3),
        "num_feedback": len(fb_items)
    }

def find_segment_at_point(lat, lng):
    """Find the nearest segment to a point - optimized for large datasets"""
    p = Point(lng, lat)
    closest = None
    min_d = float("inf")
    
    # For performance, only check segments near the point
    # by filtering to a bounding box first
    search_radius = 0.001  # ~100m in degrees
    
    for seg in SEGMENTS:
        seg_id = seg["segment_id"]
        coords = seg["coordinates"]
        
        # Quick bounding box check
        lngs = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        if not (min(lngs) - search_radius <= lng <= max(lngs) + search_radius and
                min(lats) - search_radius <= lat <= max(lats) + search_radius):
            continue
        
        line = get_seg_line(seg_id)
        if line:
            d = p.distance(line)
            if d < min_d:
                min_d = d
                closest = seg_id
    
    return closest

def save_scores():
    with open(SCORES_FILE, "w") as f:
        json.dump(SCORES, f, indent=2)

def save_feedback():
    with open(FEEDBACK_FILE, "w") as f:
        json.dump(FEEDBACK_LIST, f, indent=2)

def regenerate_heatmap():
    def score_to_color(score):
        if score is None:
            return "#666666"
        if score >= 0.8:
            return "#00ff00"
        if score >= 0.5:
            return "#ffaa00"
        return "#ff0066"
    
    features = []
    for seg in SEGMENTS:
        seg_id = seg["segment_id"]
        coords = seg["coordinates"]
        
        score_entry = SCORES.get(str(seg_id))
        score_value = score_entry["score"] if score_entry else None
        
        color = score_to_color(score_value)
        
        feature = {
            "type": "Feature",
            "properties": {
                "segment_id": seg_id,
                "score": score_value,
                "color": color
            },
            "geometry": {
                "type": "LineString",
                "coordinates": coords
            }
        }
        features.append(feature)
    
    geojson_output = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open("safety_heatmap.geojson", "w") as f:
        json.dump(geojson_output, f)

# --------------------------------------------------------------
# ROUTING FUNCTIONS
# --------------------------------------------------------------
def get_safety_score(segment_id):
    if str(segment_id) in SCORES:
        return SCORES[str(segment_id)]["score"]
    return 0.5

def find_closest_node(lat, lng):
    best_node = None
    best_dist = float("inf")
    target = Point(lng, lat)
    
    for node, coord in NODE_COORDS.items():
        d = target.distance(Point(coord[0], coord[1]))
        if d < best_dist:
            best_dist = d
            best_node = node
    
    return best_node

def route_to_coords(node_list):
    coords = []
    for node in node_list:
        x, y = NODE_COORDS[node]
        coords.append([x, y])
    return coords

def get_route_segments(node_list):
    segments = []
    total_length = 0
    total_score = 0
    scored_count = 0
    
    for i in range(len(node_list) - 1):
        u = node_list[i]
        v = node_list[i + 1]
        edge = G[u][v]
        seg_id = edge["segment_id"]
        length = edge["length"]
        score = get_safety_score(seg_id)
        
        segments.append(SegmentInfo(
            segment_id=seg_id,
            length=length,
            score=score
        ))
        total_length += length
        total_score += score
        scored_count += 1
    
    # Calculate estimated walking time (5 km/h = 83.33 m/min)
    WALKING_SPEED_M_PER_MIN = 83.33
    estimated_time = total_length / WALKING_SPEED_M_PER_MIN
    
    return {
        "segments": segments,
        "total_length": round(total_length, 2),
        "avg_safety_score": round(total_score / scored_count, 2) if scored_count > 0 else 0.5,
        "estimated_time_mins": round(estimated_time, 1)
    }

def compute_fastest_route(start_node, end_node):
    try:
        path = nx.shortest_path(G, start_node, end_node, weight="length")
        return path
    except nx.NetworkXNoPath:
        return None

def compute_safest_route(start_node, end_node):
    try:
        G2 = G.copy()
        for u, v, data in G2.edges(data=True):
            seg_id = data["segment_id"]
            base_length = data["length"]
            score = get_safety_score(seg_id)
            data["weight"] = base_length * (2 - score)
        
        path = nx.shortest_path(G2, start_node, end_node, weight="weight")
        return path
    except nx.NetworkXNoPath:
        return None

# --------------------------------------------------------------
# API ROUTES
# --------------------------------------------------------------
@app.get("/")
async def root():
    return {
        "service": "StreetSafe API",
        "version": "1.0",
        "status": "running",
        "endpoints": [
            "/api/route",
            "/api/heatmap",
            "/api/feedback",
            "/api/tags",
            "/api/health"
        ]
    }

@app.get("/api/heatmap")
async def get_heatmap():
    """Return the safety heatmap GeoJSON from file"""
    try:
        with open("safety_heatmap.geojson") as f:
            return json.load(f)
    except FileNotFoundError:
        # Fallback: return empty heatmap if file doesn't exist
        return {
            "type": "FeatureCollection",
            "features": []
        }

@app.get("/safety_heatmap.geojson")
async def geojson():
    """Legacy endpoint - serves the heatmap file"""
    return FileResponse("safety_heatmap.geojson")

@app.post("/api/reset-heatmap")
async def reset_heatmap():
    """Regenerate segment scores and heatmap with random safety scores for demonstration purposes"""
    import random
    
    # Generate random scores for all segments and save to segment_scores.json
    new_scores = {}
    for seg in SEGMENTS:
        seg_id = str(seg['segment_id'])
        score = round(random.uniform(0, 1), 2)
        new_scores[seg_id] = {
            "segment_id": int(seg_id),
            "score": score,
            "confidence": 0.5,
            "num_feedback": 1
        }
    
    # Update global SCORES dictionary
    SCORES.clear()
    SCORES.update(new_scores)
    
    # Save to file
    with open(SCORES_FILE, 'w') as f:
        json.dump(SCORES, f, indent=2)
    
    # Regenerate heatmap from segment_scores.json
    def score_to_color(score):
        if score is None:
            return "#666666"
        if score >= 0.8:
            return "#00ff00"
        if score >= 0.5:
            return "#ffaa00"
        return "#ff0066"
    
    features = []
    for seg in SEGMENTS:
        seg_id = seg["segment_id"]
        coords = seg["coordinates"]
        
        score_entry = SCORES.get(str(seg_id))
        score_value = score_entry["score"] if score_entry else None
        
        color = score_to_color(score_value)
        
        feature = {
            "type": "Feature",
            "properties": {
                "segment_id": seg_id,
                "score": score_value,
                "color": color
            },
            "geometry": {
                "type": "LineString",
                "coordinates": coords
            }
        }
        features.append(feature)
    
    geojson_output = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open("safety_heatmap.geojson", "w") as f:
        json.dump(geojson_output, f)
    
    green_count = sum(1 for f in features if f["properties"]["score"] and f["properties"]["score"] >= 0.8)
    orange_count = sum(1 for f in features if f["properties"]["score"] and 0.5 <= f["properties"]["score"] < 0.8)
    red_count = sum(1 for f in features if f["properties"]["score"] and f["properties"]["score"] < 0.5)
    
    return {
        "status": "success",
        "message": f"Heatmap reset with {len(features)} randomly scored segments",
        "stats": {
            "total": len(features),
            "green": green_count,
            "orange": orange_count,
            "red": red_count
        }
    }

# Place Search Endpoints
@app.get("/api/places/search")
async def search_places(query: str, limit: int = 5):
    """Search for places by name using Geoapify"""
    if len(query) < 2:
        return {"results": []}
    
    results = await geocode_place(query, limit)
    return {"results": results}

@app.get("/api/places/autocomplete")
async def autocomplete_places(query: str, limit: int = 5):
    """Autocomplete place names using Geoapify"""
    if len(query) < 2:
        return {"results": []}
    
    results = await autocomplete_place(query, limit)
    return {"results": results}

# Route by coordinates
@app.post("/api/route", response_model=RouteResponse)
async def get_route(request: RouteRequest):
    start_node = find_closest_node(request.start_lat, request.start_lng)
    end_node = find_closest_node(request.end_lat, request.end_lng)
    
    if not start_node or not end_node:
        raise HTTPException(status_code=400, detail="Could not find nearby road segments")
    
    result = {
        "start_node": start_node,
        "end_node": end_node,
        "start_coords": NODE_COORDS[start_node],
        "end_coords": NODE_COORDS[end_node]
    }
    
    # Get real-time walking time from Geoapify API
    api_time = await get_walking_time_from_api(
        request.start_lat, request.start_lng,
        request.end_lat, request.end_lng
    )
    
    if request.route_type in ['fastest', 'both']:
        fastest_path = compute_fastest_route(start_node, end_node)
        if fastest_path:
            route_data = get_route_segments(fastest_path)
            # Use API time if available, otherwise use calculated time
            if api_time:
                route_data["estimated_time_mins"] = api_time["time_mins"]
            result["fastest"] = RouteInfo(
                coordinates=route_to_coords(fastest_path),
                **route_data
            )
    
    if request.route_type in ['safest', 'both']:
        safest_path = compute_safest_route(start_node, end_node)
        if safest_path:
            route_data = get_route_segments(safest_path)
            # For safest route, scale API time by distance ratio (safest is usually longer)
            if api_time and result.get("fastest"):
                distance_ratio = route_data["total_length"] / result["fastest"].total_length if result["fastest"].total_length > 0 else 1
                route_data["estimated_time_mins"] = round(api_time["time_mins"] * distance_ratio, 1)
            result["safest"] = RouteInfo(
                coordinates=route_to_coords(safest_path),
                **route_data
            )
    
    return result

# Route by place names
@app.post("/api/route/places")
async def get_route_by_places(request: RouteByPlaceRequest):
    """Get route by searching place names"""
    
    # Search for start location
    start_results = await geocode_place(request.start_query, limit=1)
    if not start_results:
        raise HTTPException(status_code=404, detail=f"Could not find location: {request.start_query}")
    
    start_place = start_results[0]
    
    # Search for end location
    end_results = await geocode_place(request.end_query, limit=1)
    if not end_results:
        raise HTTPException(status_code=404, detail=f"Could not find location: {request.end_query}")
    
    end_place = end_results[0]
    
    # Find closest nodes
    start_node = find_closest_node(start_place["lat"], start_place["lng"])
    end_node = find_closest_node(end_place["lat"], end_place["lng"])
    
    if not start_node or not end_node:
        raise HTTPException(status_code=400, detail="Could not find nearby road segments")
    
    result = {
        "start_node": start_node,
        "end_node": end_node,
        "start_coords": NODE_COORDS[start_node],
        "end_coords": NODE_COORDS[end_node],
        "start_place": start_place["formatted"],
        "end_place": end_place["formatted"]
    }
    
    if request.route_type in ['fastest', 'both']:
        fastest_path = compute_fastest_route(start_node, end_node)
        if fastest_path:
            result["fastest"] = {
                "coordinates": route_to_coords(fastest_path),
                **get_route_segments(fastest_path)
            }
    
    if request.route_type in ['safest', 'both']:
        safest_path = compute_safest_route(start_node, end_node)
        if safest_path:
            result["safest"] = {
                "coordinates": route_to_coords(safest_path),
                **get_route_segments(safest_path)
            }
    
    return result

# Feedback endpoint
@app.post("/api/feedback", response_model=FeedbackResponse)
async def submit_feedback(request: FeedbackRequest):
    if request.segment_id:
        segment_id = request.segment_id
    elif request.lat and request.lng:
        segment_id = find_segment_at_point(request.lat, request.lng)
    else:
        raise HTTPException(status_code=400, detail="Must provide segment_id or lat/lng")
    
    if segment_id not in SEG_BY_ID:
        raise HTTPException(status_code=404, detail=f"Segment {segment_id} not found")
    
    if not 1 <= request.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    feedback = {
        "segment_id": segment_id,
        "rating": request.rating,
        "tags": request.tags or [],
        "timestamp": int(time.time()),
        "time_of_day": time_of_day(),
        "persona": request.persona or "walker",
        "trust_weight": 1.0,
        "comment": request.comment or ""
    }
    
    FEEDBACK_LIST.append(feedback)
    save_feedback()
    
    new_score_data = compute_segment_score(segment_id)
    SCORES[str(segment_id)] = new_score_data
    save_scores()
    
    regenerate_heatmap()
    
    print(f"📝 New feedback for segment {segment_id}: rating={request.rating}, tags={request.tags}")
    
    return FeedbackResponse(
        success=True,
        segment_id=segment_id,
        new_score=new_score_data["score"],
        message=f"Thanks! Segment {segment_id} safety score updated to {new_score_data['score']}"
    )

# Bulk feedback endpoint for fast journey rating
@app.post("/api/feedback/bulk", response_model=BulkFeedbackResponse)
async def submit_bulk_feedback(request: BulkFeedbackRequest):
    if not 1 <= request.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    if not request.segment_ids:
        raise HTTPException(status_code=400, detail="Must provide at least one segment_id")
    
    updated_count = 0
    timestamp = int(time.time())
    current_time = time_of_day()
    
    for segment_id in request.segment_ids:
        if segment_id not in SEG_BY_ID:
            continue
        
        feedback = {
            "segment_id": segment_id,
            "rating": request.rating,
            "tags": request.tags or [],
            "timestamp": timestamp,
            "time_of_day": current_time,
            "persona": request.persona or "walker",
            "trust_weight": 1.0,
            "comment": ""
        }
        
        FEEDBACK_LIST.append(feedback)
        new_score_data = compute_segment_score(segment_id)
        SCORES[str(segment_id)] = new_score_data
        updated_count += 1
    
    # Save once after all updates
    save_feedback()
    save_scores()
    regenerate_heatmap()
    
    print(f"📝 Bulk feedback: {updated_count} segments rated {request.rating} stars")
    
    return BulkFeedbackResponse(
        success=True,
        segments_updated=updated_count,
        message=f"Successfully rated {updated_count} roads!"
    )

@app.get("/api/segment/{segment_id}")
async def get_segment_info(segment_id: int):
    if segment_id not in SEG_BY_ID:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    seg = SEG_BY_ID[segment_id]
    score_data = SCORES.get(str(segment_id), {"score": 0.5, "confidence": 0, "num_feedback": 0})
    feedback = [fb for fb in FEEDBACK_LIST if fb["segment_id"] == segment_id]
    
    # Get road name from OSM
    road_name = await get_segment_road_name(segment_id)
    
    return {
        "segment_id": segment_id,
        "road_name": road_name or f"Road #{segment_id}",
        "osmid": seg.get("osmid"),
        "coordinates": seg["coordinates"],
        "length": seg["length"],
        "score": score_data.get("score", 0.5),
        "confidence": score_data.get("confidence", 0),
        "num_feedback": score_data.get("num_feedback", 0),
        "recent_tags": list(set(tag for fb in feedback[-5:] for tag in fb.get("tags", [])))
    }

@app.get("/api/scores")
async def get_scores():
    return SCORES

@app.get("/api/feedback")
async def get_all_feedback():
    return {"count": len(FEEDBACK_LIST), "feedback": FEEDBACK_LIST[-50:]}

@app.get("/api/tags")
async def get_available_tags():
    return {
        "negative": ["dark", "isolated", "harassment", "dogs", "nolight"],
        "positive": ["crowd", "welllit", "busy", "safe", "cameras"]
    }

@app.get("/api/health")
async def health():
    return {
        "status": "ok", 
        "nodes": G.number_of_nodes(), 
        "edges": G.number_of_edges(),
        "scored_segments": len(SCORES),
        "total_feedback": len(FEEDBACK_LIST),
        "geoapify_configured": bool(GEOAPIFY_API_KEY)
    }

if __name__ == '__main__':
    import uvicorn
    print("\n🚀 SafeTrace API Server starting...")
    print("   Open http://localhost:8001 in your browser\n")
    uvicorn.run(app, host="0.0.0.0", port=8001)
