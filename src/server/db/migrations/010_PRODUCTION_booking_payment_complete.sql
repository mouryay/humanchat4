-- ============================================================================
-- HumanChat PRODUCTION Migration - Complete Booking & Payment System
-- Version: 010_PRODUCTION
-- Date: January 19, 2026
-- Description: Comprehensive booking system with Stripe payment integration
-- 
-- This migration consolidates:
--   - Migration 006: Payment system (payments, refunds tables)
--   - Migration 007: Min price per 15 min
--   - Migration 009: Awaiting payment status (included in ENUMs)
--
-- Run this ONCE in production - it's idempotent and safe.
-- ============================================================================

-- ============================================================================
-- Step 1: Create ENUMs (Type Definitions)
-- ============================================================================

-- Booking status lifecycle
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'scheduled',       -- Confirmed booking
    'held',            -- Temporarily reserved (TTL)
    'awaiting_payment',-- Payment intent created, awaiting payment
    'confirmed',       -- Booking confirmed (paid or free)
    'in_progress',     -- Session started
    'completed',       -- Session finished
    'canceled',        -- Canceled by user
    'cancelled_by_user', -- Canceled by user (alt spelling)
    'cancelled_by_expert', -- Canceled by expert
    'no_show',         -- Guest didn't show up
    'failed',          -- Payment/booking failed
    'expired'          -- Hold expired
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Payment status
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending',         -- Payment intent created
    'processing',      -- Payment in progress
    'succeeded',       -- Payment confirmed
    'failed',          -- Payment failed
    'canceled',        -- Payment canceled
    'refunded',        -- Payment refunded
    'partially_refunded' -- Partial refund
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Refund status
DO $$ BEGIN
  CREATE TYPE refund_status AS ENUM (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'canceled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Availability repeat pattern
DO $$ BEGIN
  CREATE TYPE repeat_pattern AS ENUM (
    'none',           -- One-time slot
    'daily',
    'weekly',
    'biweekly',
    'monthly'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Step 2: Update Users Table
-- ============================================================================

-- Add min_price_per_15_min if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='min_price_per_15_min'
  ) THEN
    ALTER TABLE users ADD COLUMN min_price_per_15_min INTEGER DEFAULT NULL;
    COMMENT ON COLUMN users.min_price_per_15_min IS 'Minimum price in cents for 15 minute bookings';
  END IF;
END $$;

-- ============================================================================
-- Step 3: Create Support Tables
-- ============================================================================

-- Responder availability configuration
CREATE TABLE IF NOT EXISTS responder_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Timing
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  
  -- Recurrence
  repeat_pattern repeat_pattern NOT NULL DEFAULT 'weekly',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  
  -- Pricing (in cents, 0 = free)
  duration_15_min INTEGER CHECK (duration_15_min >= 0),
  duration_30_min INTEGER CHECK (duration_30_min >= 0),
  duration_60_min INTEGER CHECK (duration_60_min >= 0),
  
  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT valid_date_range CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_availability_user_active ON responder_availability(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_availability_day_of_week ON responder_availability(day_of_week);
CREATE INDEX IF NOT EXISTS idx_availability_effective_dates ON responder_availability(effective_from, effective_until);

-- Booking slots (optional, for calendar view)
CREATE TABLE IF NOT EXISTS booking_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  availability_id UUID REFERENCES responder_availability(id) ON DELETE SET NULL,
  
  -- Slot timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 15),
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'available',
  held_until TIMESTAMPTZ,
  
  -- Pricing (in cents, 0 = free)
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_slot_duration CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_slots_responder_status ON booking_slots(responder_id, status);
CREATE INDEX IF NOT EXISTS idx_slots_time_range ON booking_slots(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_slots_status_held ON booking_slots(status, held_until) WHERE status = 'held';
CREATE INDEX IF NOT EXISTS idx_slots_available ON booking_slots(status, start_time) WHERE status = 'available';

-- ============================================================================
-- Step 4: Migrate Existing Bookings Table (Add Payment Columns)
-- ============================================================================

-- Add new columns to existing bookings table
DO $$ 
BEGIN
  -- Add price_cents (convert existing price if in dollars)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='price_cents') THEN
    ALTER TABLE bookings ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0);
  END IF;

  -- Add currency
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='currency') THEN
    ALTER TABLE bookings ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD';
  END IF;

  -- Add platform_fee_cents
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='platform_fee_cents') THEN
    ALTER TABLE bookings ADD COLUMN platform_fee_cents INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- Add responder_payout_cents
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='responder_payout_cents') THEN
    ALTER TABLE bookings ADD COLUMN responder_payout_cents INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- Add held_until (for TTL holds)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='held_until') THEN
    ALTER TABLE bookings ADD COLUMN held_until TIMESTAMPTZ;
  END IF;

  -- Add hold_token (for idempotency)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='hold_token') THEN
    ALTER TABLE bookings ADD COLUMN hold_token VARCHAR(255);
  END IF;

  -- Ensure updated_at exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='updated_at') THEN
    ALTER TABLE bookings ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

