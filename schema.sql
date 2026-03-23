-- ============================================================
-- SECTION 1: EXTENSIONS
-- Run extensions first, they are prerequisites
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- SECTION 2: ENUMS
-- ALL enums must exist before any table references them
-- Using IF NOT EXISTS pattern for idempotency
-- ============================================================

DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('individual', 'business');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE listing_status AS ENUM ('draft', 'active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pricing_period AS ENUM ('hour', 'day', 'week', 'month');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'pending', 'confirmed', 'active', 'completed',
    'cancelled_by_renter', 'cancelled_by_lister', 'disputed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE review_role AS ENUM ('as_renter', 'as_lister');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE stock_movement_type AS ENUM (
    'initial',
    'adjustment_add',
    'adjustment_remove',
    'adjustment_set',
    'booking_reserved',
    'booking_released',
    'booking_returned',
    'damaged',
    'lost'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- SECTION 3: TABLES
-- Order: profiles → categories → listings → inventory_movements
--        → bookings → payouts → reviews → conversations
--        → messages → favorites → notifications
--
-- ⚠️ BULLETPROOF RULE: Every column that comes from auth metadata
--    MUST allow NULL or have a DEFAULT. The trigger cannot guarantee
--    any metadata field exists.
-- ============================================================

-- PROFILES
-- ⚠️ email is TEXT DEFAULT '' (NOT "NOT NULL") because some OAuth
--    providers may not return an email immediately
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT DEFAULT '',
  full_name TEXT DEFAULT '',
  display_name TEXT DEFAULT '',
  avatar_url TEXT,
  phone TEXT,
  bio TEXT DEFAULT '',
  account_type account_type DEFAULT 'individual',
  business_name TEXT,
  business_registration TEXT,
  website_url TEXT,
  location TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  verification_status verification_status DEFAULT 'unverified',
  id_verified BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  rating_as_lister DECIMAL(3, 2) DEFAULT 0,
  rating_as_renter DECIMAL(3, 2) DEFAULT 0,
  total_reviews_as_lister INTEGER DEFAULT 0,
  total_reviews_as_renter INTEGER DEFAULT 0,
  total_listings INTEGER DEFAULT 0,
  total_rentals_completed INTEGER DEFAULT 0,
  response_rate DECIMAL(5, 2) DEFAULT 100,
  response_time_hours INTEGER DEFAULT 0,
  hitpay_customer_id TEXT,
  payout_bank_account JSONB,
  payout_email TEXT,
  notification_preferences JSONB DEFAULT '{
    "email_bookings": true,
    "email_messages": true,
    "email_reviews": true,
    "email_low_stock": true
  }'::jsonb,
  member_since TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LISTINGS
CREATE TABLE IF NOT EXISTS listings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_per_hour DECIMAL(10, 2),
  price_per_day DECIMAL(10, 2),
  price_per_week DECIMAL(10, 2),
  price_per_month DECIMAL(10, 2),
  primary_pricing_period pricing_period DEFAULT 'day',
  deposit_amount DECIMAL(10, 2) DEFAULT 0,
  minimum_rental_period INTEGER DEFAULT 1,
  location TEXT NOT NULL DEFAULT '',
  city TEXT,
  state TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  delivery_available BOOLEAN DEFAULT FALSE,
  delivery_fee DECIMAL(10, 2) DEFAULT 0,
  delivery_radius_km INTEGER,
  pickup_instructions TEXT,
  images TEXT[] DEFAULT '{}',
  brand TEXT,
  model TEXT,
  year INTEGER,
  condition TEXT,
  -- Inventory / Stock Management Fields
  quantity_total INTEGER DEFAULT 1 NOT NULL,
  quantity_available INTEGER DEFAULT 1 NOT NULL,
  quantity_reserved INTEGER DEFAULT 0 NOT NULL,
  low_stock_threshold INTEGER DEFAULT 1,
  track_inventory BOOLEAN DEFAULT TRUE,
  sku TEXT,
  rules TEXT,
  cancellation_policy TEXT DEFAULT 'flexible',
  instant_book BOOLEAN DEFAULT FALSE,
  min_renter_rating DECIMAL(3, 2),
  status listing_status DEFAULT 'active',
  views_count INTEGER DEFAULT 0,
  favorites_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT positive_stock CHECK (quantity_total >= 0),
  CONSTRAINT available_not_negative CHECK (quantity_available >= 0),
  CONSTRAINT reserved_not_negative CHECK (quantity_reserved >= 0),
  CONSTRAINT stock_balance CHECK (quantity_available + quantity_reserved <= quantity_total)
);

