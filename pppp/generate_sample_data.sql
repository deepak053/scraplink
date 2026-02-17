-- FINAL SAMPLE DATA (SIMPLEST VERSION)
-- Run this in your Supabase SQL Editor

-- 1. Create a test recycler
INSERT INTO public.users (user_id, name, email, phone, role, latitude, longitude)
VALUES (
    '00c00000-0000-0000-0000-000000000000', 
    'Test Recycler', 
    'recycler@test.com', 
    '9876543210', 
    'recycler', 
    12.9716, 
    77.5946
)
ON CONFLICT (user_id) DO NOTHING;

-- 2. Create a listing and link it to YOUR registered email
-- IMPORTANT: Replace 'seller@test.com' with the email you used to register
INSERT INTO public.scrap_listings (
    scrap_id, user_id, scrap_type, sub_category, sub_sub_category, 
    weight, estimated_price, description, status, latitude, longitude
)
SELECT 
    'a0000000-0000-0000-0000-000000000000', 
    user_id, 
    'Metal', 
    'Ferrous Metals', 
    'Iron',
    25.5, 
    500, 
    'Iron scrap for training', 
    'available',
    12.9716,
    77.5946
FROM public.users 
WHERE email = 'seller@test.com' -- <-- CHANGE THIS EMAIL IF NEEDED
ON CONFLICT (scrap_id) DO UPDATE SET 
    user_id = EXCLUDED.user_id,
    status = 'available';

-- 3. Create a pickup request for that listing
INSERT INTO public.pickup_requests (request_id, scrap_id, recycler_id, pickup_status)
VALUES (
    'b0000000-0000-0000-0000-000000000000', 
    'a0000000-0000-0000-0000-000000000000', 
    '00c00000-0000-0000-0000-000000000000', 
    'pending'
)
ON CONFLICT (request_id) DO NOTHING;
