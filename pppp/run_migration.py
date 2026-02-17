import os
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client

backend_env = Path("c:/Users/DeepakPN/Downloads/proj/scrap_link/pppp/backend_ml/.env")
load_dotenv(backend_env)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

migration_sql = """
ALTER TABLE IF EXISTS public.pickup_requests 
ADD COLUMN IF NOT EXISTS proposed_slots text;
"""

try:
    # Use rpc if available, or just try to execute a simple query to see if we can run raw SQL
    # Actually, the python client doesn't support raw SQL easily unless there's an RPC.
    # I'll check if there's an rpc for exec_sql or similar.
    # If not, I'll advise the user to run it in the SQL editor.
    print("Executing migration...")
    # There is no direct way to run raw SQL via supabase-py without an RPC.
    # However, I can try to see if 'exec_sql' RPC exists (common in some setups).
    # But since I don't know, I'll try to just insert a dummy and see if it fails or something? 
    # No, better way: I'll use the 'postgres' tool if I had it. I don't.
    # I'll just rely on the fact that I've provided the SQL for now and search if there's any other way.
    
    # Wait, I see 'master_fix.sql'. Let's see how that was run.
    # Conversations show "applying the necessary SQL scripts to their new Supabase project".
    # User might be doing it manually.
    
    print("Please run the following SQL in your Supabase SQL Editor:")
    print(migration_sql)
except Exception as e:
    print(f"Error: {e}")
