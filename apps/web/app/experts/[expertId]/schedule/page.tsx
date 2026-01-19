'use client';

/**
 * Booking Page - Schedule a call with an expert
 * URL: /experts/[expertId]/schedule
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getExpertAvailability, createBooking, type TimeSlot } from '../../../../services/bookingApi';
import { ProfileSummary } from '@/src/lib/db';
import { useAuthIdentity } from '../../../../hooks/useAuthIdentity';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import PaymentForm from '../../../../components/PaymentForm';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function BookingPage() {
  const router = useRouter();
  const params = useParams();
  const expertId = params?.expertId as string;
  const { identity, loading: authLoading } = useAuthIdentity();

  // Debug logs
  useEffect(() => {
    console.log('[Schedule] Component mounted, expertId:', expertId);
  }, [expertId]);

  useEffect(() => {
    console.log('[Schedule] Auth state changed - authLoading:', authLoading, 'identity:', identity?.email || 'null', 'identity object:', identity);
  }, [authLoading, identity]);

  const [expert, setExpert] = useState<ProfileSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [meetingNotes, setMeetingNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // Payment flow state
  const [paymentIntentClientSecret, setPaymentIntentClientSecret] = useState<string | null>(null);
  const [bookingAmount, setBookingAmount] = useState<number>(0);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);

  // Initialize timezone and default date
  useEffect(() => {
    if (!identity) {
      console.log('[Schedule] Waiting for auth...', { authLoading, hasIdentity: !!identity });
      return;
    }

    console.log('[Schedule] User authenticated, initializing...', identity.email);
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(userTimezone);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);

    // Fetch expert details only once when identity is available
    if (!expert) {
      fetchExpertProfile(expertId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, expertId]);

  // Fetch availability when date changes
  useEffect(() => {
    if (selectedDate && timezone && identity) {
      fetchAvailability();
    }
  }, [selectedDate, timezone, identity]);

  const fetchExpertProfile = async (id: string) => {
    setProfileLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${API_BASE}/api/users/${id}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('User not authenticated, redirecting to home');
          router.push('/?focus=sam');
          return;
        }
        throw new Error(`Failed to fetch expert profile: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Expert profile loaded:', data.data);
      console.log('Expert conversationType:', data.data?.conversationType);
      console.log('Expert instantRatePerMinute:', data.data?.instantRatePerMinute);
      console.log('Expert minPricePer15Min:', data.data?.minPricePer15Min);
      setExpert(data.data);
    } catch (err) {
      console.error('Failed to fetch expert:', err);
      setError('Failed to load expert profile. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchAvailability = async () => {
    setLoading(true);
    setError('');
    try {
      const slots = await getExpertAvailability(expertId, selectedDate, timezone);
      setAvailableSlots(slots);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!selectedSlot) return;

    setSubmitting(true);
    setError('');

    try {
      const booking = await createBooking(expertId, {
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        durationMinutes: 30,
        timezone,
        meetingNotes,
        idempotencyKey: `${expertId}-${selectedSlot.start}-${Date.now()}`
      });

      // Check if payment is required
      if (booking.requiresPayment && booking.paymentIntentClientSecret) {
        // Show payment form
        console.log('[Schedule] Payment required, showing payment form');
        setPaymentIntentClientSecret(booking.paymentIntentClientSecret);
        setBookingAmount(booking.priceCents || 0);
        setPendingBookingId(booking.bookingId);
        setSubmitting(false);
      } else {
        // Free booking - navigate to confirmation page
        console.log('[Schedule] Free booking confirmed:', booking.bookingId);
        router.push(`/bookings/${booking.bookingId}/confirmation`);
      }
    } catch (err: any) {
      console.error('[Schedule] Booking failed:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handlePaymentSuccess = () => {
    console.log('[Schedule] Payment successful, redirecting to confirmation');
    if (pendingBookingId) {
      router.push(`/bookings/${pendingBookingId}/confirmation`);
    }
  };

  const handlePaymentError = (errorMessage: string) => {
    console.error('[Schedule] Payment failed:', errorMessage);
    setError(`Payment failed: ${errorMessage}`);
    setPaymentIntentClientSecret(null);
    setSubmitting(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (authLoading || !identity) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-white">
          {authLoading ? 'Checking authentication...' : 'Please log in to continue'}
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-white">Loading expert profile...</div>
      </div>
    );
  }

  if (!expert) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Expert not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white p-6">
      <Link href="/?focus=sam" className="fixed left-6 top-6 text-sm font-semibold tracking-wider text-white/70 hover:text-white transition-colors z-10">
        HUMANCHAT.COM
      </Link>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold mb-2">Schedule a Call</h1>
          <p className="text-gray-400">Book a 30-minute session</p>
        </div>

        {/* Expert Profile */}
        <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6 flex items-center gap-4">
          {expert.avatarUrl && (
            <img
              src={expert.avatarUrl}
              alt={expert.name}
              className="w-20 h-20 rounded-full object-cover"
            />
          )}
          <div>
            <h2 className="text-2xl font-semibold">{expert.name}</h2>
            {expert.headline && <p className="text-gray-400">{expert.headline}</p>}
          </div>
        </div>

        {/* Date Selector */}
        <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
          <label className="block text-sm font-medium mb-2">Select Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full bg-[#0a0e27] border border-gray-600 rounded-lg px-4 py-3 text-white"
          />
          <p className="text-sm text-gray-400 mt-2">
            {selectedDate && formatDate(selectedDate)}
          </p>
        </div>

        {/* Timezone Selector */}
        <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
          <label className="block text-sm font-medium mb-2">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full bg-[#0a0e27] border border-gray-600 rounded-lg px-4 py-3 text-white"
          >
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Chicago">Central Time (CT)</option>
            <option value="America/Denver">Mountain Time (MT)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
            <option value="Europe/London">London (GMT)</option>
            <option value="Asia/Kolkata">India (IST)</option>
          </select>
        </div>

        {/* Available Slots */}
        <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">Available Times</h3>

          {loading && <p className="text-gray-400">Loading available slots...</p>}

          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {!loading && availableSlots.length === 0 && (
            <p className="text-gray-400">No available slots for this date</p>
          )}

          {!loading && availableSlots.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {availableSlots.map((slot, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedSlot(slot)}
                  className={`px-4 py-3 rounded-lg border transition-all ${
                    selectedSlot?.start === slot.start
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-[#0a0e27] border-gray-600 text-gray-300 hover:border-blue-500'
                  }`}
                >
                  {formatTime(slot.start)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Meeting Notes */}
        {selectedSlot && (
          <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
            <label className="block text-sm font-medium mb-2">
              Meeting Notes (Optional)
            </label>
            <textarea
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              placeholder="What would you like to discuss?"
              rows={4}
              className="w-full bg-[#0a0e27] border border-gray-600 rounded-lg px-4 py-3 text-white resize-none"
            />
          </div>
        )}

        {/* Book Button / Payment Form */}
        {paymentIntentClientSecret && pendingBookingId ? (
          <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Complete Payment</h3>
            <Elements 
              stripe={stripePromise} 
              options={{ 
                clientSecret: paymentIntentClientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#3b82f6',
                  }
                }
              }}
            >
              <PaymentForm 
                bookingId={pendingBookingId!}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                amount={bookingAmount}
              />
            </Elements>
            <button
              onClick={() => {
                setPaymentIntentClientSecret(null);
                setPendingBookingId(null);
                setSubmitting(false);
              }}
              className="w-full mt-4 text-gray-400 hover:text-white text-sm"
            >
              Cancel and go back
            </button>
          </div>
        ) : (
          <button
            onClick={handleBooking}
            disabled={!selectedSlot || submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors"
          >
            {submitting ? 'Processing...' : 'Continue to Payment'}
          </button>
        )}
      </div>
    </div>
  );
}
