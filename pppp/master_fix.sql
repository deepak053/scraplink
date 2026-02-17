-- 1. Add missing columns to scrap_listings
ALTER TABLE IF EXISTS public.scrap_listings 
ADD COLUMN IF NOT EXISTS sub_category text,
ADD COLUMN IF NOT EXISTS sub_sub_category text,
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision;

-- 1b. Add pickup columns
ALTER TABLE IF EXISTS public.pickup_requests 
ADD COLUMN IF NOT EXISTS pickup_slot text,
ADD COLUMN IF NOT EXISTS proposed_slots text,
ADD COLUMN IF NOT EXISTS slot_notified boolean DEFAULT false;

-- 2. Create missing tables
CREATE TABLE IF NOT EXISTS public.admin (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    password text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Insert default admin if table is empty
INSERT INTO public.admin (email, password)
VALUES ('sowmya@techsolveengine.com', 'gOWDA2123')
ON CONFLICT (email) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id text,
    action_type text NOT NULL,
    details jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listing_flags (
    flag_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scrap_id uuid REFERENCES scrap_listings(scrap_id) ON DELETE CASCADE,
    reason text,
    flagged_by text,
    flagged_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pickup_flags (
    flag_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid REFERENCES pickup_requests(request_id) ON DELETE CASCADE,
    reason text,
    flagged_by text,
    flagged_at timestamptz DEFAULT now()
);

-- Table for ML Backend training
CREATE TABLE IF NOT EXISTS scrap_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scrap_type text NOT NULL,
    sub_category text NOT NULL,
    sub_sub_category text NOT NULL,
    base_price decimal(10, 2) NOT NULL,
    last_updated timestamptz DEFAULT now()
);

-- 3. Create Admin Login RPC (Updated to match your project's table structure)
CREATE OR REPLACE FUNCTION public.admin_login(email_input text, password_input text)
 RETURNS TABLE(id uuid, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.email
  FROM public.admin a
  WHERE a.email = email_input
    AND a.password = password_input;
END;
$$;

-- 4. Sample Data for ML (optional but helps prediction/training)
INSERT INTO scrap_prices (scrap_type, sub_category, sub_sub_category, base_price)
VALUES 
('metal', 'Ferrous Metals', 'Iron', 25.50),
('metal', 'Non-Ferrous Metals', 'Copper', 720.00),
('e-waste', 'Computing Devices', 'Laptop - Basic Laptop', 1500.00),
('paper', 'Mixed & Office Paper', 'Old Newspaper (ONP)', 12.00)
ON CONFLICT DO NOTHING;

-- 5. Enable RLS and Policies for new tables
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrap_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON admin_audit_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can view scrap prices" ON scrap_prices FOR SELECT USING (true);

ALTER TABLE IF EXISTS pickup_requests 
ADD COLUMN IF NOT EXISTS pickup_slot text,
ADD COLUMN IF NOT EXISTS proposed_slots text,
ADD COLUMN IF NOT EXISTS slot_notified boolean DEFAULT false;
