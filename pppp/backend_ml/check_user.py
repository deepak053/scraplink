import os
import sys
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

def check_user(email):
    print(f"Checking status for user: {email}")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    try:
        admin_auth = supabase.auth.admin
        users_response = admin_auth.list_users()
        
        users = []
        if hasattr(users_response, 'users'):
            users = users_response.users
        elif isinstance(users_response, list):
            users = users_response
        else:
            try:
                users = users_response.get('users', [])
            except:
                pass

        target_user = next((u for u in users if u.email == email), None)
        
        if not target_user:
            print(f"❌ User {email} NOT FOUND in Supabase Auth.")
            return

        print(f"✅ User found: {target_user.id}")
        print(f"   Email Confirmed At: {target_user.email_confirmed_at}")
        print(f"   Last Sign In: {target_user.last_sign_in_at}")
        
        if not target_user.email_confirmed_at:
            print("⚠️ WARNING: Email is NOT confirmed. This is likely why login fails.")
            
            # Attempt auto-confirmation if needed
            print("Attempting to auto-confirm email...")
            try:
                # Update user to set email_confirmed_at
                attributes = {"email_confirm": True} # Some clients use this
                # Or user update
                admin_auth.update_user_by_id(target_user.id, {"email_confirm": True})
                print("✅ Auto-confirmed user email.")
            except Exception as e:
                print(f"Failed to auto-confirm: {e}")

    except Exception as e:
        print(f"Error checking user: {e}")

if __name__ == "__main__":
    check_user("sowmya@techsolveengine.com")
