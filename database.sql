-- Supabase-compatible SQL schema for Rent a Home Website
-- Run once in Supabase SQL editor to set up the database structure
-- Updated to use direct URL strings instead of Supabase Storage buckets

-- Enable UUID generator
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
  created_at timestamptz DEFAULT now()
);

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
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- MIGRATION: Ensure 'image_url' exists if table was created previously with 'images'
DO $$ 
BEGIN 
  -- Add image_url if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='image_url') THEN
    ALTER TABLE properties ADD COLUMN image_url text;
  END IF;

  -- Optional: Drop old 'images' column if it exists to clean up
  -- IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='images') THEN
  --   ALTER TABLE properties DROP COLUMN images;
  -- END IF;
END $$;

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
  created_at timestamptz DEFAULT now()
);

-- MIGRATION: Ensure 'is_paid' exists if table was created previously
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='is_paid') THEN
    ALTER TABLE bookings ADD COLUMN is_paid boolean DEFAULT false;
  END IF;
END $$;

-- Payments table (New: Track monthly rent payments)
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  month text NOT NULL, -- e.g., 'March 2024'
  paid_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating >=1 AND rating <=5),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text,
  title text,
  message text,
  is_read boolean DEFAULT false,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

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

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Policies: properties
DROP POLICY IF EXISTS "properties_select" ON properties;
CREATE POLICY "properties_select" ON properties FOR SELECT USING (is_deleted = false);

DROP POLICY IF EXISTS "properties_insert_owner" ON properties;
CREATE POLICY "properties_insert_owner" ON properties FOR INSERT WITH CHECK (owner = auth.uid());

DROP POLICY IF EXISTS "properties_insert_auth_owner" ON properties;
CREATE POLICY "properties_insert_auth_owner" ON properties FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner = auth.uid());

DROP POLICY IF EXISTS "properties_update_owner" ON properties;
CREATE POLICY "properties_update_owner" ON properties FOR UPDATE USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());

DROP POLICY IF EXISTS "properties_delete_owner" ON properties;
CREATE POLICY "properties_delete_owner" ON properties FOR DELETE USING (owner = auth.uid());

-- Policies: bookings
DROP POLICY IF EXISTS "bookings_insert_tenant" ON bookings;
CREATE POLICY "bookings_insert_tenant" ON bookings FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "bookings_select" ON bookings;
CREATE POLICY "bookings_select" ON bookings FOR SELECT USING (auth.uid() = tenant_id OR auth.uid() IN (select owner from properties where id = property_id));

DROP POLICY IF EXISTS "bookings_update_landlord" ON bookings;
CREATE POLICY "bookings_update_landlord" ON bookings FOR UPDATE USING (auth.uid() IN (select owner from properties where id = property_id) OR auth.uid() = tenant_id);

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

-- End of schema
