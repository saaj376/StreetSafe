# backend/main.py

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from datetime import datetime
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# --- IMPORT SERVICES & INITIALIZERS ---
from services.riskscoreservice import load_risk_and_graph_data, get_graph 
from services.shadowroute import start_shadow_route_tracker
from services.supabaseservice import initialize_supabase_client # New: For DB connection

# --- IMPORT ROUTER MODULES ---
from routes import routingservice
from routes import sosservice        # New: Handles /sos/* endpoints
from routes import safetyalertservice # New: Handles /alerts/* endpoints
from routes import aiservice         # New: Handles /ai/* endpoints


# --- 1. INITIALIZE FASTAPI APP ---
app = FastAPI(
    title="SafeTrace X Backend API",
    description="Intelligent Safety Routing and Emergency System",
    version="1.0.0"
)

# --- 2. CORS MIDDLEWARE ---
# Allows the React frontend to communicate with this backend API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins during development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- 3. STARTUP EVENT: LOAD DATA AND INITIALIZE SYSTEMS ---
@app.on_event("startup")
async def startup_event():
    """
    Called once when the application server starts. 
    Loads persistent data and initializes external connections/threads.
    """
    print(f"--- SafeTrace X Startup: {datetime.now()} ---")
    
    # CORE DATA LOADING
    load_risk_and_graph_data()
    
    # EXTERNAL CONNECTIONS
    initialize_supabase_client()
    
    # REAL-TIME SYSTEMS
    start_shadow_route_tracker() # Starts the background thread for crowd intelligence
    
    # HEALTH CHECK
    if get_graph() is None:
        print("CRITICAL WARNING: Routing graph failed to load.")
    else:
        print("All core data and systems are successfully initialized.")
    print("-------------------------------------------------")


# --- 4. INCLUDE ROUTER MODULES ---
# This registers all your API endpoints with the FastAPI application
app.include_router(routingservice.router) 
app.include_router(sosservice.router) 
app.include_router(safetyalertservice.router)
app.include_router(aiservice.router)


# --- 5. ROOT HEALTH CHECK ENDPOINT ---
@app.get("/")
async def root():
    """Simple health check to verify the API is running."""
    graph_status = "READY" if get_graph() else "NOT_LOADED"
    return {
        "service": "SafeTrace X API", 
        "status": "online", 
        "graph_status": graph_status
    }