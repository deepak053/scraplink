import os
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client

backend_env = Path("c:/Users/DeepakPN/Downloads/proj/scrap_link/pppp/backend_ml/.env")
load_dotenv(backend_env)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_columns(table_name):
    print(f"Columns for {table_name}:")
    # Using a different approach to get column names if possible, but limit 1 is fine
    resp = supabase.from_(table_name).select("*").limit(1).execute()
    if resp.data:
        columns = list(resp.data[0].keys())
        print(", ".join(columns))
    else:
        print("No data in table to check columns.")

if __name__ == "__main__":
    check_columns("scrap_listings")
    print("-" * 20)
    check_columns("users")
    print("-" * 20)
    check_columns("pickup_requests")