-- BOOKINGS (declared before inventory_movements so FK works both ways)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  renter_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  lister_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL,
  pricing_period pricing_period NOT NULL DEFAULT 'day',
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  num_units INTEGER NOT NULL DEFAULT 1,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  delivery_fee DECIMAL(10, 2) DEFAULT 0,
  service_fee_renter DECIMAL(10, 2) DEFAULT 0,
  service_fee_lister DECIMAL(10, 2) DEFAULT 0,
  deposit_amount DECIMAL(10, 2) DEFAULT 0,
  total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  lister_payout DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status booking_status DEFAULT 'pending',
  message TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES profiles(id),
  cancellation_reason TEXT,
  hitpay_payment_request_id TEXT,
  hitpay_payment_id TEXT,
  hitpay_payment_url TEXT,
  hitpay_payment_status TEXT,
  paid_at TIMESTAMPTZ,
  payout_at TIMESTAMPTZ,
  deposit_returned BOOLEAN DEFAULT FALSE,
  renter_reviewed BOOLEAN DEFAULT FALSE,
  lister_reviewed BOOLEAN DEFAULT FALSE,
  stock_deducted BOOLEAN DEFAULT FALSE,
  stock_restored BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_booking CHECK (renter_id != lister_id),
  CONSTRAINT positive_quantity CHECK (quantity >= 1)
);

-- INVENTORY MOVEMENTS (audit log)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  movement_type stock_movement_type NOT NULL,
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL DEFAULT 0,
  quantity_after INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAYOUTS
CREATE TABLE IF NOT EXISTS payouts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lister_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'SGD',
  status payout_status DEFAULT 'pending',
  payout_method TEXT,
  reference_number TEXT,
  notes TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reviewee_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  review_role review_role NOT NULL,
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5) NOT NULL,
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  accuracy_rating INTEGER CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
  condition_rating INTEGER CHECK (condition_rating >= 1 AND condition_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
  comment TEXT,
  response TEXT,
  responded_at TIMESTAMPTZ,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, reviewer_id, review_role)
);

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  participant_1 UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  participant_2 UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview TEXT,
  unread_count_1 INTEGER DEFAULT 0,
  unread_count_2 INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, participant_1, participant_2)
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  message_type TEXT DEFAULT 'text',
  metadata JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAVORITES
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL DEFAULT '',
  body TEXT,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  from_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 4: ROW LEVEL SECURITY
-- ⚠️ BULLETPROOF: profiles needs INSERT policy so the trigger
--    can insert rows. Without this, signup WILL fail.
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (idempotent)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "listings_select" ON listings;
DROP POLICY IF EXISTS "listings_insert" ON listings;
DROP POLICY IF EXISTS "listings_update" ON listings;
DROP POLICY IF EXISTS "listings_delete" ON listings;
DROP POLICY IF EXISTS "bookings_select" ON bookings;
DROP POLICY IF EXISTS "bookings_insert" ON bookings;
DROP POLICY IF EXISTS "bookings_update" ON bookings;
DROP POLICY IF EXISTS "reviews_select" ON reviews;
DROP POLICY IF EXISTS "reviews_insert" ON reviews;
DROP POLICY IF EXISTS "reviews_update" ON reviews;
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "favorites_all" ON favorites;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "inventory_movements_select" ON inventory_movements;
DROP POLICY IF EXISTS "inventory_movements_insert" ON inventory_movements;
DROP POLICY IF EXISTS "payouts_select" ON payouts;

-- PROFILES POLICIES
-- ⚠️ SELECT: anyone can view any profile (public data)
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);

-- ⚠️ INSERT: allow inserts — the trigger runs as SECURITY DEFINER
--    but some Supabase configurations still check RLS on the target table.
--    This policy ensures the trigger-based insert NEVER fails due to RLS.
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (true);

