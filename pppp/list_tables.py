import os
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client

backend_env = Path("c:/Users/DeepakPN/Downloads/proj/scrap_link/pppp/backend_ml/.env")
load_dotenv(backend_env)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def list_tables():
    # This is a bit tricky with the python client, 
    # but we can try information_schema if we have permission or just hit common names.
    # Better: check the migrations folder again.
    pass

if __name__ == "__main__":
    # Let's check migrations again for a 'notifications' table.
    import glob
    migrations = glob.glob("c:/Users/DeepakPN/Downloads/proj/scrap_link/pppp/supabase/migrations/*.sql")
    for m in migrations:
        with open(m, 'r') as f:
            content = f.read()
            if "CREATE TABLE" in content:
                print(f"Tables in {m}:")
                for line in content.split("\n"):
                    if "CREATE TABLE" in line:
                        print(f"  {line}")
