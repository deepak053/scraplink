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

def delete_user(email):
    print(f"Attempting to delete user: {email}")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # List users to find the ID (admin_list_users is not always available or pagination needed)
    # But usually we can't just delete by email directly in one go without ID.
    # Actually, supabase-py client (gotrue) typically exposes admin methods.
    
    try:
        # Check if auth.admin exists (depends on version)
        admin_auth = supabase.auth.admin
        
        # List users (naive approach, assuming user is in first page)
        # Using list_users()
        users_response = admin_auth.list_users()
        # users_response might be an object or list depending on version. 
        # In recent versions it returns a UserResponse object containing `users`.
        
        users = []
        if hasattr(users_response, 'users'):
            users = users_response.users
        elif isinstance(users_response, list):
            users = users_response
        else:
            # Fallback for older versions or different shapes
            print(f"Unexpected response format from list_users: {type(users_response)}")
            try:
                users = users_response.get('users', [])
            except:
                pass

        target_user = next((u for u in users if u.email == email), None)
        
        if not target_user:
            print(f"User {email} not found.")
            return

        user_id = target_user.id
        print(f"Found user {email} with ID {user_id}. Deleting...")
        
        admin_auth.delete_user(user_id)
        
        # Also clean up from 'users' table if it exists (though usually cascades or handled manually)
        # We can try to delete from public.users as well just in case
        try:
            supabase.table('users').delete().eq('user_id', user_id).execute()
            print(f"Deleted from public.users table.")
        except Exception as e:
            print(f"Warning: Could not delete from public.users (might already be gone or RLS): {e}")

        print(f"Successfully deleted user {email}.")

    except Exception as e:
        print(f"Error deleting user: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    delete_user("sowmya@techsolveengine.com")
