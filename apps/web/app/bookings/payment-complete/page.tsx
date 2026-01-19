'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function PaymentCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect_status = searchParams.get('redirect_status');

  useEffect(() => {
    // Stripe redirects here after 3D Secure
    if (redirect_status === 'succeeded') {
      // Payment succeeded, find the booking ID from session storage or URL
      console.log('[PaymentComplete] Payment succeeded');
      // Redirect to home or bookings list
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } else if (redirect_status === 'failed') {
      console.error('[PaymentComplete] Payment failed');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    }
  }, [redirect_status, router]);

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        {redirect_status === 'succeeded' ? (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
            <p className="text-gray-400 mb-6">
              Your booking has been confirmed. Redirecting you home...
            </p>
          </>
        ) : redirect_status === 'failed' ? (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-3xl font-bold mb-2">Payment Failed</h1>
            <p className="text-gray-400 mb-6">
              Something went wrong. Please try again. Redirecting...
            </p>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">⏳</div>
            <h1 className="text-3xl font-bold mb-2">Processing Payment...</h1>
            <p className="text-gray-400">Please wait while we confirm your payment.</p>
          </>
        )}
      </div>
    </div>
  );
}
