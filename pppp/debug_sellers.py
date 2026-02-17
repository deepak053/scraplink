import os
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client

backend_env = Path("c:/Users/DeepakPN/Downloads/proj/scrap_link/pppp/backend_ml/.env")
load_dotenv(backend_env)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def debug_seller_info():
    print("Fetching recent listings...")
    listings = supabase.from_("scrap_listings").select("scrap_id, user_id, scrap_type").order("posted_date", desc=True).limit(5).execute()
    
    for l in listings.data:
        uid = l.get("user_id")
        sid = l.get("scrap_id")
        stype = l.get("scrap_type")
        print(f"Listing: {stype} ({sid})")
        print(f"  Seller UID: {uid}")
        
        if uid:
            user = supabase.from_("users").select("email, name").eq("user_id", uid).execute()
            if user.data:
                print(f"  Seller Email: {user.data[0].get('email')}")
                print(f"  Seller Name: {user.data[0].get('name')}")
            else:
                print(f"  ❌ Seller profile NOT FOUND in 'users' table.")
        else:
            print("  ❌ No user_id on listing.")
        print("-" * 20)

if __name__ == "__main__":
    debug_seller_info()
