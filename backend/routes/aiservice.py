# backend/routes/aiservice.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import requests
import json
import traceback

# Define the router
router = APIRouter(
    prefix="/ai",
    tags=["AI Services"]
)

# Gemini API Configuration
import os

# Gemini API Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found in environment variables. AI features will fail.")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

# --- REQUEST MODELS ---

class ItineraryRequest(BaseModel):
    """Request model for itinerary generation"""
    destination: str
    days: int
    travel_style: str  # adventure, relaxation, cultural, budget
    interests: List[str]

class PackingListRequest(BaseModel):
    """Request model for packing list generation"""
    destination: str
    duration: int
    weather: str  # hot, cold, rainy, mixed
    activities: List[str]

# --- RESPONSE MODELS ---

class ItineraryItem(BaseModel):
    time: str
    activity: str
    location: str
    duration: str
    notes: str

class ItineraryResponse(BaseModel):
    itinerary: List[ItineraryItem]
    destination: str
    days: int

class PackingCategory(BaseModel):
    category: str
    items: List[str]

class PackingListResponse(BaseModel):
    packing_list: List[PackingCategory]
    destination: str
    duration: int

class POISearchRequest(BaseModel):
    """Request model for POI search"""
    location: str
    poi_type: str  # restaurants, attractions, transport

class JournalEnhanceRequest(BaseModel):
    """Request model for journal enhancement"""
    title: str
    content: str
    photos_count: int = 0

class JournalEnhanceResponse(BaseModel):
    """Response model for enhanced journal"""
    enhanced_content: str
    original_content: str
    title: str

class POIResult(BaseModel):
    name: str
    type: str
    address: str
    rating: Optional[float] = None
    distance: Optional[str] = None

class POISearchResponse(BaseModel):
    results: List[POIResult]
    location: str
    poi_type: str

# --- HELPER FUNCTIONS ---

def call_gemini_api(prompt: str) -> str:
    """
    Calls the Gemini API with the given prompt and returns the text response.
    Includes retry logic and extended timeout.
    """
    max_retries = 2
    timeout_seconds = 60  # Increased from 30 to 60 seconds
    
    for attempt in range(max_retries):
        try:
            payload = {
                "contents": [{
                    "parts": [{
                        "text": prompt
                    }]
                }],
                "generationConfig": {
                    "temperature": 0.7,
                    "topK": 40,
                    "topP": 0.95,
                }
            }
            
            print(f"[GEMINI] Attempt {attempt + 1}/{max_retries}: Calling API with prompt length: {len(prompt)}")
            print(f"[GEMINI] API URL: {GEMINI_API_URL}?key={GEMINI_API_KEY[:10]}...")
            print(f"[GEMINI] Timeout: {timeout_seconds} seconds")
            
            response = requests.post(
                f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                json=payload,
                timeout=timeout_seconds
            )
            
            print(f"[GEMINI] Response status: {response.status_code}")
            print(f"[GEMINI] Response text: {response.text[:500]}")
            
            if response.status_code != 200:
                error_msg = response.text
                print(f"[GEMINI] Error {response.status_code}: {error_msg}")
                
                # If rate-limited on first attempt, return 429 for fallback
                if response.status_code == 429:
                    raise HTTPException(
                        status_code=429,
                        detail="API rate limited"
                    )
                
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Gemini API error {response.status_code}: {error_msg}"
                )
            
            data = response.json()
            
            if "candidates" not in data or not data["candidates"]:
                raise HTTPException(
                    status_code=500,
                    detail="Invalid Gemini API response: no candidates"
                )
            
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            print(f"[GEMINI] Successfully received response")
            return content
            
        except requests.exceptions.Timeout as e:
            print(f"[GEMINI] Timeout on attempt {attempt + 1}: {str(e)}")
            if attempt < max_retries - 1:
                print(f"[GEMINI] Retrying...")
                continue
            else:
                print(f"[GEMINI] Max retries reached, using fallback")
                raise HTTPException(
                    status_code=504,
                    detail="API request timed out after retries"
                )
        except requests.exceptions.RequestException as e:
            print(f"[GEMINI] Request error on attempt {attempt + 1}: {str(e)}")
            if attempt < max_retries - 1:
                print(f"[GEMINI] Retrying...")
                continue
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"API request failed: {str(e)}"
                )
        except HTTPException:
            raise
        except (KeyError, IndexError) as e:
            print(f"[GEMINI] Response parsing error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Failed to parse API response"
            )

def extract_json(text: str):
    """
    Extracts JSON from the response text.
    """
    # Try direct parsing first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Try extracting array
    import re
    array_match = re.search(r'\[[\s\S]*\]', text)
    if array_match:
        try:
            return json.loads(array_match.group())
        except json.JSONDecodeError:
            pass
    
    # Try extracting object
    obj_match = re.search(r'\{[\s\S]*\}', text)
    if obj_match:
        try:
            return json.loads(obj_match.group())
        except json.JSONDecodeError:
            pass
    
    raise ValueError("Could not extract JSON from response")