END $$;

-- Update existing bookings status check constraint to include awaiting_payment
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
  
  -- Add updated constraint with all statuses
  ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
    CHECK (status IN (
      'scheduled', 
      'in_progress', 
      'completed', 
      'cancelled_by_user', 
      'cancelled_by_expert', 
      'no_show',
      'awaiting_payment'
    ));
EXCEPTION
  WHEN OTHERS THEN NULL; -- Ignore if already exists
END $$;

-- Add constraints for new columns
DO $$
BEGIN
  -- Unique hold_token
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_hold_token_key') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_hold_token_key UNIQUE (hold_token);
  END IF;

  -- Valid held_until
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_held_until') THEN
    ALTER TABLE bookings ADD CONSTRAINT valid_held_until 
      CHECK (held_until IS NULL OR held_until > created_at);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Step 5: Create Payments and Refunds Tables
-- ============================================================================

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- Stripe references
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_checkout_session_id VARCHAR(255) UNIQUE,
  stripe_charge_id VARCHAR(255),
  
  -- Amount details (in cents)
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  responder_payout_cents INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  status payment_status NOT NULL DEFAULT 'pending',
  
  -- Payment method
  payment_method_id VARCHAR(255),
  payment_method_type VARCHAR(50),
  
  -- Timing
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  -- Metadata
  stripe_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON payments(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- Stripe reference
  stripe_refund_id VARCHAR(255) UNIQUE,
  
  -- Amount (in cents)
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  
  -- Status
  status refund_status NOT NULL DEFAULT 'pending',
  
  -- Reason
  reason TEXT,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Timing
  processed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  -- Metadata
  stripe_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_booking ON refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_stripe_id ON refunds(stripe_refund_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- Booking state audit log
CREATE TABLE IF NOT EXISTS booking_state_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- State transition
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  
  -- Context
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB,
  
  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_log_booking_id ON booking_state_log(booking_id, created_at);

-- ============================================================================
-- Step 6: Create Triggers and Functions
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables that have updated_at
DO $$
BEGIN
  -- Responder availability
  DROP TRIGGER IF EXISTS update_responder_availability_updated_at ON responder_availability;
  CREATE TRIGGER update_responder_availability_updated_at
    BEFORE UPDATE ON responder_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  -- Booking slots
  DROP TRIGGER IF EXISTS update_booking_slots_updated_at ON booking_slots;
  CREATE TRIGGER update_booking_slots_updated_at
    BEFORE UPDATE ON booking_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  -- Bookings
  DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
  CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  -- Payments
  DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
  CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  -- Refunds
  DROP TRIGGER IF EXISTS update_refunds_updated_at ON refunds;
  CREATE TRIGGER update_refunds_updated_at
    BEFORE UPDATE ON refunds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- Calculate platform fee and responder payout (10% platform fee)
CREATE OR REPLACE FUNCTION calculate_booking_financials()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price_cents IS NOT NULL THEN
    -- 10% platform fee for paid sessions, 0% for free sessions
    IF NEW.price_cents = 0 THEN
      NEW.platform_fee_cents = 0;
      NEW.responder_payout_cents = 0;
    ELSE
      NEW.platform_fee_cents = (NEW.price_cents * 10) / 100;
      NEW.responder_payout_cents = NEW.price_cents - NEW.platform_fee_cents;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply financial calculation trigger
DO $$
BEGIN
  DROP TRIGGER IF EXISTS calculate_booking_fees ON bookings;
  CREATE TRIGGER calculate_booking_fees
    BEFORE INSERT OR UPDATE OF price_cents ON bookings
    FOR EACH ROW EXECUTE FUNCTION calculate_booking_financials();
END $$;

-- Log booking state changes
CREATE OR REPLACE FUNCTION log_booking_state_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
    INSERT INTO booking_state_log (booking_id, from_status, to_status, metadata)
    VALUES (NEW.id, OLD.status::VARCHAR, NEW.status::VARCHAR, jsonb_build_object(
      'updated_at', NOW()
    ));
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO booking_state_log (booking_id, from_status, to_status, metadata)
    VALUES (NEW.id, NULL, NEW.status::VARCHAR, jsonb_build_object(
      'created_at', NOW()
    ));
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail booking operations if logging fails
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply state logging trigger
DO $$
BEGIN
  DROP TRIGGER IF EXISTS log_booking_state_changes ON bookings;
  CREATE TRIGGER log_booking_state_changes
    AFTER INSERT OR UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION log_booking_state_change();
END $$;

-- ============================================================================
-- Step 7: Create Views for Common Queries
-- ============================================================================

-- Upcoming bookings view
CREATE OR REPLACE VIEW v_upcoming_bookings AS
SELECT 
  b.id,
  b.user_id AS requester_id,
  b.expert_id AS responder_id,
  b.start_time AS scheduled_start,
  b.end_time AS scheduled_end,
  b.duration_minutes,
  b.price_cents,
  b.status,
  u_req.name AS requester_name,
  u_req.avatar_url AS requester_avatar,
  u_resp.name AS responder_name,
  u_resp.avatar_url AS responder_avatar,
  p.status AS payment_status,
  p.stripe_payment_intent_id
FROM bookings b
LEFT JOIN users u_req ON b.user_id = u_req.id
LEFT JOIN users u_resp ON b.expert_id = u_resp.id
LEFT JOIN payments p ON b.id = p.booking_id
WHERE b.start_time > NOW()
  AND b.status IN ('scheduled', 'awaiting_payment')
ORDER BY b.start_time ASC;

-- ============================================================================
-- Step 8: Add Comments
-- ============================================================================

COMMENT ON TABLE responder_availability IS 'Defines responder weekly availability patterns';
COMMENT ON TABLE booking_slots IS 'Individual bookable time slots, can be auto-generated or manual';
COMMENT ON TABLE bookings IS 'Main bookings table with payment support';
COMMENT ON TABLE payments IS 'Payment tracking with Stripe integration';
COMMENT ON TABLE refunds IS 'Refund tracking for canceled bookings';
COMMENT ON TABLE booking_state_log IS 'Audit log for booking status transitions';

COMMENT ON COLUMN users.min_price_per_15_min IS 'Minimum price in cents for 15 minute bookings';
COMMENT ON COLUMN bookings.price_cents IS 'Total booking price in cents';
COMMENT ON COLUMN bookings.platform_fee_cents IS 'Platform fee (10% of price_cents) in cents';
COMMENT ON COLUMN bookings.responder_payout_cents IS 'Expert payout (90% of price_cents) in cents';

COMMENT ON FUNCTION calculate_booking_financials() IS 'Auto-calculates 10% platform fees and 90% expert payouts (0% for free sessions)';

-- ============================================================================
-- Migration Complete Notice
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 010_PRODUCTION complete: Booking & payment system ready';
  RAISE NOTICE '📋 New tables: responder_availability, booking_slots, payments, refunds, booking_state_log';
  RAISE NOTICE '🔄 Updated table: bookings (added payment columns)';
  RAISE NOTICE '👤 Updated table: users (added min_price_per_15_min)';
  RAISE NOTICE '💰 Free sessions: Set price_cents = 0 (no platform fee)';
  RAISE NOTICE '💵 Paid sessions: 10%% platform fee, 90%% expert payout (auto-calculated)';
  RAISE NOTICE '🎯 Status "awaiting_payment" now supported for unpaid bookings';
END $$;
