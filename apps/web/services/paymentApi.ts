/**
 * Update booking status after payment
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function confirmBookingPayment(bookingId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/bookings/${bookingId}/confirm-payment`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to confirm payment');
  }

  return response.json();
}
