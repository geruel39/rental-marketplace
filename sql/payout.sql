-- ============================================================
-- PAYMENT SYSTEM — COMPLETE DATABASE SCHEMA
-- ============================================================

-- Step 1: Payment method type
DO $$ BEGIN
  CREATE TYPE payment_event_type AS ENUM (
    'payment_initiated',      -- Renter started payment
    'payment_completed',      -- HitPay confirmed payment received
    'payment_failed',         -- Payment attempt failed
    'payment_expired',        -- Renter never paid, booking auto-cancelled
    'refund_initiated',       -- Refund process started
    'refund_completed',       -- Refund sent back to renter
    'refund_failed',          -- Refund attempt failed
    'payout_initiated',       -- Payout to lister started
    'payout_completed',       -- Payout sent to lister
    'payout_failed',          -- Payout to lister failed
    'payout_retry_requested', -- Lister requested retry after updating details
    'dispute_hold',           -- Payment held due to dispute
    'dispute_released_lister',-- Admin released payment to lister
    'dispute_released_renter',-- Admin released payment (refund) to renter
    'dispute_split'           -- Admin split payment between parties
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE refund_reason AS ENUM (
    'booking_cancelled_by_renter',
    'booking_cancelled_by_lister',
    'booking_declined',
    'payment_expired',
    'dispute_resolved_renter',
    'dispute_split',
    'admin_manual_refund'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payout_trigger AS ENUM (
    'auto_after_completion',  -- System auto-pays after rental complete
    'admin_manual',           -- Admin manually triggered
    'dispute_resolved',       -- Triggered after dispute resolution
    'retry_after_failure'     -- Lister retried after fixing payout details
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Transactions table (immutable ledger of all money movement)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  
  -- Who is involved
  renter_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  lister_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  
  -- Event type
  event_type payment_event_type NOT NULL,
  
  -- Amounts (all in platform currency, positive = money in, negative = money out)
  gross_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,    -- Full amount before fees
  hitpay_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,      -- HitPay transaction fee
  platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,    -- Platform service fee
  net_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,      -- Amount after all fees
  
  currency TEXT NOT NULL DEFAULT 'SGD',
  
  -- HitPay references
  hitpay_payment_request_id TEXT,
  hitpay_payment_id TEXT,
  hitpay_refund_id TEXT,
  hitpay_transfer_id TEXT,
  
  -- External reference (for payouts via bank/GCash/Maya)
  external_reference TEXT,
  external_notes TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  failure_reason TEXT,
  
  -- Idempotency (prevent duplicate processing)
  idempotency_key TEXT UNIQUE,
  
  -- Who triggered
  triggered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  triggered_by_role TEXT CHECK (triggered_by_role IN ('system', 'renter', 'lister', 'admin')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  
  renter_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  
  -- Refund details
  refund_reason refund_reason NOT NULL,
  
  -- Amounts
  original_amount DECIMAL(10, 2) NOT NULL,           -- What renter originally paid
  refund_amount DECIMAL(10, 2) NOT NULL,             -- What renter gets back
  platform_fee_retained DECIMAL(10, 2) DEFAULT 0,   -- Platform keeps this
  deposit_refund DECIMAL(10, 2) DEFAULT 0,           -- Deposit portion refunded
  cancellation_fee DECIMAL(10, 2) DEFAULT 0,         -- Any cancellation fee charged
  
  -- Cancellation policy applied
  cancellation_policy TEXT,
  hours_before_start INTEGER,                        -- How early was cancelled
  
  currency TEXT DEFAULT 'SGD',
  
  -- HitPay refund info
  hitpay_refund_id TEXT,
  hitpay_payment_id TEXT,
  
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  failure_reason TEXT,
  
  -- Note to renter
  note TEXT,
  
  -- Admin who processed (if manual)
  processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Update payouts table with more detail
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS trigger_type payout_trigger DEFAULT 'auto_after_completion',
  ADD COLUMN IF NOT EXISTS gross_amount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hitpay_fee DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS can_retry BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES transactions(id);

-- Step 5: Update bookings with payment tracking fields
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS hitpay_fee DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_collected DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_id UUID REFERENCES refunds(id),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES payouts(id),
  ADD COLUMN IF NOT EXISTS webhook_events JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;

-- Step 6: Dispute resolution table (replaces simple admin_notes)
CREATE TABLE IF NOT EXISTS dispute_resolutions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  
  -- Admin who resolved
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  
  -- Decision
  resolution_type TEXT NOT NULL 
    CHECK (resolution_type IN ('full_refund_renter', 'full_payout_lister', 'split')),
  
  -- Split amounts (used when resolution_type = 'split')
  renter_refund_amount DECIMAL(10, 2) DEFAULT 0,
  lister_payout_amount DECIMAL(10, 2) DEFAULT 0,
  platform_keeps_amount DECIMAL(10, 2) DEFAULT 0,
  
  -- Percentages for reference
  renter_refund_percent DECIMAL(5, 2) DEFAULT 0,
  lister_payout_percent DECIMAL(5, 2) DEFAULT 0,
  
  resolution_notes TEXT NOT NULL,
  evidence_reviewed TEXT,  -- Notes on what evidence admin considered
  
  -- Outcome
  renter_notified BOOLEAN DEFAULT FALSE,
  lister_notified BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 7: HitPay fee configuration
CREATE TABLE IF NOT EXISTS fee_config (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value DECIMAL(10, 4) NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed fee configuration
-- HitPay charges: typically 3.4% + SGD 0.50 per transaction for cards
-- Adjust these based on your actual HitPay plan
INSERT INTO fee_config (key, value, description) VALUES
  ('hitpay_percentage_fee', 0.034, 'HitPay percentage fee per transaction (3.4%)'),
  ('hitpay_fixed_fee', 0.50, 'HitPay fixed fee per transaction (SGD 0.50)'),
  ('platform_service_fee_renter', 0.05, 'Platform service fee charged to renter (5%)'),
  ('platform_service_fee_lister', 0.05, 'Platform fee deducted from lister payout (5%)'),
  ('platform_absorbs_hitpay_fee', 0, 'Set to 1 if platform absorbs HitPay fee, 0 if renter pays'),
  ('cancellation_flexible_full_refund_hours', 24, 'Hours before start for full refund (flexible policy)'),
  ('cancellation_moderate_full_refund_hours', 72, 'Hours before start for full refund (moderate policy)'),
  ('cancellation_strict_full_refund_hours', 168, 'Hours before start for full refund (strict = 7 days)'),
  ('payout_delay_days', 1, 'Days after rental completion before auto-payout triggers'),
  ('max_payout_retry_count', 3, 'Max times lister can retry a failed payout')
ON CONFLICT (key) DO NOTHING;

-- Step 8: RLS for new tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_config ENABLE ROW LEVEL SECURITY;

-- Transactions: renter and lister can view their own
CREATE POLICY "transactions_select" ON transactions
  FOR SELECT USING (
    auth.uid() IN (renter_id, lister_id)
    OR auth.uid() IN (SELECT id FROM profiles WHERE is_admin = TRUE)
  );

-- Refunds: renter can view their own
CREATE POLICY "refunds_select" ON refunds
  FOR SELECT USING (
    auth.uid() = renter_id
    OR auth.uid() IN (SELECT id FROM profiles WHERE is_admin = TRUE)
  );

-- Dispute resolutions: involved parties can view
CREATE POLICY "dispute_select" ON dispute_resolutions
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM bookings WHERE auth.uid() IN (renter_id, lister_id)
    )
    OR auth.uid() IN (SELECT id FROM profiles WHERE is_admin = TRUE)
  );

-- Fee config: anyone can read, only admin can write
CREATE POLICY "fee_config_select" ON fee_config
  FOR SELECT USING (true);

CREATE POLICY "fee_config_admin_write" ON fee_config
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = TRUE)
  );

-- Step 9: Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_booking ON transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_transactions_renter ON transactions(renter_id);
CREATE INDEX IF NOT EXISTS idx_transactions_lister ON transactions(lister_id);
CREATE INDEX IF NOT EXISTS idx_transactions_event ON transactions(event_type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_refunds_booking ON refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_renter ON refunds(renter_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_dispute_booking ON dispute_resolutions(booking_id);

-- Step 10: Function to calculate HitPay fee
CREATE OR REPLACE FUNCTION public.calculate_hitpay_fee(p_amount DECIMAL)
RETURNS DECIMAL
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_percentage DECIMAL;
  v_fixed DECIMAL;
  v_fee DECIMAL;
BEGIN
  SELECT value INTO v_percentage FROM fee_config WHERE key = 'hitpay_percentage_fee';
  SELECT value INTO v_fixed FROM fee_config WHERE key = 'hitpay_fixed_fee';

  IF v_percentage IS NULL THEN v_percentage := 0.034; END IF;
  IF v_fixed IS NULL THEN v_fixed := 0.50; END IF;

  v_fee := ROUND((p_amount * v_percentage) + v_fixed, 2);
  RETURN v_fee;
END;
$$;

-- Step 11: Function to calculate cancellation refund amount
CREATE OR REPLACE FUNCTION public.calculate_cancellation_refund(
  p_booking_id UUID,
  p_cancelled_by TEXT  -- 'renter' or 'lister'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_listing RECORD;
  v_hours_before_start INTEGER;
  v_full_refund_hours INTEGER;
  v_refund_amount DECIMAL;
  v_cancellation_fee DECIMAL;
  v_platform_fee_retained DECIMAL;
  v_deposit_refund DECIMAL;
  v_reason TEXT;
BEGIN
  SELECT b.*, b.total_price, b.deposit_amount, b.service_fee_renter,
         b.rental_started_at, b.paid_at
    INTO v_booking FROM public.bookings b WHERE b.id = p_booking_id;

  SELECT l.cancellation_policy INTO v_listing
    FROM public.listings l WHERE l.id = v_booking.listing_id;

  -- If lister cancels: ALWAYS full refund (lister's fault)
  IF p_cancelled_by = 'lister' THEN
    RETURN jsonb_build_object(
      'refund_amount', v_booking.total_price,
      'cancellation_fee', 0,
      'platform_fee_retained', 0,
      'deposit_refund', v_booking.deposit_amount,
      'reason', 'Full refund — lister cancelled',
      'policy_applied', 'lister_cancelled'
    );
  END IF;

  -- If not yet paid: no refund needed (nothing was charged)
  IF v_booking.paid_at IS NULL THEN
    RETURN jsonb_build_object(
      'refund_amount', 0,
      'cancellation_fee', 0,
      'platform_fee_retained', 0,
      'deposit_refund', 0,
      'reason', 'No payment made, no refund needed',
      'policy_applied', 'not_paid'
    );
  END IF;

  -- If rental already started: no refund (item already in use)
  IF v_booking.rental_started_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'refund_amount', 0,
      'cancellation_fee', v_booking.total_price,
      'platform_fee_retained', v_booking.service_fee_renter,
      'deposit_refund', 0,
      'reason', 'No refund — rental already started',
      'policy_applied', 'rental_started'
    );
  END IF;

  -- Calculate hours since payment (approximate hours before rental start)
  -- Since we don't have a fixed start date, we use hours since payment
  v_hours_before_start := EXTRACT(EPOCH FROM (NOW() - v_booking.paid_at)) / 3600;

  -- Get full refund threshold based on policy
  CASE COALESCE(v_listing.cancellation_policy, 'flexible')
    WHEN 'flexible' THEN
      SELECT value::INTEGER INTO v_full_refund_hours
        FROM fee_config WHERE key = 'cancellation_flexible_full_refund_hours';
    WHEN 'moderate' THEN
      SELECT value::INTEGER INTO v_full_refund_hours
        FROM fee_config WHERE key = 'cancellation_moderate_full_refund_hours';
    WHEN 'strict' THEN
      SELECT value::INTEGER INTO v_full_refund_hours
        FROM fee_config WHERE key = 'cancellation_strict_full_refund_hours';
    ELSE
      v_full_refund_hours := 24;
  END CASE;

  -- Determine refund amount
  IF v_hours_before_start <= v_full_refund_hours THEN
    -- Within full refund window: refund everything except service fee
    -- Platform retains its service fee (renter's portion)
    v_refund_amount := v_booking.subtotal + v_booking.deposit_amount;
    v_cancellation_fee := 0;
    v_platform_fee_retained := v_booking.service_fee_renter;
    v_deposit_refund := v_booking.deposit_amount;
    v_reason := 'Full refund — cancelled within ' || v_full_refund_hours || ' hours';
  ELSE
    -- Outside refund window: no refund (strict) or partial (moderate)
    IF v_listing.cancellation_policy = 'flexible' THEN
      -- Flexible but late: 50% refund of subtotal
      v_refund_amount := ROUND(v_booking.subtotal * 0.5, 2) + v_booking.deposit_amount;
      v_cancellation_fee := ROUND(v_booking.subtotal * 0.5, 2);
      v_platform_fee_retained := v_booking.service_fee_renter;
      v_deposit_refund := v_booking.deposit_amount;
      v_reason := '50% refund — flexible policy, late cancellation';
    ELSIF v_listing.cancellation_policy = 'moderate' THEN
      -- Moderate late: 50% refund of subtotal
      v_refund_amount := ROUND(v_booking.subtotal * 0.5, 2) + v_booking.deposit_amount;
      v_cancellation_fee := ROUND(v_booking.subtotal * 0.5, 2);
      v_platform_fee_retained := v_booking.service_fee_renter;
      v_deposit_refund := v_booking.deposit_amount;
      v_reason := '50% refund — moderate policy, late cancellation';
    ELSE
      -- Strict: no refund
      v_refund_amount := v_booking.deposit_amount; -- Only deposit returned
      v_cancellation_fee := v_booking.subtotal;
      v_platform_fee_retained := v_booking.service_fee_renter;
      v_deposit_refund := v_booking.deposit_amount;
      v_reason := 'No refund — strict policy, late cancellation. Deposit returned.';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'refund_amount', v_refund_amount,
    'cancellation_fee', v_cancellation_fee,
    'platform_fee_retained', v_platform_fee_retained,
    'deposit_refund', v_deposit_refund,
    'reason', v_reason,
    'policy_applied', v_listing.cancellation_policy,
    'hours_since_payment', v_hours_before_start,
    'full_refund_threshold_hours', v_full_refund_hours
  );
END;
$$;

-- Step 12: Function to auto-trigger payout after completion
CREATE OR REPLACE FUNCTION public.trigger_auto_payout(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_payout_delay INTEGER;
  v_payout_id UUID;
BEGIN
  SELECT b.*, p.payout_method, p.payout_setup_completed,
         p.display_name as lister_name
    INTO v_booking
    FROM public.bookings b
    JOIN public.profiles p ON p.id = b.lister_id
    WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Booking not found');
  END IF;

  IF v_booking.status != 'completed' THEN
    RETURN jsonb_build_object('error', 'Booking must be completed first');
  END IF;

  IF v_booking.payout_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Payout already created for this booking');
  END IF;

  SELECT value::INTEGER INTO v_payout_delay
    FROM fee_config WHERE key = 'payout_delay_days';

  IF v_payout_delay IS NULL THEN v_payout_delay := 1; END IF;

  -- Create payout record
  INSERT INTO public.payouts (
    lister_id, booking_id,
    amount, gross_amount, net_amount,
    currency, status,
    payout_method, trigger_type,
    can_retry
  ) VALUES (
    v_booking.lister_id, p_booking_id,
    v_booking.lister_payout,
    v_booking.lister_payout,
    v_booking.lister_payout,
    'SGD', 'pending',
    v_booking.payout_method,
    'auto_after_completion',
    FALSE
  )
  RETURNING id INTO v_payout_id;

  -- Link payout to booking
  UPDATE public.bookings SET payout_id = v_payout_id WHERE id = p_booking_id;

  -- Add to booking timeline
  PERFORM public.add_booking_timeline(
    p_booking_id,
    'completed'::booking_status,
    'completed'::booking_status,
    NULL,
    'system'::timeline_actor_role,
    'Payout initiated',
    'Payout of $' || v_booking.lister_payout || ' to lister has been queued. ' ||
    'Processing via ' || COALESCE(v_booking.payout_method, 'configured method') || '.',
    jsonb_build_object('payout_id', v_payout_id, 'amount', v_booking.lister_payout)
  );

  -- Notify lister
  INSERT INTO public.notifications (user_id, type, title, body, booking_id, action_url)
  VALUES (
    v_booking.lister_id,
    'payout_initiated',
    'Payout is being processed',
    'Your payout of $' || v_booking.lister_payout || ' is being processed.',
    p_booking_id,
    '/dashboard/earnings'
  );

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'amount', v_booking.lister_payout
  );
END;
$$;

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
DECLARE _count INTEGER;
BEGIN
  SELECT COUNT(*) INTO _count FROM information_schema.tables
    WHERE table_name = 'transactions';
  IF _count = 0 THEN RAISE EXCEPTION '❌ transactions table missing'; END IF;

  SELECT COUNT(*) INTO _count FROM information_schema.tables
    WHERE table_name = 'refunds';
  IF _count = 0 THEN RAISE EXCEPTION '❌ refunds table missing'; END IF;

  SELECT COUNT(*) INTO _count FROM information_schema.tables
    WHERE table_name = 'dispute_resolutions';
  IF _count = 0 THEN RAISE EXCEPTION '❌ dispute_resolutions table missing'; END IF;

  SELECT COUNT(*) INTO _count FROM information_schema.tables
    WHERE table_name = 'fee_config';
  IF _count = 0 THEN RAISE EXCEPTION '❌ fee_config table missing'; END IF;

  SELECT COUNT(*) INTO _count FROM fee_config;
  IF _count = 0 THEN RAISE EXCEPTION '❌ fee_config not seeded'; END IF;

  SELECT COUNT(*) INTO _count FROM pg_proc WHERE proname = 'calculate_hitpay_fee';
  IF _count = 0 THEN RAISE EXCEPTION '❌ calculate_hitpay_fee function missing'; END IF;

  SELECT COUNT(*) INTO _count FROM pg_proc WHERE proname = 'calculate_cancellation_refund';
  IF _count = 0 THEN RAISE EXCEPTION '❌ calculate_cancellation_refund function missing'; END IF;

  SELECT COUNT(*) INTO _count FROM pg_proc WHERE proname = 'trigger_auto_payout';
  IF _count = 0 THEN RAISE EXCEPTION '❌ trigger_auto_payout function missing'; END IF;

  RAISE NOTICE '✅ PAYMENT SYSTEM SCHEMA — ALL CHECKS PASSED';
END;
$$;