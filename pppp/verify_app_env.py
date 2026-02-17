import os
from dotenv import load_dotenv
from pathlib import Path
import sys

BASE_DIR = Path("backend_ml").resolve()
env_path = BASE_DIR / ".env"
print(f"Loading env from {env_path}")
load_dotenv(env_path)

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print(f"SUPABASE_URL: {url}")
print(f"SUPABASE_SERVICE_ROLE_KEY: {'[REDACTED]' if key else 'None'}")

if not url or not key:
    print("MISSING ENV VARS")
else:
    print("ENV VARS OK")

try:
    from supabase import create_client, Client
    print("Supabase import OK")
    client = create_client(url, key)
    print("Supabase client init OK")
except Exception as e:
    print(f"Supabase import/init FAILED: {e}")
except ImportError:
    print("Supabase module NOT FOUND")
