#!/usr/bin/env python
"""
Test script to verify the routing API works correctly.
Run this after starting the backend server with: uvicorn main:app --reload
"""

import requests
import json
import sys

# Configuration
BACKEND_URL = "http://localhost:8001"
API_ENDPOINT = f"{BACKEND_URL}/route"

def test_health():
    """Test the routing health endpoint."""
    print("\n" + "="*60)
    print("TEST 1: Routing Service Health Check")
    print("="*60)
    
    try:
        response = requests.get(f"{API_ENDPOINT}/health")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("graph_loaded"):
                print("✓ Graph is loaded and ready!")
                return True
            else:
                print("✗ Graph is not loaded!")
                return False
    except Exception as e:
        print(f"✗ Error: {e}")
        print(f"Make sure the backend is running at {BACKEND_URL}")
        return False

def test_route_calculation(mode="safe", 
                           start_lat=13.0342, start_lon=80.2206,  # Chennai, India
                           end_lat=13.0881, end_lon=80.2707):  # Chennai, India
    """Test route calculation with specific coordinates."""
    print(f"\n" + "="*60)
    print(f"TEST 2: Route Calculation ({mode} mode)")
    print("="*60)
    
    payload = {
        "start_lat": start_lat,
        "start_lon": start_lon,
        "end_lat": end_lat,
        "end_lon": end_lon
    }
    
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(f"{API_ENDPOINT}/{mode}", json=payload)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✓ Route calculated successfully!")
            print(f"  - Waypoints: {len(data['route_coords'])}")
            print(f"  - Distance: {data['distance_approx_km']} km")
            print(f"  - Mode: {data['mode_used']}")
            print(f"  - First waypoint: ({data['route_coords'][0]['lat']}, {data['route_coords'][0]['lon']})")
            print(f"  - Last waypoint: ({data['route_coords'][-1]['lat']}, {data['route_coords'][-1]['lon']})")
            return True
        else:
            print(f"✗ Error: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
            return False
    except Exception as e:
        print(f"✗ Exception: {e}")
        return False

def test_all_modes():
    """Test all routing modes."""
    print(f"\n" + "="*60)
    print("TEST 3: All Routing Modes")
    print("="*60)
    
    modes = ['safe', 'balanced', 'stealth', 'escort']
    results = {}
    
    # Use valid Chennai coordinates
    start_lat, start_lon = 13.0342, 80.2206
    end_lat, end_lon = 13.0881, 80.2707
    
    for mode in modes:
        print(f"\nTesting mode: {mode}")
        try:
            payload = {
                "start_lat": start_lat,
                "start_lon": start_lon,
                "end_lat": end_lat,
                "end_lon": end_lon
            }
            response = requests.post(f"{API_ENDPOINT}/{mode}", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                results[mode] = {
                    "status": "✓ Success",
                    "waypoints": len(data['route_coords']),
                    "distance_km": data['distance_approx_km']
                }
                print(f"  ✓ {mode}: {len(data['route_coords'])} waypoints, {data['distance_approx_km']} km")
            else:
                results[mode] = {"status": f"✗ Failed with code {response.status_code}"}
                print(f"  ✗ {mode}: Failed")
        except Exception as e:
            results[mode] = {"status": f"✗ Error: {str(e)}"}
            print(f"  ✗ {mode}: Error - {e}")
    
    print(f"\nSummary:")
    for mode, result in results.items():
        print(f"  {mode}: {result['status']}")
    
    return all("Success" in str(r['status']) for r in results.values())

def test_invalid_mode():
    """Test invalid routing mode."""
    print(f"\n" + "="*60)
    print("TEST 4: Invalid Mode Handling")
    print("="*60)
    
    payload = {
        "start_lat": 13.0342,
        "start_lon": 80.2206,
        "end_lat": 13.0881,
        "end_lon": 80.2707
    }
    
    try:
        response = requests.post(f"{API_ENDPOINT}/invalid_mode", json=payload)
        
        if response.status_code == 400:
            print(f"✓ Invalid mode correctly rejected with 400 status")
            print(f"Error message: {response.json()['detail']}")
            return True
        else:
            print(f"✗ Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

if __name__ == "__main__":
    print("\n🚀 Starting Routing API Tests...")
    
    # Run tests
    test_results = []
    
    test_results.append(("Health Check", test_health()))
    
    if test_results[-1][1]:  # Only continue if health check passed
        test_results.append(("Route Calculation", test_route_calculation()))
        test_results.append(("All Modes", test_all_modes()))
        test_results.append(("Invalid Mode", test_invalid_mode()))
    
    # Print summary
    print(f"\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for test_name, passed in test_results:
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{test_name}: {status}")
    
    all_passed = all(result for _, result in test_results)
    print(f"\nOverall: {'✓ ALL TESTS PASSED' if all_passed else '✗ SOME TESTS FAILED'}")
    
    sys.exit(0 if all_passed else 1)