'use client';

import { useState, FormEvent } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { confirmBookingPayment } from '../services/paymentApi';

interface PaymentFormProps {
  bookingId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  amount: number;  // in cents
}

export default function PaymentForm({ bookingId, onSuccess, onError, amount }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/bookings/payment-complete`,
        },
        redirect: 'if_required',  // Stay on page unless 3D Secure needed
      });

      if (error) {
        onError(error.message || 'Payment failed');
      } else {
        // Payment succeeded - update booking status on backend
        console.log('[PaymentForm] Payment succeeded, updating booking status...');
        await confirmBookingPayment(bookingId);
        console.log('[PaymentForm] Booking status updated to scheduled');
        onSuccess();
      }
    } catch (err: any) {
      console.error('[PaymentForm] Error:', err);
      onError(err.message || 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Payment Details</h3>
          <p className="text-sm text-gray-600 mt-1">
            Total: ${(amount / 100).toFixed(2)}
          </p>
        </div>

        <PaymentElement 
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {isProcessing ? 'Processing...' : `Pay $${(amount / 100).toFixed(2)}`}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Your payment is secured by Stripe. We never see your card details.
      </p>
    </form>
  );
}