-- UPDATE: users can only update their own profile
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- LISTINGS POLICIES
CREATE POLICY "listings_select" ON listings
  FOR SELECT USING (status = 'active' OR owner_id = auth.uid());
CREATE POLICY "listings_insert" ON listings
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "listings_update" ON listings
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "listings_delete" ON listings
  FOR DELETE USING (auth.uid() = owner_id);

-- BOOKINGS POLICIES
CREATE POLICY "bookings_select" ON bookings
  FOR SELECT USING (auth.uid() IN (renter_id, lister_id));
CREATE POLICY "bookings_insert" ON bookings
  FOR INSERT WITH CHECK (auth.uid() = renter_id);
CREATE POLICY "bookings_update" ON bookings
  FOR UPDATE USING (auth.uid() IN (renter_id, lister_id));

-- REVIEWS POLICIES
CREATE POLICY "reviews_select" ON reviews
  FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "reviews_update" ON reviews
  FOR UPDATE USING (auth.uid() = reviewee_id);

-- CONVERSATIONS POLICIES
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (auth.uid() IN (participant_1, participant_2));
CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (auth.uid() IN (participant_1, participant_2));

-- MESSAGES POLICIES
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE auth.uid() IN (participant_1, participant_2)
    )
  );
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- FAVORITES POLICIES
CREATE POLICY "favorites_all" ON favorites
  FOR ALL USING (auth.uid() = user_id);

-- NOTIFICATIONS POLICIES
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = from_user_id
  );
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- INVENTORY MOVEMENTS POLICIES
CREATE POLICY "inventory_movements_select" ON inventory_movements
  FOR SELECT USING (
    listing_id IN (SELECT id FROM listings WHERE owner_id = auth.uid())
  );
CREATE POLICY "inventory_movements_insert" ON inventory_movements
  FOR INSERT WITH CHECK (
    listing_id IN (SELECT id FROM listings WHERE owner_id = auth.uid())
  );

-- PAYOUTS POLICIES
CREATE POLICY "payouts_select" ON payouts
  FOR SELECT USING (auth.uid() = lister_id);

-- ============================================================
-- SECTION 5: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_listings_search ON listings USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price_per_day);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_stock ON listings(quantity_available);
CREATE INDEX IF NOT EXISTS idx_listings_low_stock ON listings(owner_id, quantity_available, low_stock_threshold)
  WHERE track_inventory = TRUE;
