-- Migration to add proposed_slots to pickup_requests
ALTER TABLE IF EXISTS public.pickup_requests 
ADD COLUMN IF NOT EXISTS proposed_slots text; -- Stringified JSON array of slot strings
