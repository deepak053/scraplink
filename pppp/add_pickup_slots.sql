-- Add pickup_slot and slot_notified columns to pickup_requests
ALTER TABLE pickup_requests 
ADD COLUMN IF NOT EXISTS pickup_slot text,
ADD COLUMN IF NOT EXISTS slot_notified boolean DEFAULT false;