CREATE INDEX IF NOT EXISTS idx_inventory_movements_listing ON inventory_movements(listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_booking ON inventory_movements(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_renter ON bookings(renter_id);
CREATE INDEX IF NOT EXISTS idx_bookings_lister ON bookings(lister_id);
CREATE INDEX IF NOT EXISTS idx_bookings_listing ON bookings(listing_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payouts_lister ON payouts(lister_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_booking ON payouts(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_listing ON reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

-- ============================================================
-- SECTION 6: FUNCTIONS
-- ⚠️ BULLETPROOF RULES FOR EVERY FUNCTION:
--    1. LANGUAGE plpgsql
--    2. SECURITY DEFINER (runs with owner privileges, bypasses RLS)
--    3. SET search_path = public (ensures it finds tables)
--    4. COALESCE every nullable value
--    5. EXCEPTION block to catch and log errors without crashing
-- ============================================================

-- ------------------------------------------------
-- FUNCTION: handle_new_user
-- Called by trigger AFTER INSERT on auth.users
-- Creates a corresponding row in public.profiles
--
-- ⚠️ This is the #1 source of "signup failed" errors.
--    This version is MAXIMALLY defensive:
--    - Every metadata read uses COALESCE with a safe default
--    - Enum casting is wrapped in its own try/catch
--    - The outer EXCEPTION block ensures signup NEVER fails
--      even if this function has a bug — it logs and returns
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _account_type account_type;
  _full_name TEXT;
  _display_name TEXT;
  _avatar_url TEXT;
  _email TEXT;
BEGIN
  -- Safely extract email
  _email := COALESCE(NEW.email, '');

  -- Safely extract metadata fields with fallbacks
  _full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );

  _display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'preferred_username',
    NEW.raw_user_meta_data->>'user_name',
    _full_name,
    CASE
      WHEN _email != '' THEN split_part(_email, '@', 1)
      ELSE 'User'
    END
  );

  _avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );

  -- Safely cast account_type enum with try/catch
  BEGIN
    _account_type := (NEW.raw_user_meta_data->>'account_type')::account_type;
  EXCEPTION WHEN OTHERS THEN
    _account_type := 'individual';
  END;

  -- If account_type is still null after cast, default it
  IF _account_type IS NULL THEN
    _account_type := 'individual';
  END IF;

  -- Insert the profile row
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    display_name,
    avatar_url,
    account_type
  ) VALUES (
    NEW.id,
    _email,
    _full_name,
    _display_name,
    _avatar_url,
    _account_type
  );

  RETURN NEW;

EXCEPTION WHEN unique_violation THEN
  -- Profile already exists (maybe re-trigger or duplicate), just skip
  RAISE LOG 'handle_new_user: profile already exists for user %, skipping', NEW.id;
  RETURN NEW;

WHEN OTHERS THEN
  -- ⚠️ CRITICAL: Log the error but NEVER crash the signup
  -- If this function fails and doesn't return NEW, the entire
  -- auth.users INSERT is rolled back and the user can't sign up
  RAISE LOG 'handle_new_user FAILED for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------
-- FUNCTION: update_listing_search_vector
-- Auto-generates full-text search vector on listing insert/update
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_listing_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.location, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.brand, '')), 'C');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'update_listing_search_vector failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------
-- FUNCTION: update_user_reputation
-- Recalculates cached rating averages after a new review is inserted
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_user_reputation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.review_role = 'as_renter' THEN
    UPDATE public.profiles SET
      rating_as_lister = COALESCE(
        (SELECT AVG(overall_rating) FROM public.reviews
         WHERE reviewee_id = NEW.reviewee_id AND review_role = 'as_renter'), 0
      ),
      total_reviews_as_lister = (
        SELECT COUNT(*) FROM public.reviews
        WHERE reviewee_id = NEW.reviewee_id AND review_role = 'as_renter'
      ),
      updated_at = NOW()
    WHERE id = NEW.reviewee_id;
  END IF;

  IF NEW.review_role = 'as_lister' THEN
    UPDATE public.profiles SET
      rating_as_renter = COALESCE(
        (SELECT AVG(overall_rating) FROM public.reviews
         WHERE reviewee_id = NEW.reviewee_id AND review_role = 'as_lister'), 0
      ),
      total_reviews_as_renter = (
        SELECT COUNT(*) FROM public.reviews
        WHERE reviewee_id = NEW.reviewee_id AND review_role = 'as_lister'
      ),
      updated_at = NOW()
    WHERE id = NEW.reviewee_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'update_user_reputation failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------