def get_sample_itinerary(destination: str, days: int) -> List[dict]:
    """
    Returns a sample itinerary when API is unavailable.
    """
    activities = {
        "Paris": ["Visit Eiffel Tower", "Louvre Museum", "Seine River Cruise", "Champs-Élysées", "Notre-Dame"],
        "Tokyo": ["Senso-ji Temple", "Shibuya Crossing", "Tsukiji Market", "Mount Fuji", "Team Lab Borderless"],
        "London": ["Big Ben", "Tower of London", "British Museum", "Oxford Street", "Tower Bridge"],
        "New York": ["Statue of Liberty", "Central Park", "Times Square", "MoMA", "Brooklyn Bridge"],
        "Barcelona": ["Sagrada Familia", "Park Güell", "Las Ramblas", "Gothic Quarter", "Montjuïc"],
    }
    
    dest_activities = activities.get(destination, ["Explore local attractions", "Visit museums", "Try local cuisine", "Shopping", "Cultural experiences"])
    
    itinerary = []
    for day in range(1, days + 1):
        activity_idx = (day - 1) % len(dest_activities)
        activity = dest_activities[activity_idx]
        itinerary.append({
            "time": f"{9 + day}:00 AM",
            "activity": activity,
            "location": destination,
            "duration": "3-4 hours",
            "notes": f"Day {day} of your {days}-day journey. Enjoy exploring!"
        })
    
    return itinerary

def get_sample_packing_list(duration: int, weather: str) -> List[dict]:
    """
    Returns a sample packing list when API is unavailable.
    """
    packing = {
        "hot": {
            "Clothing": ["T-shirts", "Shorts", "Lightweight dresses", "Sandals", "Hat"],
            "Toiletries": ["Sunscreen", "Sunglasses", "Moisturizer"],
            "Accessories": ["Water bottle", "Beach bag", "Light scarf"]
        },
        "cold": {
            "Clothing": ["Sweaters", "Winter coat", "Thermal underwear", "Boots", "Warm hat"],
            "Toiletries": ["Lip balm", "Moisturizer"],
            "Accessories": ["Scarf", "Gloves", "Hand warmer"]
        },
        "rainy": {
            "Clothing": ["Raincoat", "Waterproof jacket", "Water-resistant shoes"],
            "Toiletries": ["Waterproof bag"],
            "Accessories": ["Umbrella", "Waterproof cover for bag"]
        },
        "mixed": {
            "Clothing": ["Layers", "Comfortable pants", "Light jacket", "Comfortable shoes"],
            "Toiletries": ["Moisturizer", "Sunscreen"],
            "Accessories": ["Scarf", "Umbrella"]
        }
    }
    
    base_list = packing.get(weather, packing["mixed"])
    
    return [
        {"category": category, "items": items}
        for category, items in base_list.items()
    ] + [
        {"category": "Electronics", "items": ["Phone", "Charger", "Power bank"]},
        {"category": "Documents", "items": ["Passport", "Travel insurance", "Hotel confirmations"]},
    ]

# --- API ENDPOINTS ---

@router.post("/generate-itinerary", response_model=ItineraryResponse)
async def generate_itinerary(request: ItineraryRequest):
    """
    Generate an AI-powered travel itinerary based on user preferences.
    Falls back to sample itinerary if API is rate-limited.
    """
    try:
        print(f"[AI] Generating itinerary for {request.destination} ({request.days} days, {request.travel_style})")
        
        prompt = f"""Create a detailed {request.days}-day {request.travel_style} travel itinerary for {request.destination}. 
        Interests: {', '.join(request.interests) if request.interests else 'General sightseeing'}. 
        
        For each day, provide specific times (e.g., 9:00 AM - 12:00 PM), activities, locations, duration, and helpful notes.
        
        Return ONLY a valid JSON array (no extra text before or after) with objects like this format:
        [
            {{"time": "9:00 AM", "activity": "activity name", "location": "place", "duration": "3 hours", "notes": "optional notes"}},
            {{"time": "1:00 PM", "activity": "next activity", "location": "another place", "duration": "2 hours", "notes": "tips"}}
        ]"""
        
        try:
            response_text = call_gemini_api(prompt)
            print(f"[AI] Raw response: {response_text[:200]}...")
            
            itinerary_data = extract_json(response_text)
            
            if not isinstance(itinerary_data, list):
                raise ValueError("Response is not a list")
            
            # Validate and convert to ItineraryItem objects
            items = []
            for item in itinerary_data:
                items.append(ItineraryItem(
                    time=item.get("time", ""),
                    activity=item.get("activity", ""),
                    location=item.get("location", ""),
                    duration=item.get("duration", ""),
                    notes=item.get("notes", "")
                ))
            
            return ItineraryResponse(
                itinerary=items,
                destination=request.destination,
                days=request.days
            )
        
        except HTTPException as e:
            # If API is rate-limited or times out, use fallback
            if e.status_code in [429, 504]:
                print(f"[AI] API unavailable ({e.status_code}). Using sample itinerary.")
                sample_data = get_sample_itinerary(request.destination, request.days)
                items = [ItineraryItem(**item) for item in sample_data]
                return ItineraryResponse(
                    itinerary=items,
                    destination=request.destination,
                    days=request.days
                )
            raise
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AI] Error generating itinerary: {str(e)}")
        print(f"[AI] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate itinerary: {str(e)}"
        )

