'use client';

import { useMemo, useState } from 'react';
import type { CalendarSlot } from '../services/bookingService';
import { formatSlotDate, formatSlotTimeRange, getSlotDurationMinutes, getTimezoneAbbreviation } from '../utils/timezone';
import styles from './BookingModal.module.css';

const DURATION_OPTIONS = [15, 30, 60];

interface CalendarSlotPickerProps {
  slots: CalendarSlot[];
  timezone: string;
  getPriceForDuration: (duration: number) => number;
  onSelect: (slot: CalendarSlot, duration: number, price: number) => void;
  loading?: boolean;
  error?: string | null;
}

const getDefaultDuration = (slotDuration: number): number => {
  const available = DURATION_OPTIONS.find((duration) => duration <= slotDuration);
  return available ?? slotDuration;
};

export default function CalendarSlotPicker({ slots, timezone, getPriceForDuration, onSelect, loading, error }: CalendarSlotPickerProps) {
  const [selectedDurations, setSelectedDurations] = useState<Record<string, number>>({});

  const openSlots = useMemo(() => slots.filter((slot) => slot.status === 'open'), [slots]);

  if (loading) {
    return <div className={styles.loadingState}>Loading available times…</div>;
  }

  if (error) {
    return <div className={styles.errorState}>{error}</div>;
  }

  if (!openSlots.length) {
    return <div className={styles.emptyState}>No open slots detected. Try syncing your calendar or pick another profile.</div>;
  }

  const handleDurationChange = (slotId: string, duration: number) => {
    setSelectedDurations((prev) => ({ ...prev, [slotId]: duration }));
  };

  const handleSelect = (slot: CalendarSlot) => {
    const slotDuration = getSlotDurationMinutes(slot.start, slot.end);
    const duration = selectedDurations[slot.id] ?? getDefaultDuration(slotDuration);
    const price = getPriceForDuration(duration);
    onSelect(slot, duration, price);
  };

  return (
    <div className={styles.slotGrid}>
      {openSlots.map((slot) => {
        const slotDuration = getSlotDurationMinutes(slot.start, slot.end);
        const availableDurations = DURATION_OPTIONS.filter((duration) => duration <= slotDuration);
        const selection = selectedDurations[slot.id] ?? getDefaultDuration(slotDuration);
        const timezoneBadge = getTimezoneAbbreviation(timezone, slot.start);
        return (
          <div key={slot.id} className={styles.slotCard}>
            <div className={styles.slotDate}>{formatSlotDate(slot.start, timezone)}</div>
            <div className={styles.slotTime}>
              {formatSlotTimeRange(slot.start, slot.end, timezone)} • {timezoneBadge}
            </div>
            <div className={styles.durationRow}>
              {availableDurations.map((duration) => (
                <button
                  key={`${slot.id}-${duration}`}
                  type="button"
                  className={`${styles.durationButton} ${selection === duration ? styles.durationButtonActive : ''}`}
                  onClick={() => handleDurationChange(slot.id, duration)}
                >
                  {duration} min • ${getPriceForDuration(duration).toFixed(0)}
                </button>
              ))}
              {availableDurations.length === 0 && <div className={styles.slotTime}>Slot too short for our presets.</div>}
            </div>
            <div className={styles.priceRow}>
              Selected · {selection} min · ${getPriceForDuration(selection).toFixed(2)}
            </div>
            <button type="button" className={styles.selectButton} onClick={() => handleSelect(slot)}>
              Select
            </button>
          </div>
        );
      })}
    </div>
  );
}