-- FUNCTION: update_favorites_count
-- Increments/decrements favorites_count on listings
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_favorites_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.listings SET favorites_count = favorites_count + 1
    WHERE id = NEW.listing_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.listings SET favorites_count = GREATEST(favorites_count - 1, 0)
    WHERE id = OLD.listing_id;
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'update_favorites_count failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ------------------------------------------------
-- FUNCTION: increment_views
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_views(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.listings SET views_count = views_count + 1
  WHERE id = p_listing_id;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'increment_views failed: %', SQLERRM;
END;
$$;

-- ============================================================
-- INVENTORY MANAGEMENT FUNCTIONS
-- ============================================================

-- ------------------------------------------------
-- FUNCTION: check_low_stock_alert
-- Creates notification when stock is low or out
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_low_stock_alert(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing RECORD;
BEGIN
  SELECT id, title, owner_id, quantity_available, low_stock_threshold, track_inventory
    INTO v_listing
    FROM public.listings
    WHERE id = p_listing_id;

  IF NOT FOUND OR NOT v_listing.track_inventory THEN
    RETURN;
  END IF;

  IF v_listing.quantity_available = 0 THEN
    INSERT INTO public.notifications (user_id, type, title, body, listing_id, action_url)
    VALUES (
      v_listing.owner_id,
      'out_of_stock',
      'Out of Stock: ' || COALESCE(v_listing.title, 'Untitled'),
      'Your listing "' || COALESCE(v_listing.title, 'Untitled') || '" is now out of stock.',
      v_listing.id,
      '/dashboard/inventory/' || v_listing.id::TEXT
    );
  ELSIF v_listing.quantity_available <= v_listing.low_stock_threshold THEN
    INSERT INTO public.notifications (user_id, type, title, body, listing_id, action_url)
    VALUES (
      v_listing.owner_id,
      'low_stock',
      'Low Stock: ' || COALESCE(v_listing.title, 'Untitled'),
      'Your listing "' || COALESCE(v_listing.title, 'Untitled') || '" has only '
        || v_listing.quantity_available || ' item(s) left.',
      v_listing.id,
      '/dashboard/inventory/' || v_listing.id::TEXT
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'check_low_stock_alert failed for listing %: %', p_listing_id, SQLERRM;
END;
$$;

-- ------------------------------------------------
-- FUNCTION: reserve_stock
-- Deducts from available, adds to reserved when booking confirmed
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_stock(
  p_listing_id UUID,
  p_booking_id UUID,
  p_quantity INTEGER,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_available INTEGER;
  v_track BOOLEAN;
BEGIN
  SELECT quantity_available, track_inventory
    INTO v_current_available, v_track
    FROM public.listings
    WHERE id = p_listing_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE LOG 'reserve_stock: listing % not found', p_listing_id;
    RETURN FALSE;
  END IF;

  IF NOT v_track THEN
    RETURN TRUE;
  END IF;

  IF v_current_available < p_quantity THEN
    RETURN FALSE;
  END IF;

  UPDATE public.listings SET
    quantity_available = quantity_available - p_quantity,
    quantity_reserved = quantity_reserved + p_quantity,
    updated_at = NOW()
  WHERE id = p_listing_id;

  INSERT INTO public.inventory_movements
    (listing_id, booking_id, user_id, movement_type, quantity_change, quantity_before, quantity_after, reason)
  VALUES
    (p_listing_id, p_booking_id, p_user_id, 'booking_reserved', -p_quantity,
     v_current_available, v_current_available - p_quantity, 'Stock reserved for booking');

  UPDATE public.bookings SET stock_deducted = TRUE WHERE id = p_booking_id;

  PERFORM public.check_low_stock_alert(p_listing_id);

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'reserve_stock failed: %', SQLERRM;
  RETURN FALSE;
END;
$$;

-- ------------------------------------------------
-- FUNCTION: release_stock
-- Returns reserved stock to available when booking cancelled
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_stock(
  p_listing_id UUID,
  p_booking_id UUID,
  p_quantity INTEGER,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_available INTEGER;
BEGIN
  SELECT quantity_available
    INTO v_current_available
    FROM public.listings
    WHERE id = p_listing_id
    FOR UPDATE;

  UPDATE public.listings SET
    quantity_available = quantity_available + p_quantity,
    quantity_reserved = GREATEST(quantity_reserved - p_quantity, 0),
    updated_at = NOW()
  WHERE id = p_listing_id;

  INSERT INTO public.inventory_movements
    (listing_id, booking_id, user_id, movement_type, quantity_change, quantity_before, quantity_after, reason)
  VALUES
    (p_listing_id, p_booking_id, p_user_id, 'booking_released', p_quantity,
     v_current_available, v_current_available + p_quantity, 'Stock released from cancelled booking');

  UPDATE public.bookings SET stock_restored = TRUE WHERE id = p_booking_id;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'release_stock failed: %', SQLERRM;
END;
$$;

-- ------------------------------------------------
-- FUNCTION: return_stock
-- Returns reserved stock to available when rental completed
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_stock(
  p_listing_id UUID,
  p_booking_id UUID,
  p_quantity INTEGER,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_available INTEGER;
BEGIN
  SELECT quantity_available
    INTO v_current_available
    FROM public.listings
    WHERE id = p_listing_id
    FOR UPDATE;

  UPDATE public.listings SET
    quantity_available = quantity_available + p_quantity,
    quantity_reserved = GREATEST(quantity_reserved - p_quantity, 0),
    updated_at = NOW()
  WHERE id = p_listing_id;

  INSERT INTO public.inventory_movements
    (listing_id, booking_id, user_id, movement_type, quantity_change, quantity_before, quantity_after, reason)
  VALUES
    (p_listing_id, p_booking_id, p_user_id, 'booking_returned', p_quantity,
     v_current_available, v_current_available + p_quantity, 'Item returned after rental completion');

  UPDATE public.bookings SET stock_restored = TRUE WHERE id = p_booking_id;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'return_stock failed: %', SQLERRM;
END;
$$;

-- ------------------------------------------------
-- FUNCTION: adjust_stock
-- Manual stock adjustment by lister
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_listing_id UUID,
  p_user_id UUID,
  p_adjustment_type stock_movement_type,
  p_quantity INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_available INTEGER;
  v_current_total INTEGER;
  v_current_reserved INTEGER;
  v_new_available INTEGER;
  v_new_total INTEGER;
  v_quantity_change INTEGER;
BEGIN
  SELECT quantity_available, quantity_total, quantity_reserved
    INTO v_current_available, v_current_total, v_current_reserved
    FROM public.listings
    WHERE id = p_listing_id AND owner_id = p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found or not owned by user';
  END IF;

  IF p_adjustment_type = 'adjustment_add' THEN
    v_new_total := v_current_total + p_quantity;
    v_new_available := v_current_available + p_quantity;
    v_quantity_change := p_quantity;

  ELSIF p_adjustment_type = 'adjustment_remove' THEN
    IF v_current_available < p_quantity THEN
      RAISE EXCEPTION 'Cannot remove more stock than available (available: %, requested: %)',
        v_current_available, p_quantity;
    END IF;
    v_new_total := v_current_total - p_quantity;
    v_new_available := v_current_available - p_quantity;
    v_quantity_change := -p_quantity;

  ELSIF p_adjustment_type = 'adjustment_set' THEN
    IF p_quantity < v_current_reserved THEN
      RAISE EXCEPTION 'Cannot set total below reserved quantity (reserved: %, requested: %)',
        v_current_reserved, p_quantity;
    END IF;
    v_new_total := p_quantity;
    v_new_available := p_quantity - v_current_reserved;
    v_quantity_change := v_new_available - v_current_available;

  ELSIF p_adjustment_type IN ('damaged', 'lost') THEN
    IF v_current_available < p_quantity THEN
      RAISE EXCEPTION 'Cannot mark more items as % than available (available: %, requested: %)',
        p_adjustment_type, v_current_available, p_quantity;
    END IF;
    v_new_total := v_current_total - p_quantity;
    v_new_available := v_current_available - p_quantity;
    v_quantity_change := -p_quantity;

  ELSE
    RAISE EXCEPTION 'Invalid adjustment type: %', p_adjustment_type;
  END IF;

  UPDATE public.listings SET
    quantity_total = v_new_total,
    quantity_available = v_new_available,
    updated_at = NOW()
  WHERE id = p_listing_id;

  INSERT INTO public.inventory_movements
    (listing_id, user_id, movement_type, quantity_change, quantity_before, quantity_after, reason)
  VALUES
    (p_listing_id, p_user_id, p_adjustment_type, v_quantity_change,
     v_current_available, v_new_available, COALESCE(p_reason, 'Manual adjustment'));

  PERFORM public.check_low_stock_alert(p_listing_id);
END;
$$;

-- ------------------------------------------------
-- FUNCTION: get_available_stock
-- Returns available stock for a listing during specific dates
-- Accounts for concurrent bookings
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_available_stock(
  p_listing_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_track BOOLEAN;
  v_max_concurrent INTEGER;
BEGIN
  SELECT quantity_total, track_inventory
    INTO v_total, v_track
    FROM public.listings
    WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF NOT v_track THEN
    RETURN 999999;
  END IF;

  SELECT COALESCE(SUM(b.quantity), 0)
    INTO v_max_concurrent
    FROM public.bookings b
    WHERE b.listing_id = p_listing_id
      AND b.status IN ('confirmed', 'active')
      AND b.start_date < p_end_date
      AND b.end_date > p_start_date;

  RETURN GREATEST(v_total - v_max_concurrent, 0);
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'get_available_stock failed: %', SQLERRM;
  RETURN 0;
END;
$$;

-- ============================================================
-- SECTION 7: TRIGGERS
-- ⚠️ MUST come AFTER both tables AND functions exist
-- Using DROP IF EXISTS for idempotency
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS listing_search_update ON listings;
CREATE TRIGGER listing_search_update
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_listing_search_vector();

DROP TRIGGER IF EXISTS on_review_created ON reviews;
CREATE TRIGGER on_review_created
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_reputation();

DROP TRIGGER IF EXISTS on_favorite_changed ON favorites;
CREATE TRIGGER on_favorite_changed
  AFTER INSERT OR DELETE ON public.favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_favorites_count();

-- ============================================================
-- SECTION 8: SEED DATA
-- ============================================================

INSERT INTO categories (name, slug, icon, sort_order) VALUES
  ('Electronics & Gadgets', 'electronics', '💻', 1),
  ('Vehicles & Transport', 'vehicles', '🚗', 2),
  ('Tools & Equipment', 'tools-equipment', '🔧', 3),
  ('Sports & Outdoors', 'sports-outdoors', '⚽', 4),
  ('Photography & Video', 'photography', '📷', 5),
  ('Music & Audio', 'music', '🎸', 6),
  ('Party & Events', 'party-events', '🎉', 7),
  ('Home & Garden', 'home-garden', '🏡', 8),
  ('Fashion & Accessories', 'fashion', '👗', 9),
  ('Spaces & Venues', 'spaces', '🏢', 10),
  ('Heavy Machinery', 'machinery', '🏗️', 11),
  ('Baby & Kids', 'baby-kids', '👶', 12),
  ('Office Equipment', 'office', '🖨️', 13),
  ('Camping & Travel', 'camping', '⛺', 14),
  ('Other', 'other', '📦', 99)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SECTION 9: VERIFICATION SCRIPT
-- Run this AFTER the above to confirm everything is correct.
-- Every query should return results. If any returns 0 rows,
-- something went wrong above.
-- ============================================================

DO $$
DECLARE
  _count INTEGER;
BEGIN
  -- Check profiles table exists
  SELECT COUNT(*) INTO _count FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'profiles';
  IF _count = 0 THEN RAISE EXCEPTION '❌ profiles table missing'; END IF;

  -- Check trigger exists
  SELECT COUNT(*) INTO _count FROM pg_trigger WHERE tgname = 'on_auth_user_created';
  IF _count = 0 THEN RAISE EXCEPTION '❌ on_auth_user_created trigger missing'; END IF;

  -- Check function exists
  SELECT COUNT(*) INTO _count FROM pg_proc WHERE proname = 'handle_new_user';
  IF _count = 0 THEN RAISE EXCEPTION '❌ handle_new_user function missing'; END IF;

  -- Check profiles INSERT policy exists
  SELECT COUNT(*) INTO _count FROM pg_policies
  WHERE tablename = 'profiles' AND policyname = 'profiles_insert';
  IF _count = 0 THEN RAISE EXCEPTION '❌ profiles INSERT policy missing — signup WILL fail'; END IF;

  -- Check categories seeded
  SELECT COUNT(*) INTO _count FROM public.categories;
  IF _count = 0 THEN RAISE EXCEPTION '❌ categories not seeded'; END IF;

  -- Check inventory functions exist
  SELECT COUNT(*) INTO _count FROM pg_proc WHERE proname = 'reserve_stock';
  IF _count = 0 THEN RAISE EXCEPTION '❌ reserve_stock function missing'; END IF;

  SELECT COUNT(*) INTO _count FROM pg_proc WHERE proname = 'release_stock';
  IF _count = 0 THEN RAISE EXCEPTION '❌ release_stock function missing'; END IF;

  SELECT COUNT(*) INTO _count FROM pg_proc WHERE proname = 'adjust_stock';
  IF _count = 0 THEN RAISE EXCEPTION '❌ adjust_stock function missing'; END IF;

  RAISE NOTICE '✅ ALL CHECKS PASSED — Database is ready';
END;
$$;
