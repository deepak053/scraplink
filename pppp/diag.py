
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv("backend_ml/.env")
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

print(f"URL: {url}")

try:
    # Check if we can get user count
    res = supabase.table("users").select("count", count="exact").execute()
    print(f"✅ Table 'users' has {res.count} records.")
except Exception as e:
    print(f"❌ Table 'users' error: {e}")

try:
    # Check scrap_listings
    res = supabase.table("scrap_listings").select("*").limit(1).execute()
    print(f"✅ Table 'scrap_listings' exists. Columns: {res.data[0].keys() if res.data else 'No data'}")
except Exception as e:
    print(f"❌ Table 'scrap_listings' error: {e}")

try:
    # Check RPC existence by trying to call it
    res = supabase.rpc("admin_login", {"email_input": "test@test.com", "password_input": "test"}).execute()
    print("✅ RPC 'admin_login' exists.")
except Exception as e:
    print(f"❌ RPC 'admin_login' error: {e}")
