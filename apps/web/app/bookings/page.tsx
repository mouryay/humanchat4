'use client';

/**
 * My Bookings Page
 * Shows user's bookings with tabs: Upcoming, Past, Canceled
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserBookings, getExpertBookings, cancelBooking } from '../../services/bookingApi';
import { Booking } from '../../../../src/lib/db';

type TabType = 'upcoming' | 'past' | 'canceled';

export default function BookingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ upcoming: 0, past: 0, canceled: 0 });

  useEffect(() => {
    fetchBookings(activeTab);
    fetchCounts();
  }, [activeTab]);

  const fetchBookings = async (tab: TabType) => {
    setLoading(true);
    try {
      // Fetch both bookings where user is client and where user is expert
      const [clientBookings, expertBookings] = await Promise.all([
        getUserBookings(tab),
        getExpertBookings(tab)
      ]);
      
      // Combine and sort by start time (most recent first)
      const allBookings = [...clientBookings, ...expertBookings].sort(
        (a, b) => b.startTime - a.startTime
      );
      
      setBookings(allBookings);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCounts = async () => {
    try {
      const [upcomingClient, pastClient, canceledClient, upcomingExpert, pastExpert, canceledExpert] = await Promise.all([
        getUserBookings('upcoming'),
        getUserBookings('past'),
        getUserBookings('canceled'),
        getExpertBookings('upcoming'),
        getExpertBookings('past'),
        getExpertBookings('canceled')
      ]);
      
      setCounts({
        upcoming: upcomingClient.length + upcomingExpert.length,
        past: pastClient.length + pastExpert.length,
        canceled: canceledClient.length + canceledExpert.length
      });
    } catch (err) {
      console.error('Failed to fetch counts:', err);
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await cancelBooking(bookingId);
      fetchBookings(activeTab);
      fetchCounts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-green-900/30 text-green-400 border-green-500';
      case 'completed':
        return 'bg-blue-900/30 text-blue-400 border-blue-500';
      case 'cancelled_by_user':
      case 'cancelled_by_expert':
        return 'bg-red-900/30 text-red-400 border-red-500';
      case 'in_progress':
        return 'bg-purple-900/30 text-purple-400 border-purple-500';
      default:
        return 'bg-gray-900/30 text-gray-400 border-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Scheduled';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Finished';
      case 'cancelled_by_user':
        return 'Cancelled';
      case 'cancelled_by_expert':
        return 'Cancelled by Expert';
      case 'no_show':
        return 'No Show';
      default:
        return status;
    }
  };

  const canJoinCall = (booking: Booking) => {
    const now = Date.now();
    const startTime = booking.startTime;
    const fifteenMinsBefore = startTime - 15 * 60 * 1000;
    return (
      booking.status === 'scheduled' &&
      now >= fifteenMinsBefore &&
      now <= booking.endTime
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Bookings</h1>
          <p className="text-gray-400">Manage your scheduled calls</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 mb-6 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`pb-3 px-1 transition-colors relative ${
              activeTab === 'upcoming'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Upcoming
            {counts.upcoming > 0 && (
              <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                {counts.upcoming}
              </span>
            )}
            {activeTab === 'upcoming' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('past')}
            className={`pb-3 px-1 transition-colors relative ${
              activeTab === 'past'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Past
            {counts.past > 0 && (
              <span className="ml-2 bg-gray-600 text-white text-xs px-2 py-0.5 rounded-full">
                {counts.past}
              </span>
            )}
            {activeTab === 'past' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('canceled')}
            className={`pb-3 px-1 transition-colors relative ${
              activeTab === 'canceled'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Canceled
            {counts.canceled > 0 && (
              <span className="ml-2 bg-gray-600 text-white text-xs px-2 py-0.5 rounded-full">
                {counts.canceled}
              </span>
            )}
            {activeTab === 'canceled' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        </div>

        {/* Bookings List */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <p className="mb-4">No {activeTab} bookings</p>
            <button
              onClick={() => router.push('/account')}
              className="text-blue-400 hover:text-blue-300"
            >
              Browse experts
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.bookingId}
                className="bg-[#1a1f3a] rounded-lg p-6 hover:bg-[#1f2540] transition-colors"
              >
                <div className="flex items-start justify-between">
                  {/* Expert Info */}
                  <div className="flex items-center gap-4 flex-1">
                    {booking.expertAvatar && (
                      <img
                        src={booking.expertAvatar}
                        alt={booking.expertName}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-1">
                        {booking.expertName}
                      </h3>
                      {booking.expertHeadline && (
                        <p className="text-gray-400 text-sm mb-2">
                          {booking.expertHeadline}
                        </p>
                      )}

                      {/* Date & Time */}
                      <div className="flex items-center gap-4 text-sm text-gray-300">
                        <div className="flex items-center gap-1">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <span>{formatDate(booking.startTime)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span>
                            {formatTime(booking.startTime)} -{' '}
                            {formatTime(booking.endTime)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>{booking.durationMinutes} min</span>
                        </div>
                      </div>

                      {/* Platform Badge */}
                      {booking.calendarEventId && (
                        <div className="mt-2 flex items-center gap-2">
                          <svg
                            className="w-4 h-4 text-blue-400"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
                          </svg>
                          <span className="text-xs text-gray-400">
                            Google Calendar
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex flex-col items-end gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                        booking.status
                      )}`}
                    >
                      {getStatusLabel(booking.status)}
                    </span>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {activeTab === 'upcoming' && canJoinCall(booking) && (
                        <button
                          onClick={() =>
                            router.push(`/call/${booking.bookingId}`)
                          }
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          Join Call
                        </button>
                      )}

                      {activeTab === 'upcoming' &&
                        booking.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() =>
                                router.push(
                                  `/bookings/${booking.bookingId}/reschedule`
                                )
                              }
                              className="bg-[#0a0e27] hover:bg-[#151b35] text-gray-300 px-4 py-2 rounded-lg text-sm font-medium"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleCancel(booking.bookingId)}
                              className="bg-[#0a0e27] hover:bg-red-900/20 text-red-400 px-4 py-2 rounded-lg text-sm font-medium"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                      {activeTab === 'canceled' && (
                        <button
                          onClick={() =>
                            router.push(
                              `/experts/${booking.expertId}/schedule`
                            )
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                        >
                          Rebook
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