@router.post("/generate-packing-list", response_model=PackingListResponse)
async def generate_packing_list(request: PackingListRequest):
    """
    Generate an AI-powered packing list based on trip details.
    Falls back to sample packing list if API is rate-limited.
    """
    try:
        print(f"[AI] Generating packing list for {request.destination} ({request.duration} days, {request.weather})")
        
        prompt = f"""Create a comprehensive packing list for a {request.duration}-day trip to {request.destination}.
        Weather: {request.weather}
        Activities: {', '.join(request.activities) if request.activities else 'General sightseeing'}
        
        Organize items by category (Clothing, Toiletries, Electronics, Documents, Accessories, etc.).
        
        Return ONLY a valid JSON array (no extra text before or after) with this format:
        [
            {{"category": "Clothing", "items": ["item1", "item2", "item3"]}},
            {{"category": "Toiletries", "items": ["item4", "item5"]}}
        ]"""
        
        try:
            response_text = call_gemini_api(prompt)
            print(f"[AI] Raw response: {response_text[:200]}...")
            
            packing_data = extract_json(response_text)
            
            if not isinstance(packing_data, list):
                raise ValueError("Response is not a list")
            
            # Validate and convert to PackingCategory objects
            categories = []
            for category in packing_data:
                categories.append(PackingCategory(
                    category=category.get("category", ""),
                    items=category.get("items", [])
                ))
            
            return PackingListResponse(
                packing_list=categories,
                destination=request.destination,
                duration=request.duration
            )
        
        except HTTPException as e:
            # If API is rate-limited or times out, use fallback
            if e.status_code in [429, 504]:
                print(f"[AI] API unavailable ({e.status_code}). Using sample packing list.")
                sample_data = get_sample_packing_list(request.duration, request.weather)
                categories = [PackingCategory(**item) for item in sample_data]
                return PackingListResponse(
                    packing_list=categories,
                    destination=request.destination,
                    duration=request.duration
                )
            raise
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AI] Error generating packing list: {str(e)}")
        print(f"[AI] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate packing list: {str(e)}"
        )

def get_sample_poi(location: str, poi_type: str) -> List[dict]:
    """
    Returns sample POI data when API is unavailable.
    """
    chennai_pois = {
        "restaurants": [
            {"name": "Murugan Idli Shop", "type": "restaurant", "address": "Anna Nagar, Chennai", "rating": 4.5, "distance": "2 km"},
            {"name": "Saravana Bhavan", "type": "restaurant", "address": "T Nagar, Chennai", "rating": 4.3, "distance": "3 km"},
            {"name": "Dakshin", "type": "restaurant", "address": "ITC Grand Chola, Chennai", "rating": 4.7, "distance": "5 km"},
            {"name": "Sangeetha Restaurant", "type": "restaurant", "address": "Mylapore, Chennai", "rating": 4.2, "distance": "1.5 km"},
        ],
        "attractions": [
            {"name": "Marina Beach", "type": "attraction", "address": "Marina Beach Road, Chennai", "rating": 4.6, "distance": "0.5 km"},
            {"name": "Kapaleeshwarar Temple", "type": "attraction", "address": "Mylapore, Chennai", "rating": 4.7, "distance": "2 km"},
            {"name": "Fort St. George", "type": "attraction", "address": "Rajaji Salai, Chennai", "rating": 4.4, "distance": "3 km"},
            {"name": "Government Museum", "type": "attraction", "address": "Pantheon Road, Egmore", "rating": 4.5, "distance": "4 km"},
        ],
        "transport": [
            {"name": "Chennai Central Railway Station", "type": "transport", "address": "Poonamallee High Rd, Chennai", "rating": 4.1, "distance": "1 km"},
            {"name": "Chennai Metro - Anna Nagar", "type": "transport", "address": "Anna Nagar, Chennai", "rating": 4.3, "distance": "0.8 km"},
            {"name": "Koyambedu Bus Terminal", "type": "transport", "address": "Koyambedu, Chennai", "rating": 3.9, "distance": "5 km"},
            {"name": "Chennai Airport", "type": "transport", "address": "Meenambakkam, Chennai", "rating": 4.2, "distance": "15 km"},
        ]
    }
    
    return chennai_pois.get(poi_type, [])

