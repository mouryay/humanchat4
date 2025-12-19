/**
 * Expert Availability Management Service
 * Handles CRUD for availability rules and overrides
 */

import { query, pool, transaction } from '../db/postgres.js';
import { ApiError } from '../errors/ApiError.js';

export interface CreateAvailabilityRuleInput {
  expertId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  slotDurationMinutes?: number;
  timezone: string;
}

export interface CreateAvailabilityOverrideInput {
  expertId: string;
  overrideDate: string; // YYYY-MM-DD
  overrideType: 'available' | 'blocked';
  startTime?: string; // HH:MM for partial blocks
  endTime?: string; // HH:MM for partial blocks
  timezone: string;
  reason?: string;
}

/**
 * Create or update availability rule for a day of week
 */
export const upsertAvailabilityRule = async (
  input: CreateAvailabilityRuleInput
): Promise<any> => {
  // Validate time format
  if (!/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Invalid time format. Use HH:MM');
  }

  // Validate day of week
  if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Day of week must be between 0 (Sunday) and 6 (Saturday)');
  }

  const result = await query(
    `INSERT INTO expert_availability_rules 
     (expert_id, day_of_week, start_time, end_time, slot_duration_minutes, timezone, active)
     VALUES ($1, $2, $3::time, $4::time, $5, $6, TRUE)
     ON CONFLICT (expert_id, day_of_week, start_time, end_time)
     DO UPDATE SET 
       slot_duration_minutes = EXCLUDED.slot_duration_minutes,
       timezone = EXCLUDED.timezone,
       active = TRUE,
       updated_at = NOW()
     RETURNING *`,
    [
      input.expertId,
      input.dayOfWeek,
      input.startTime,
      input.endTime,
      input.slotDurationMinutes ?? 30,
      input.timezone
    ]
  );

  return result.rows[0];
};

/**
 * Batch update weekly availability (replaces all rules)
 */
export const setWeeklyAvailability = async (
  expertId: string,
  rules: Omit<CreateAvailabilityRuleInput, 'expertId'>[]
): Promise<any[]> => {
  try {
    return await transaction(async (client) => {
      // Deactivate all existing rules
      await client.query(
        'UPDATE expert_availability_rules SET active = FALSE WHERE expert_id = $1',
        [expertId]
      );

      // Insert new rules
      const insertedRules = [];
      for (const rule of rules) {
        const result = await client.query(
          `INSERT INTO expert_availability_rules 
           (expert_id, day_of_week, start_time, end_time, slot_duration_minutes, timezone, active)
           VALUES ($1, $2, $3::time, $4::time, $5, $6, TRUE)
           RETURNING *`,
          [
            expertId,
            rule.dayOfWeek,
            rule.startTime,
            rule.endTime,
            rule.slotDurationMinutes ?? 30,
            rule.timezone
          ]
        );
        insertedRules.push(result.rows[0]);
      }

      return insertedRules;
    });
  } catch (error: any) {
    console.error('Error in setWeeklyAvailability:', error);
    throw new ApiError(500, 'SERVER_ERROR', `Failed to update availability: ${error.message}`);
  }
};

/**
 * Get expert's weekly availability schedule
 */
export const getWeeklyAvailability = async (expertId: string): Promise<any[]> => {
  const result = await query(
    `SELECT * FROM expert_availability_rules
     WHERE expert_id = $1 AND active = TRUE
     ORDER BY day_of_week, start_time`,
    [expertId]
  );

  return result.rows;
};

/**
 * Delete availability rule
 */
export const deleteAvailabilityRule = async (ruleId: string, expertId: string): Promise<void> => {
  const result = await query(
    'UPDATE expert_availability_rules SET active = FALSE WHERE id = $1 AND expert_id = $2',
    [ruleId, expertId]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Availability rule not found');
  }
};

/**
 * Create availability override (vacation, special slot, etc.)
 */
export const createAvailabilityOverride = async (
  input: CreateAvailabilityOverrideInput
): Promise<any> => {
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.overrideDate)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Invalid date format. Use YYYY-MM-DD');
  }

  // Validate override type
  if (input.overrideType === 'available' && (!input.startTime || !input.endTime)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Available override requires start and end time');
  }

  const result = await query(
    `INSERT INTO expert_availability_overrides 
     (expert_id, override_date, override_type, start_time, end_time, timezone, reason)
     VALUES ($1, $2::date, $3, $4::time, $5::time, $6, $7)
     RETURNING *`,
    [
      input.expertId,
      input.overrideDate,
      input.overrideType,
      input.startTime ?? null,
      input.endTime ?? null,
      input.timezone,
      input.reason ?? null
    ]
  );

  return result.rows[0];
};

/**
 * Get expert's overrides for a date range
 */
export const getAvailabilityOverrides = async (
  expertId: string,
  startDate: string,
  endDate: string
): Promise<any[]> => {
  const result = await query(
    `SELECT * FROM expert_availability_overrides
     WHERE expert_id = $1
     AND override_date >= $2::date
     AND override_date <= $3::date
     ORDER BY override_date, start_time`,
    [expertId, startDate, endDate]
  );

  return result.rows;
};

/**
 * Delete availability override
 */
export const deleteAvailabilityOverride = async (
  overrideId: string,
  expertId: string
): Promise<void> => {
  const result = await query(
    'DELETE FROM expert_availability_overrides WHERE id = $1 AND expert_id = $2',
    [overrideId, expertId]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Availability override not found');
  }
};

/**
 * Block date range (vacation mode)
 */
export const blockDateRange = async (
  expertId: string,
  startDate: string,
  endDate: string,
  timezone: string,
  reason?: string
): Promise<any[]> => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const overrides = [];

  // Iterate through each day in the range
  const currentDate = new Date(start);
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    try {
      const override = await createAvailabilityOverride({
        expertId,
        overrideDate: dateStr,
        overrideType: 'blocked',
        timezone,
        reason: reason ?? 'Vacation'
      });
      overrides.push(override);
    } catch (error) {
      // Skip if already exists (duplicate constraint)
      console.warn(`Override for ${dateStr} already exists, skipping`);
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return overrides;
};

/**
 * Get expert's availability summary (for dashboard)
 */
export const getAvailabilitySummary = async (expertId: string): Promise<{
  hasWeeklySchedule: boolean;
  totalWeeklyHours: number;
  upcomingBlockedDates: string[];
  calendarConnected: boolean;
}> => {
  // Check weekly schedule
  const rulesResult = await query(
    `SELECT 
      COUNT(*) as rule_count,
      SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
     FROM expert_availability_rules
     WHERE expert_id = $1 AND active = TRUE`,
    [expertId]
  );

  // Get upcoming blocked dates (next 30 days)
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const blockedResult = await query(
    `SELECT DISTINCT override_date
     FROM expert_availability_overrides
     WHERE expert_id = $1
     AND override_type = 'blocked'
     AND start_time IS NULL
     AND override_date >= $2::date
     AND override_date <= $3::date
     ORDER BY override_date`,
    [expertId, today, futureDate]
  );

  // Check calendar connection
  const calendarResult = await query(
    'SELECT id FROM expert_calendar_connections WHERE expert_id = $1 AND sync_enabled = TRUE LIMIT 1',
    [expertId]
  );

  return {
    hasWeeklySchedule: Number(rulesResult.rows[0]?.rule_count ?? 0) > 0,
    totalWeeklyHours: Number(rulesResult.rows[0]?.total_hours ?? 0),
    upcomingBlockedDates: blockedResult.rows.map((row) => row.override_date),
    calendarConnected: calendarResult.rows.length > 0
  };
};
