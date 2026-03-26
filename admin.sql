-- ============================================================
-- PHASE 2: SUPER ADMIN SCHEMA ADDITIONS
-- Run this AFTER the Phase 1 schema is already in place
-- ============================================================

-- Add admin flag to profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add admin-specific fields to profiles for moderation
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Add moderation fields to listings
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flagged_reason TEXT,
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flagged_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved' 
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

-- Add moderation fields to reviews
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flagged_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES profiles(id);

-- Add admin notes to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS dispute_resolved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_resolution TEXT;

-- Add processed_by to payouts
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES profiles(id);

-- REPORTS TABLE (user-submitted reports/flags)
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  reported_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reported_listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  reported_review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,
  reported_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN (
    'spam', 'inappropriate', 'fraud', 'harassment', 
    'misleading', 'counterfeit', 'safety', 'other'
  )),
  description TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  admin_notes TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADMIN AUDIT LOG (tracks all admin actions)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN (
    'user', 'listing', 'booking', 'review', 'payout', 
    'category', 'report', 'settings'
  )),
  target_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PLATFORM SETTINGS (key-value config)
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for new tables
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Reports: users can create, admins can view all
CREATE POLICY "reports_insert" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_select_own" ON reports
  FOR SELECT USING (
    auth.uid() = reporter_id 
    OR auth.uid() IN (SELECT id FROM profiles WHERE is_admin = TRUE)
  );
CREATE POLICY "reports_update_admin" ON reports
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = TRUE)
  );

-- Audit log: only admins
CREATE POLICY "audit_log_admin_only" ON admin_audit_log
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = TRUE)
  );

-- Platform settings: admins only for write, public read for some
CREATE POLICY "settings_select" ON platform_settings
  FOR SELECT USING (true);
CREATE POLICY "settings_modify_admin" ON platform_settings
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = TRUE)
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_profiles_admin ON profiles(is_admin) WHERE is_admin = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_suspended ON profiles(is_suspended) WHERE is_suspended = TRUE;
CREATE INDEX IF NOT EXISTS idx_listings_flagged ON listings(is_flagged) WHERE is_flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_listings_moderation ON listings(moderation_status);

-- SEED PLATFORM SETTINGS
INSERT INTO platform_settings (key, value, description) VALUES
  ('service_fee_renter_percent', '5'::jsonb, 'Service fee percentage charged to renter'),
  ('service_fee_lister_percent', '5'::jsonb, 'Service fee percentage deducted from lister payout'),
  ('max_images_per_listing', '8'::jsonb, 'Maximum images allowed per listing'),
  ('max_listing_title_length', '100'::jsonb, 'Max characters for listing title'),
  ('min_listing_description_length', '20'::jsonb, 'Min characters for listing description'),
  ('platform_currency', '"SGD"'::jsonb, 'Default platform currency'),
  ('platform_name', '"RentHub"'::jsonb, 'Platform display name'),
  ('maintenance_mode', 'false'::jsonb, 'Enable maintenance mode'),
  ('new_listing_requires_approval', 'false'::jsonb, 'Require admin approval for new listings'),
  ('min_payout_amount', '10'::jsonb, 'Minimum amount for payout processing')
ON CONFLICT (key) DO NOTHING;

-- MAKE YOUR ACCOUNT AN ADMIN (replace with your actual email)
-- UPDATE profiles SET is_admin = TRUE WHERE email = 'your-email@example.com';

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
DECLARE _count INTEGER;
BEGIN
  SELECT COUNT(*) INTO _count FROM information_schema.columns
  WHERE table_name = 'profiles' AND column_name = 'is_admin';
  IF _count = 0 THEN RAISE EXCEPTION '❌ is_admin column missing'; END IF;

  SELECT COUNT(*) INTO _count FROM information_schema.tables
  WHERE table_name = 'reports';
  IF _count = 0 THEN RAISE EXCEPTION '❌ reports table missing'; END IF;

  SELECT COUNT(*) INTO _count FROM information_schema.tables
  WHERE table_name = 'admin_audit_log';
  IF _count = 0 THEN RAISE EXCEPTION '❌ admin_audit_log table missing'; END IF;

  SELECT COUNT(*) INTO _count FROM information_schema.tables
  WHERE table_name = 'platform_settings';
  IF _count = 0 THEN RAISE EXCEPTION '❌ platform_settings table missing'; END IF;

  SELECT COUNT(*) INTO _count FROM platform_settings;
  IF _count = 0 THEN RAISE EXCEPTION '❌ platform_settings not seeded'; END IF;

  RAISE NOTICE '✅ PHASE 2 SCHEMA — ALL CHECKS PASSED';
END;
$$;