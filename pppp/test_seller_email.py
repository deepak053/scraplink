import os
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client

backend_env = Path("c:/Users/DeepakPN/Downloads/proj/scrap_link/pppp/backend_ml/.env")
load_dotenv(backend_env)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def test_seller_email_flow():
    print("=" * 60)
    print("TESTING SELLER EMAIL NOTIFICATION FLOW")
    print("=" * 60)
    
    # Get a recent pickup request
    print("\n1. Fetching recent pickup request...")
    requests = supabase.from_("pickup_requests").select("*").order("request_date", desc=True).limit(1).execute()
    
    if not requests.data:
        print("❌ No pickup requests found")
        return
    
    request = requests.data[0]
    print(f"✅ Found request: {request['request_id']}")
    print(f"   Scrap ID: {request['scrap_id']}")
    print(f"   Recycler ID: {request['recycler_id']}")
    print(f"   Pickup Slot: {request.get('pickup_slot', 'Not specified')}")
    
    # Get scrap listing
    print("\n2. Fetching scrap listing...")
    listing = supabase.from_("scrap_listings").select("*").eq("scrap_id", request['scrap_id']).single().execute()
    
    if not listing.data:
        print("❌ Scrap listing not found")
        return
    
    print(f"✅ Found listing: {listing.data['scrap_type']}")
    print(f"   Seller ID: {listing.data['user_id']}")
    
    # Get seller details
    print("\n3. Fetching seller details...")
    seller = supabase.from_("users").select("email, name").eq("user_id", listing.data['user_id']).single().execute()
    
    if not seller.data:
        print("❌ Seller not found in users table")
        return
    
    print(f"✅ Seller found:")
    print(f"   Email: {seller.data['email']}")
    print(f"   Name: {seller.data.get('name', 'Not set')}")
    
    # Get recycler details
    print("\n4. Fetching recycler details...")
    recycler = supabase.from_("users").select("email, name").eq("user_id", request['recycler_id']).single().execute()
    
    if not recycler.data:
        print("❌ Recycler not found")
        return
    
    print(f"✅ Recycler found:")
    print(f"   Email: {recycler.data['email']}")
    print(f"   Name: {recycler.data.get('name', 'Not set')}")
    
    print("\n" + "=" * 60)
    print("EMAIL NOTIFICATION DETAILS")
    print("=" * 60)
    print(f"\n📧 Seller should receive email at: {seller.data['email']}")
    print(f"   From recycler: {recycler.data.get('name', recycler.data['email'])}")
    print(f"   For scrap type: {listing.data['scrap_type']}")
    print(f"   Preferred slot: {request.get('pickup_slot', 'Not specified')}")
    
    print(f"\n📧 Recycler should receive confirmation at: {recycler.data['email']}")
    print(f"   For scrap type: {listing.data['scrap_type']}")
    print(f"   Preferred slot: {request.get('pickup_slot', 'Not specified')}")
    
    print("\n" + "=" * 60)
    print("TROUBLESHOOTING CHECKLIST")
    print("=" * 60)
    print("\n✓ Check if EmailJS is configured in .env file")
    print("✓ Check browser console for email sending logs")
    print("✓ Verify seller email is correct")
    print("✓ Check spam folder in seller's email")
    print("✓ Verify EmailJS quota hasn't been exceeded")

if __name__ == "__main__":
    test_seller_email_flow()
