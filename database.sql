-- Supabase-compatible SQL schema for Rent a Home Website
-- Run once in Supabase SQL editor to set up the database structure
-- Updated with real-time sync support (updated_at timestamps and triggers)

-- Enable UUID generator
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Optional RPC function: Get all bookings for a user (both as tenant and landlord)
CREATE OR REPLACE FUNCTION get_bookings_for_user(uid uuid)
RETURNS TABLE(
  id uuid,
  property_id uuid,
  tenant_id uuid,
  start_date date,
  end_date date,
  status text,
  is_paid boolean,
  message text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.property_id, b.tenant_id, b.start_date, b.end_date, b.status, b.is_paid, b.message, b.created_at, b.updated_at
  FROM bookings b
  WHERE b.tenant_id = uid 
    OR b.property_id IN (SELECT id FROM properties WHERE owner = uid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up existing storage buckets if they exist
-- (Run this if you want to completely remove storage-based image management)
-- DELETE FROM storage.buckets WHERE id = 'property-images';

-- Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text,
  phone text,
  role text CHECK (role IN ('tenant','landlord','admin')),
  avatar_url text, -- Store direct public image URL
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- MIGRATION: Add updated_at to profiles if missing
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='updated_at') THEN
    ALTER TABLE profiles ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Trigger to auto-update profiles.updated_at
DROP TRIGGER IF EXISTS profiles_updated_at_trigger ON profiles;
CREATE TRIGGER profiles_updated_at_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  city text NOT NULL,
  address text,
  price numeric NOT NULL CHECK (price >= 0),
  bedrooms int DEFAULT 1 CHECK (bedrooms >= 0),
  bathrooms int DEFAULT 1 CHECK (bathrooms >= 0),
  amenities text[] DEFAULT '{}',
  availability boolean DEFAULT true,
  image_url text, -- Store single image URL (replaces bucket image path)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- MIGRATION: Ensure 'image_url' and 'updated_at' exist if table was created previously
DO $$ 
BEGIN 
  -- Add image_url if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='image_url') THEN
    ALTER TABLE properties ADD COLUMN image_url text;
  END IF;
  
  -- Add updated_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='updated_at') THEN
    ALTER TABLE properties ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
  
  -- Remove is_deleted column if it exists (we use hard deletes now)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='is_deleted') THEN
    ALTER TABLE properties DROP COLUMN is_deleted;
  END IF;
END $$;

-- Trigger to auto-update properties.updated_at
DROP TRIGGER IF EXISTS properties_updated_at_trigger ON properties;
CREATE TRIGGER properties_updated_at_trigger
BEFORE UPDATE ON properties
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_paid boolean DEFAULT false, -- Track if rent is paid
  message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- MIGRATION: Ensure 'is_paid' and 'updated_at' exist if table was created previously
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='is_paid') THEN
    ALTER TABLE bookings ADD COLUMN is_paid boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='updated_at') THEN
    ALTER TABLE bookings ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Trigger to auto-update bookings.updated_at
DROP TRIGGER IF EXISTS bookings_updated_at_trigger ON bookings;
CREATE TRIGGER bookings_updated_at_trigger
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Payments table (New: Track monthly rent payments)
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  month text NOT NULL, -- e.g., 'March 2024'
  paid_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- MIGRATION: Add updated_at to payments if missing
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='updated_at') THEN
    ALTER TABLE payments ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Trigger to auto-update payments.updated_at
DROP TRIGGER IF EXISTS payments_updated_at_trigger ON payments;
CREATE TRIGGER payments_updated_at_trigger
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating >=1 AND rating <=5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- MIGRATION: Add updated_at to reviews if missing
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='updated_at') THEN
    ALTER TABLE reviews ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Trigger to auto-update reviews.updated_at
