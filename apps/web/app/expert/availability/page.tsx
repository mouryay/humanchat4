'use client';

/**
 * Expert Availability Management Page
 * Allows experts to set weekly schedule, block dates, and connect calendar
 */

import { useState, useEffect } from 'react';
import {
  getWeeklyAvailability,
  setWeeklyAvailability,
  getAvailabilitySummary,
  getGoogleAuthUrl,
  disconnectCalendar,
  blockDateRange,
  getAvailabilityOverrides,
  deleteAvailabilityOverride,
  type AvailabilityRule,
  type AvailabilitySummary,
  type AvailabilityOverride
} from '../../../services/expertAvailabilityApi';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ExpertAvailabilityPage() {
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [summary, setSummary] = useState<AvailabilitySummary | null>(null);
  const [blockedOverrides, setBlockedOverrides] = useState<AvailabilityOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timezone] = useState('America/New_York'); // Could be configurable

  // Block dates modal state
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get date range for next 30 days
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const [rulesData, summaryData, overridesData] = await Promise.all([
        getWeeklyAvailability(),
        getAvailabilitySummary(),
        getAvailabilityOverrides(today, futureDate)
      ]);
      
      setRules(rulesData);
      setSummary(summaryData);
      
      // Filter only all-day blocked dates
      const blocked = overridesData.filter(
        (o) => o.overrideType === 'blocked' && !o.startTime && !o.endTime
      );
      setBlockedOverrides(blocked);
    } catch (err) {
      console.error('Failed to fetch availability:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDay = (dayOfWeek: number) => {
    const existingRule = rules.find((r) => r.dayOfWeek === dayOfWeek);

    if (existingRule) {
      // Remove day
      setRules(rules.filter((r) => r.dayOfWeek !== dayOfWeek));
    } else {
      // Add default hours (9 AM - 5 PM)
      setRules([
        ...rules,
        {
          dayOfWeek,
          startTime: '09:00',
          endTime: '17:00',
          slotDurationMinutes: 30,
          timezone
        }
      ]);
    }
  };

  const handleUpdateTime = (
    dayOfWeek: number,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    setRules(
      rules.map((r) =>
        r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Clean rules - only send necessary fields in correct format
      const cleanRules = rules.map((rule) => ({
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        slotDurationMinutes: rule.slotDurationMinutes || 30,
        timezone: rule.timezone
      }));
      
      await setWeeklyAvailability(cleanRules);
      alert('Availability saved successfully!');
      fetchData(); // Refresh summary
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      const authUrl = await getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!confirm('Disconnect Google Calendar?')) return;
    try {
      await disconnectCalendar();
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBlockDates = async () => {
    if (!blockStartDate || !blockEndDate) {
      alert('Please select start and end dates');
      return;
    }

    try {
      await blockDateRange(blockStartDate, blockEndDate, timezone, blockReason);
      setShowBlockModal(false);
      setBlockStartDate('');
      setBlockEndDate('');
      setBlockReason('');
      fetchData();
      alert('Dates blocked successfully!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteBlockedDate = async (overrideId: string, date: string) => {
    if (!confirm(`Are you sure you want to unblock ${new Date(date).toLocaleDateString()}?`)) {
      return;
    }

    try {
      await deleteAvailabilityOverride(overrideId);
      fetchData(); // Refresh data
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-white">Loading availability settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Availability Settings</h1>
          <p className="text-gray-400">Manage when clients can book calls with you</p>
        </div>

        {/* Summary Card */}
        {summary && (
          <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-2xl font-bold text-blue-400">
                  {summary.totalWeeklyHours.toFixed(1)}
                </div>
                <div className="text-sm text-gray-400">Hours/Week</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">
                  {summary.upcomingBlockedDates.length}
                </div>
                <div className="text-sm text-gray-400">Blocked Dates</div>
              </div>
              <div>
                <div
                  className={`text-2xl font-bold ${
                    summary.calendarConnected ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {summary.calendarConnected ? '✓' : '✗'}
                </div>
                <div className="text-sm text-gray-400">Calendar Sync</div>
              </div>
            </div>
          </div>
        )}

        {/* Google Calendar */}
        <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Google Calendar Integration</h2>
          <p className="text-gray-400 mb-4">
            Connect your Google Calendar to automatically sync busy times and prevent
            double-booking.
          </p>

          {summary?.calendarConnected ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-green-900/20 border border-green-500 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                  <span className="text-green-400 font-medium">
                    Connected to Google Calendar
                  </span>
                </div>
              </div>
              <button
                onClick={handleDisconnectCalendar}
                className="bg-red-900/20 hover:bg-red-900/30 text-red-400 px-6 py-3 rounded-lg font-medium"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectCalendar}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
              </svg>
              Connect Google Calendar
            </button>
          )}
        </div>

        {/* Weekly Schedule */}
        <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Weekly Schedule</h2>
          <p className="text-gray-400 mb-6">
            Set your recurring availability for each day of the week
          </p>

          <div className="space-y-3">
            {DAYS.map((day, index) => {
              const rule = rules.find((r) => r.dayOfWeek === index);
              const isEnabled = !!rule;

              return (
                <div
                  key={index}
                  className="bg-[#0a0e27] rounded-lg p-4 flex items-center gap-4"
                >
                  {/* Day Toggle */}
                  <button
                    onClick={() => handleToggleDay(index)}
                    className={`w-32 text-left px-4 py-2 rounded-lg font-medium transition-colors ${
                      isEnabled
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {day}
                  </button>

                  {/* Time Inputs */}
                  {isEnabled && rule ? (
                    <>
                      <input
                        type="time"
                        value={rule.startTime}
                        onChange={(e) =>
                          handleUpdateTime(index, 'startTime', e.target.value)
                        }
                        className="bg-[#1a1f3a] border border-gray-600 rounded-lg px-4 py-2 text-white"
                      />
                      <span className="text-gray-400">to</span>
                      <input
                        type="time"
                        value={rule.endTime}
                        onChange={(e) =>
                          handleUpdateTime(index, 'endTime', e.target.value)
                        }
                        className="bg-[#1a1f3a] border border-gray-600 rounded-lg px-4 py-2 text-white"
                      />
                    </>
                  ) : (
                    <span className="text-gray-500 italic">Unavailable</span>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 rounded-lg"
          >
            {saving ? 'Saving...' : 'Save Weekly Schedule'}
          </button>
        </div>

        {/* Block Dates */}
        <div className="bg-[#1a1f3a] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Block Dates</h2>
          <p className="text-gray-400 mb-4">
            Temporarily block dates for vacation or personal time
          </p>

          <button
            onClick={() => setShowBlockModal(true)}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            Block Date Range
          </button>

          {blockedOverrides.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Upcoming Blocked Dates:</h3>
              <div className="flex flex-wrap gap-2">
                {blockedOverrides.map((override) => (
                  <span
                    key={override.id}
                    className="bg-red-900/20 border border-red-500 text-red-400 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                  >
                    <span>{new Date(override.overrideDate).toLocaleDateString()}</span>
                    <button
                      onClick={() => handleDeleteBlockedDate(override.id, override.overrideDate)}
                      className="hover:text-red-200 transition-colors"
                      title="Remove this blocked date"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Block Dates Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-[#1a1f3a] rounded-lg p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold mb-4">Block Date Range</h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={blockStartDate}
                  onChange={(e) => setBlockStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-[#0a0e27] border border-gray-600 rounded-lg px-4 py-3 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <input
                  type="date"
                  value={blockEndDate}
                  onChange={(e) => setBlockEndDate(e.target.value)}
                  min={blockStartDate || new Date().toISOString().split('T')[0]}
                  className="w-full bg-[#0a0e27] border border-gray-600 rounded-lg px-4 py-3 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="e.g., Vacation"
                  className="w-full bg-[#0a0e27] border border-gray-600 rounded-lg px-4 py-3 text-white"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleBlockDates}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 rounded-lg"
              >
                Block Dates
              </button>
              <button
                onClick={() => setShowBlockModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