@router.post("/search-poi", response_model=POISearchResponse)
async def search_poi(request: POISearchRequest):
    """
    Search for Points of Interest (restaurants, attractions, transport) near a location.
    Falls back to sample data if API is unavailable.
    """
    try:
        print(f"[AI] Searching for {request.poi_type} near {request.location}")
        
        prompt = f"""Find popular {request.poi_type} near {request.location}.
        
        For each result, provide:
        - Name of the place
        - Type: {request.poi_type}
        - Full address
        - Rating (out of 5) if known
        - Approximate distance from {request.location}
        
        Return ONLY a valid JSON array (no extra text) with format:
        [
            {{"name": "Place Name", "type": "{request.poi_type}", "address": "Full Address", "rating": 4.5, "distance": "1 km"}},
            {{"name": "Another Place", "type": "{request.poi_type}", "address": "Address", "rating": 4.2, "distance": "2 km"}}
        ]
        
        Provide 5-10 results."""
        
        try:
            response_text = call_gemini_api(prompt)
            print(f"[AI] Raw response: {response_text[:200]}...")
            
            poi_data = extract_json(response_text)
            
            if not isinstance(poi_data, list):
                raise ValueError("Response is not a list")
            
            # Validate and convert to POIResult objects
            results = []
            for poi in poi_data[:10]:  # Limit to 10 results
                results.append(POIResult(
                    name=poi.get("name", "Unknown"),
                    type=poi.get("type", request.poi_type),
                    address=poi.get("address", "Address not available"),
                    rating=poi.get("rating"),
                    distance=poi.get("distance")
                ))
            
            return POISearchResponse(
                results=results,
                location=request.location,
                poi_type=request.poi_type
            )
        
        except HTTPException as e:
            # If API is rate-limited or times out, use fallback
            if e.status_code in [429, 504]:
                print(f"[AI] API unavailable ({e.status_code}). Using sample POI data.")
                sample_data = get_sample_poi(request.location, request.poi_type)
                results = [POIResult(**poi) for poi in sample_data]
                return POISearchResponse(
                    results=results,
                    location=request.location,
                    poi_type=request.poi_type
                )
            raise
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AI] Error searching POI: {str(e)}")
        print(f"[AI] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to search POI: {str(e)}"
        )

@router.post("/enhance-journal", response_model=JournalEnhanceResponse)
async def enhance_journal(request: JournalEnhanceRequest):
    """
    Enhance a journal entry with AI-generated content that makes it more engaging,
    poetic, and memorable. Preserves the original story while improving narrative quality.
    """
    try:
        # Create a detailed prompt for enhancing the journal
        prompt = f"""You are a creative writing assistant specializing in travel narratives and personal memoirs.

I have a travel journal entry that I'd like you to enhance and make more engaging while preserving the core story and emotions.

Original Entry:
Title: {request.title}
Content: {request.content}

Please enhance this journal entry by:
1. Making the narrative more vivid and descriptive
2. Adding sensory details (sights, sounds, smells, textures)
3. Improving the emotional depth and reflection
4. Organizing thoughts in a more compelling way
5. Adding thoughtful insights about the travel experience
{f'6. Mentioning the {request.photos_count} photos that were captured' if request.photos_count > 0 else ''}

Keep the same general story and facts, but make it more memorable and beautifully written.
Write the enhanced version directly without any introductions or explanations."""

        enhanced_text = call_gemini_api(prompt)
        
        return JournalEnhanceResponse(
            enhanced_content=enhanced_text,
            original_content=request.content,
            title=request.title
        )
    
    except HTTPException as e:
        # If API is rate-limited or times out, return a graceful fallback
        if e.status_code in [429, 504]:
            print(f"[AI] API unavailable ({e.status_code}). Returning enhanced fallback.")
            fallback_enhanced = f"{request.content}\n\n[AI Enhancement temporarily unavailable - showing original content]"
            return JournalEnhanceResponse(
                enhanced_content=fallback_enhanced,
                original_content=request.content,
                title=request.title
            )
        raise
    
    except Exception as e:
        print(f"[AI] Error enhancing journal: {str(e)}")
        print(f"[AI] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to enhance journal: {str(e)}"
        )

@router.get("/health")
async def ai_health():
    """
    Health check for AI services.
    """
    return {
        "status": "healthy",
        "services": ["itinerary-builder", "packing-assistant", "poi-search", "journal-enhancement"],
        "models": ["gemini-2.5-flash"]
    }