DROP TRIGGER IF EXISTS reviews_updated_at_trigger ON reviews;
CREATE TRIGGER reviews_updated_at_trigger
BEFORE UPDATE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text,
  title text,
  message text,
  is_read boolean DEFAULT false,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- MIGRATION: Add updated_at to notifications if missing
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='updated_at') THEN
    ALTER TABLE notifications ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Trigger to auto-update notifications.updated_at
DROP TRIGGER IF EXISTS notifications_updated_at_trigger ON notifications;
CREATE TRIGGER notifications_updated_at_trigger
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner);
CREATE INDEX IF NOT EXISTS idx_properties_updated_at ON properties(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_updated_at ON bookings(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at DESC);

-- Helper function to check if current user is admin (used in RLS policies)
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = uid AND role = 'admin'
  );
$$;

-- ROW LEVEL SECURITY: enable RLS on tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies: profiles
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
CREATE POLICY "profiles_select_admin" ON profiles FOR SELECT
USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Policies: properties
DROP POLICY IF EXISTS "properties_select_public" ON properties;
CREATE POLICY "properties_select_public" ON properties FOR SELECT USING (true);

DROP POLICY IF EXISTS "properties_select_owner" ON properties;
DROP POLICY IF EXISTS "properties_select" ON properties;

DROP POLICY IF EXISTS "properties_insert_owner" ON properties;
CREATE POLICY "properties_insert_owner" ON properties FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner = auth.uid());

DROP POLICY IF EXISTS "properties_insert_auth_owner" ON properties;
DROP POLICY IF EXISTS "properties_update_owner" ON properties;
CREATE POLICY "properties_update_owner" ON properties FOR UPDATE USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());

DROP POLICY IF EXISTS "properties_delete_owner" ON properties;
CREATE POLICY "properties_delete_owner" ON properties FOR DELETE USING (owner = auth.uid());

DROP POLICY IF EXISTS "properties_admin_manage" ON properties;
CREATE POLICY "properties_admin_manage" ON properties FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Policies: bookings
DROP POLICY IF EXISTS "bookings_insert_tenant" ON bookings;
CREATE POLICY "bookings_insert_tenant" ON bookings FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "bookings_select" ON bookings;
CREATE POLICY "bookings_select" ON bookings FOR SELECT USING (auth.uid() = tenant_id OR auth.uid() IN (select owner from properties where id = property_id));

DROP POLICY IF EXISTS "bookings_update_landlord" ON bookings;
CREATE POLICY "bookings_update_landlord" ON bookings FOR UPDATE USING (auth.uid() IN (select owner from properties where id = property_id) OR auth.uid() = tenant_id) WITH CHECK (auth.uid() IN (select owner from properties where id = property_id) OR auth.uid() = tenant_id);

DROP POLICY IF EXISTS "bookings_delete_landlord" ON bookings;
CREATE POLICY "bookings_delete_landlord" ON bookings FOR DELETE USING (auth.uid() IN (select owner from properties where id = property_id) OR auth.uid() = tenant_id);

DROP POLICY IF EXISTS "bookings_admin_select" ON bookings;
CREATE POLICY "bookings_admin_select" ON bookings FOR SELECT
USING (is_admin(auth.uid()));

-- Policies: reviews
DROP POLICY IF EXISTS "reviews_insert_tenant" ON reviews;
CREATE POLICY "reviews_insert_tenant" ON reviews FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "reviews_select" ON reviews;
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (true);

-- Policies: notifications
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);

-- Policies: payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_insert_tenant" ON payments;
CREATE POLICY "payments_insert_tenant" ON payments FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments FOR SELECT USING (auth.uid() = tenant_id OR auth.uid() IN (SELECT owner FROM properties p JOIN bookings b ON b.property_id = p.id WHERE b.id = booking_id));

DROP POLICY IF EXISTS "payments_admin_select" ON payments;
CREATE POLICY "payments_admin_select" ON payments FOR SELECT
USING (is_admin(auth.uid()));

-- Realtime publication for admin dashboard live updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'properties'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE properties;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE payments;
  END IF;
END $$;

-- End of schema
