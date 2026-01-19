# HumanChat Payment System - Complete Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Payment Flow Diagram](#payment-flow-diagram)
3. [Architecture](#architecture)
4. [Implementation Details](#implementation-details)
5. [Payout System](#payout-system)
6. [Deployment Guide](#deployment-guide)
7. [Testing & Monitoring](#testing--monitoring)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

HumanChat's payment system handles **paid and free bookings** with Stripe integration, automatic refunds, and expert payouts. The system uses Payment Intents (embedded payment form) rather than Checkout Sessions for a seamless in-app experience.

**Key Features:**
- ✅ Embedded Stripe Payment Elements (no redirect)
- ✅ Automatic 10% platform fee calculation
- ✅ 90% payout to experts
- ✅ Automatic refunds on cancellation
- ✅ Payment tracking in database
- ✅ Stripe Connect for expert payouts

---

## 💳 Payment Flow Diagram

### End-to-End Flow: Requester → HumanChat → Stripe → Expert

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BOOKING & PAYMENT FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: BOOKING CREATION
┌───────────┐                                    ┌──────────────┐
│ Requester │──── Select Time Slot ────────────▶│  HumanChat   │
└───────────┘                                    │   Backend    │
                                                 └──────┬───────┘
                                                        │
                                         Creates Booking (status: awaiting_payment)
                                         Calculates: price_cents = $30.00
                                                   platform_fee = $3.00 (10%)
                                                   responder_payout = $27.00 (90%)
                                                        │
                                                        ▼
                                               ┌─────────────┐
                                               │  Database   │
                                               │  bookings   │
                                               │  payments   │
                                               └─────────────┘

Step 2: PAYMENT INTENT CREATION
┌───────────┐                                    ┌──────────────┐
│ Requester │◀─── Payment Form UI ──────────────│  HumanChat   │
└───────────┘     (Stripe Elements)              │   Backend    │
                                                 └──────┬───────┘
                                                        │
                                         Creates Stripe Payment Intent
                                         Stores: stripe_payment_intent_id
                                         Returns: client_secret
                                                        │
                                                        ▼
                                               ┌─────────────┐
                                               │   Stripe    │
                                               │     API     │
                                               └─────────────┘

Step 3: PAYMENT COLLECTION
┌───────────┐                                    ┌──────────────┐
│ Requester │──── Enters Card (4242...)  ───────▶│   Stripe     │
│           │                                     │   Elements   │
└───────────┘                                     └──────┬───────┘
      ▲                                                  │
      │                                    Validates & Charges Card
      └───── Payment Success ◀─────────────────────────┘

Step 4: PAYMENT CONFIRMATION
┌───────────┐                                    ┌──────────────┐
│ Requester │──── Confirm Payment ──────────────▶│  HumanChat   │
│  Browser  │                                     │   Backend    │
└───────────┘                                     └──────┬───────┘
                                                         │
                                          Updates booking status: 'scheduled'
                                          Updates payment status: 'succeeded'
                                          Records paid_at timestamp
                                                         │
                                                         ▼
                                                ┌─────────────┐
                                                │  Database   │
                                                │  bookings   │
                                                │  payments   │
                                                └─────────────┘

Step 5: SESSION COMPLETION
┌───────────┐                                    ┌──────────────┐
│ Requester │──── Join Video Call ──────────────▶│   Expert     │
│           │                                     │ (Responder)  │
└───────────┘                                     └──────────────┘
      │                                                   │
      └──────────── Video Session ───────────────────────┘
                         │
                         ▼
             Booking status: 'completed'

Step 6: PAYOUT (Manual via Stripe Dashboard - Currently)
┌─────────────────────────────────────────────────────────────┐
│                   Expert Payout Process                      │
│                                                              │
│  Platform Admin Actions (via Stripe Dashboard):             │
│  1. Login to dashboard.stripe.com                          │
│  2. Navigate to Payments → Completed                        │
│  3. Review completed bookings ($27.00 expert payout)       │
│  4. Process payout to expert's bank account                │
│                                                              │
│  Expert receives: $27.00 (90% of $30.00)                   │
│  Platform keeps: $3.00 (10% platform fee)                  │
└─────────────────────────────────────────────────────────────┘

CANCELLATION & REFUND FLOW
┌───────────┐                                    ┌──────────────┐
│ Requester │──── Cancel Booking ───────────────▶│  HumanChat   │
│           │                                     │   Backend    │
└───────────┘                                     └──────┬───────┘
                                                         │
                                          Checks payment: stripe_payment_intent_id
                                          Creates Stripe refund
                                          Updates booking: 'cancelled_by_user'
                                          Updates payment: 'refunded'
                                                         │
                                                         ▼
                                                ┌─────────────┐
                                                │   Stripe    │
                                                │  Refund API │
                                                └──────┬──────┘
                                                       │
                           Refund processes (instant for test mode)
                           Money returned to requester's card
                                                       │
                                                       ▼
                                                ┌─────────────┐
                                                │  Database   │
                                                │  refunds    │
                                                └─────────────┘
```

### Money Flow Breakdown

```
Requester pays: $30.00
        ↓
┌───────────────────────┐
│  HumanChat Platform   │
│  (Stripe Account)     │
└─────────┬─────────────┘
          │
          ├──▶ Platform Fee: $3.00 (10%)
          │
          └──▶ Expert Payout: $27.00 (90%)
                      ↓
              ┌──────────────┐
              │    Expert    │
              │ Bank Account │
              └──────────────┘
```

---

## 🏗️ Architecture

### Database Tables

#### **bookings** (Main booking records)
```sql
- id (UUID)
- user_id (requester)
- expert_id (responder)
- start_time / end_time
- duration_minutes
- status (awaiting_payment, scheduled, completed, cancelled_by_user, etc.)
- price_cents (3000 = $30.00)
- platform_fee_cents (300 = $3.00, auto-calculated)
- responder_payout_cents (2700 = $27.00, auto-calculated)
- created_at / updated_at
```

#### **payments** (Payment tracking)
```sql
- id (UUID)
- booking_id (FK to bookings)
- stripe_payment_intent_id (pi_xxx)
- amount_cents (3000)
- currency (USD)
- platform_fee_cents (300)
- responder_payout_cents (2700)
- status (pending, succeeded, refunded)
- paid_at
- created_at / updated_at
```

#### **refunds** (Refund tracking)
```sql
- id (UUID)
- payment_id (FK to payments)
- booking_id (FK to bookings)
- stripe_refund_id (re_xxx)
- amount_cents (3000)
- status (succeeded, failed)
- reason
- requested_by
- created_at
```

### Backend Services

**bookingService.ts** - Main booking business logic
- `createBooking()` - Creates booking with payment calculation
- `cancelBooking()` - Cancels booking and processes refund
- `updateBookingStatus()` - Updates booking state
- `createPaymentRecord()` - Stores payment intent in DB
- `updatePaymentStatus()` - Updates payment to 'succeeded'

**bookingPaymentService.ts** - Stripe integration
- `createBookingPaymentIntent()` - Creates Stripe Payment Intent
- `createBookingRefund()` - Creates Stripe refund
- `getStripeClient()` - Returns configured Stripe client

### Frontend Components

**PaymentForm.tsx** - Stripe Elements payment form
- Collects card details
- Confirms payment with Stripe
- Calls backend to update booking status

**schedule/page.tsx** - Booking creation page
- Calculates price from expert rates
- Creates booking with payment
- Shows payment form if required
- Confirms payment after Stripe success

---

## 💰 Payout System

### Current Implementation (Manual)

**Expert Payout Process:**

1. **Expert completes session** → Booking status becomes 'completed'

2. **Platform admin reviews payouts** (via Stripe Dashboard):
   ```
   Login: dashboard.stripe.com/test (for test mode)
   Navigate: Payments → Filter by "Succeeded"
   ```

3. **Identify payouts:**
   - Each booking has metadata: `bookingId`, `expertId`, `userId`
   - Expert payout amount: `responder_payout_cents / 100`
   - Example: $27.00 for $30 booking

4. **Process payout manually:**
   - Currently: Admin transfers money to expert's bank account
   - Track in spreadsheet or admin panel
   - Expert receives payment via bank transfer/PayPal

### Database Query for Pending Payouts

```sql
-- Find completed bookings awaiting payout
SELECT 
  b.id as booking_id,
  b.expert_id,
  e.name as expert_name,
  e.email as expert_email,
  b.responder_payout_cents / 100.0 as payout_amount_dollars,
  b.scheduled_start as session_date,
  b.created_at as booking_created
FROM bookings b
JOIN users e ON b.expert_id = e.id
JOIN payments p ON b.id = p.booking_id
WHERE b.status = 'completed'
  AND p.status = 'succeeded'
  AND b.created_at >= NOW() - INTERVAL '30 days'
ORDER BY b.created_at DESC;
```

### Future: Automated Payouts (Stripe Connect)

**Planned Enhancement:**

1. **Expert onboarding:**
   - Expert creates Stripe Connect account
   - Verifies identity (KYC)
   - Links bank account

2. **Automatic split payments:**
   ```javascript
   const paymentIntent = await stripe.paymentIntents.create({
     amount: 3000, // $30.00
     currency: 'usd',
     transfer_data: {
       destination: expert.stripeConnectAccountId,
       amount: 2700, // $27.00 (90%)
     },
     application_fee_amount: 300, // $3.00 (10%)
   });
   ```

3. **Instant payouts:**
   - Money flows directly to expert's account
   - No manual intervention required
   - Expert sees payout in 2-7 business days (or instant with Stripe Instant Payouts)

---

## 🚀 Implementation Details

### 1. Price Calculation

**Backend (bookingService.ts):**
```typescript
// Calculate price from expert's instant_rate_per_minute
const pricePerMinute = expert.instant_rate_per_minute; // $1.00/min
const durationMinutes = 30;
const priceCents = Math.round(pricePerMinute * durationMinutes * 100); // $30.00

// Database trigger auto-calculates:
platform_fee_cents = price_cents * 0.10;  // $3.00
responder_payout_cents = price_cents - platform_fee_cents; // $27.00
```

### 2. Payment Intent Creation

**Backend route (bookingRoutes.ts):**
```typescript
// Create Payment Intent
const paymentIntent = await bookingPaymentService.createBookingPaymentIntent({
  bookingId: booking.bookingId,
  amountCents: booking.priceCents,
  currency: 'usd',
  requesterEmail: booking.requesterEmail,
  metadata: {
    bookingId: booking.bookingId,
    expertId: booking.expertId,
    userId: booking.userId
  }
});

// Store in database
await bookingService.createPaymentRecord({
  bookingId: booking.bookingId,
  stripePaymentIntentId: paymentIntent.id,
  amountCents: booking.priceCents,
  currency: 'usd',
  platformFeeCents: booking.platformFeeCents,
  responderPayoutCents: booking.responderPayoutCents
});

// Return client_secret to frontend
return { paymentIntentClientSecret: paymentIntent.client_secret };
```

### 3. Payment Confirmation

**Frontend (PaymentForm.tsx):**
```typescript
// User submits payment form
const { error: stripeError } = await stripe.confirmPayment({
  elements,
  redirect: 'if_required',
  confirmParams: {
    return_url: window.location.href,
  },
});

if (!stripeError) {
  // Payment succeeded - call backend
  await confirmBookingPayment(bookingId);
}
```

**Backend (bookingRoutes.ts):**
```typescript
// Update booking status
await bookingService.updateBookingStatus(bookingId, 'scheduled', userId);

// Update payment status
await bookingService.updatePaymentStatus(bookingId, 'succeeded');
```

### 4. Refund Processing

**Backend (bookingService.ts):**
```typescript
// Get payment intent ID
const paymentResult = await query(
  `SELECT stripe_payment_intent_id FROM payments 
   WHERE booking_id = $1 AND status = 'succeeded'`,
  [bookingId]
);

if (paymentResult.rows.length > 0) {
  // Create refund in Stripe
  const refund = await createBookingRefund({
    paymentIntentId: paymentResult.rows[0].stripe_payment_intent_id,
    reason: 'Booking cancelled by user',
    metadata: { bookingId, cancelledBy }
  });

  // Record refund in database
  await query(
    `INSERT INTO refunds (payment_id, booking_id, stripe_refund_id, 
     amount_cents, currency, status, reason, requested_by)
     VALUES (...)`
  );

  // Update payment status
  await query(
    `UPDATE payments SET status = 'refunded', updated_at = NOW() 
     WHERE stripe_payment_intent_id = $1`,
    [paymentIntentId]
  );
}
```

---

## 📦 Deployment Guide

### Pre-Deployment Checklist

- [ ] Database backup completed
- [ ] Stripe test keys configured
- [ ] Environment variables set
- [ ] Migration tested on staging
- [ ] Payment flow tested end-to-end

### Step 1: Database Migration

```bash
# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migration
npm run db:migrate

# Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM payments;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM refunds;"
```

### Step 2: Environment Variables

```bash
# Backend (.env.backend.local or Cloud Run secrets)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend (apps/web/.env.local)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Step 3: Deploy Backend

```bash
# Build
npm run build

# Deploy to Cloud Run (or your platform)
./scripts/deploy-cloud-run.sh

# Verify
curl https://your-api.com/health
```

### Step 4: Deploy Frontend

```bash
cd apps/web
npm run build
vercel --prod
```

### Step 5: Configure Stripe Webhooks (Future)

```bash
# Create webhook endpoint
stripe webhooks create \
  --url https://your-api.com/api/webhooks/stripe \
  --events payment_intent.succeeded,payment_intent.payment_failed,charge.refunded
```

---

## 🧪 Testing & Monitoring

### Manual Testing

**Test 1: Create Paid Booking**
```bash
1. Login as requester
2. Navigate to expert profile (instant_rate_per_minute = 1.00)
3. Select 30-minute slot
4. Click "Continue to Payment"
5. Enter test card: 4242 4242 4242 4242, any future date, any CVC
6. Click "Pay $30.00"
7. Verify booking status changes to "scheduled"
8. Check database: booking status, payment status
```

**Test 2: Cancel with Refund**
```bash
1. Login as requester
2. Go to "My Bookings"
3. Find paid booking with status "scheduled"
4. Click "Cancel"
5. Verify refund appears in Stripe Dashboard
6. Check database: booking cancelled, payment refunded, refund record created
```

### Database Queries

**Check recent payments:**
```sql
SELECT 
  b.id as booking_id,
  b.status as booking_status,
  b.price_cents / 100.0 as price,
  p.stripe_payment_intent_id,
  p.status as payment_status,
  p.paid_at
FROM bookings b
LEFT JOIN payments p ON b.id = p.booking_id
ORDER BY b.created_at DESC
LIMIT 10;
```

**Check refunds:**
```sql
SELECT 
  r.stripe_refund_id,
  r.amount_cents / 100.0 as refund_amount,
  r.status,
  r.reason,
  r.created_at,
  p.stripe_payment_intent_id,
  b.id as booking_id
FROM refunds r
JOIN payments p ON r.payment_id = p.id
JOIN bookings b ON r.booking_id = b.id
ORDER BY r.created_at DESC
LIMIT 10;
```

### Monitoring

**Key Metrics:**

1. **Booking Creation Rate**
   ```sql
   SELECT COUNT(*) FROM bookings 
   WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

2. **Payment Success Rate**
   ```sql
   SELECT 
     COUNT(CASE WHEN status = 'succeeded' THEN 1 END) * 100.0 / COUNT(*) 
   FROM payments
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```

3. **Platform Revenue**
   ```sql
   SELECT SUM(platform_fee_cents) / 100.0 as revenue
   FROM bookings
   WHERE status = 'completed'
     AND created_at > NOW() - INTERVAL '30 days';
   ```

4. **Pending Payouts**
   ```sql
   SELECT SUM(responder_payout_cents) / 100.0 as pending_payouts
   FROM bookings
   WHERE status = 'completed'
     AND created_at > NOW() - INTERVAL '30 days';
   ```

---

## 🐛 Troubleshooting

### Issue: Payment Intent not created

**Symptoms:** No `stripe_payment_intent_id` in payments table

**Solution:**
1. Check Stripe API keys are correct
2. Verify `createBookingPaymentIntent()` is called
3. Check backend logs for Stripe errors
4. Ensure `createPaymentRecord()` is called after Payment Intent creation

### Issue: Booking status not updating after payment

**Symptoms:** Payment succeeds but booking stays "awaiting_payment"

**Solution:**
1. Check frontend calls `confirmBookingPayment()`
2. Verify backend endpoint `/api/bookings/:id/confirm-payment` exists
3. Check `updateBookingStatus()` and `updatePaymentStatus()` are called
4. Verify database updates are committed

### Issue: Refund not processing

**Symptoms:** Cancel button works but no refund in Stripe

**Solution:**
1. Check payment exists: `SELECT * FROM payments WHERE booking_id = '...'`
2. Verify payment status is 'succeeded'
3. Check Stripe Dashboard for payment intent ID
4. Manually create refund in Stripe if needed
5. Update database: `UPDATE payments SET status = 'refunded' WHERE id = '...'`

### Issue: Double payment charged

**Symptoms:** User charged twice for same booking

**Solution:**
1. Check for duplicate Payment Intents in Stripe
2. Verify idempotency (each booking should have one payment record)
3. Refund duplicate payment manually
4. Add unique constraint: `ALTER TABLE payments ADD CONSTRAINT unique_booking_payment UNIQUE (booking_id);`

---

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| `src/server/services/bookingService.ts` | Booking business logic, payment tracking |
| `src/server/services/bookingPaymentService.ts` | Stripe API integration |
| `src/server/routes/bookingRoutes.ts` | REST API endpoints |
| `apps/web/components/PaymentForm.tsx` | Stripe Elements payment UI |
| `apps/web/services/paymentApi.ts` | Frontend API client |
| `apps/web/app/experts/[expertId]/schedule/page.tsx` | Booking creation page |
| `src/server/db/migrations/006_booking_payment_system.sql` | Database schema |

---

## ✅ Success Criteria

- ✅ Users can book paid sessions ($30 for 30 min)
- ✅ Payment form displays with Stripe Elements
- ✅ Payment Intent creates successfully
- ✅ Payment confirmation updates booking status
- ✅ Cancellation creates automatic refund
- ✅ Platform fee (10%) calculates correctly
- ✅ Expert payout (90%) calculates correctly
- ✅ Payment data persists in database
- ⏳ Expert receives payout (manual process currently)
- ⏳ Stripe webhooks configured (future enhancement)

---

## 🎉 Summary

The HumanChat payment system provides:

✅ **Embedded Payment Experience** - No redirect, Stripe Elements in-app
✅ **Automatic Fee Calculation** - 10% platform, 90% expert payout
✅ **Automatic Refunds** - Full refund on cancellation
✅ **Payment Tracking** - Complete audit trail in database
✅ **Test Mode Ready** - Use test cards for development
✅ **Production Ready** - Switch to live keys for production

**Next Steps:**
1. ✅ Complete manual payout process for past bookings
2. ⏳ Implement Stripe Connect for automated payouts
3. ⏳ Add webhook handling for payment events
4. ⏳ Build admin dashboard for payout management
