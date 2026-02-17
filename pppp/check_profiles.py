import os
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client

backend_env = Path("c:/Users/DeepakPN/Downloads/proj/scrap_link/pppp/backend_ml/.env")
load_dotenv(backend_env)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_user_profile(email):
    print(f"Checking profile for: {email}")
    resp = supabase.from_("users").select("user_id, email, name, role").eq("email", email).execute()
    if resp.data:
        p = resp.data[0]
        print(f"UID: {p.get('user_id')}, Email: {p.get('email')}, Name: {p.get('name')}, Role: {p.get('role')}")
    else:
        print("❌ Profile NOT FOUND in 'users' table.")

if __name__ == "__main__":
    check_user_profile("sowmya@techsolveengine.com")
    check_user_profile("deepakpn04@gmail.com")
