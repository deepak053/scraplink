import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

# Load env variables
load_dotenv(".env")

url = os.getenv("VITE_SUPABASE_URL")
key = os.getenv("VITE_SUPABASE_ANON_KEY")

if not url or not key:
    print("Missing Supabase URL or Key")
    exit(1)

supabase: Client = create_client(url, key)

email = "debug.test.user.999@gmail.com"
password = "Password123!"

print(f"Attempting to sign up {email}...")

try:
    res = supabase.auth.sign_up({"email": email, "password": password})
    
    user = res.user
    session = res.session
    
    print(f"Sign up result: User={user.id if user else 'None'}, Session={'Yes' if session else 'No'}")

    if user:
        print("Attempting to insert profile...")
        try:
            profile_data = {
                "user_id": user.id,
                "name": "Debug User",
                "email": email,
                "phone": "1234567890",
                "role": "recycler",
                "latitude": 0,
                "longitude": 0
            }
            data, count = supabase.table("users").insert(profile_data).execute()
            print("Profile inserted successfully!")
        except Exception as e:
            print(f"Profile insert failed: {e}")
            
    else:
        print("No user created.")

except Exception as e:
    print(f"Sign up failed: {e}")
