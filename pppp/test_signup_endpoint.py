import requests
import json

url = "http://127.0.0.1:5001/auth/signup"
headers = {"Content-Type": "application/json"}
data = {
    "email": "test.signup.endpoint.1@gmail.com",
    "password": "Password123!",
    "userData": {
        "name": "Test User",
        "role": "recycler",
        "phone": "1234567890",
        "latitude": 0,
        "longitude": 0
    }
}

try:
    print(f"Sending POST to {url}...")
    res = requests.post(url, json=data, timeout=5)
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text}")
except Exception as e:
    print(f"Request failed: {e}")
