import { query } from '../db/postgres.js';
import { RequestedPerson, RequestedPersonStatus } from '../types/index.js';
import { ApiError } from '../errors/ApiError.js';
import { normalizeRequestedName } from '../utils/name.js';

interface LogRequestedPersonInput {
  requestedName: string;
  searchQuery: string;
  userId: string;
}

export const logRequestedPersonInterest = async (input: LogRequestedPersonInput): Promise<RequestedPerson> => {
  const normalizedName = normalizeRequestedName(input.requestedName);
  if (!normalizedName) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Requested name is required.');
  }

  const upsert = await query<RequestedPerson>(
    `INSERT INTO requested_people (name, normalized_name, request_count, status, last_requested_at, created_at)
     VALUES ($1, $2, 1, 'pending', NOW(), NOW())
     ON CONFLICT (normalized_name)
     DO UPDATE SET request_count = requested_people.request_count + 1,
                   last_requested_at = NOW()
     RETURNING *`,
    [input.requestedName.trim(), normalizedName]
  );

  await query(
    `INSERT INTO request_logs (user_id, requested_name, search_query, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [input.userId, input.requestedName.trim(), input.searchQuery]
  );

  return upsert.rows[0];
};

export const listRequestedPeople = async (status?: RequestedPersonStatus): Promise<RequestedPerson[]> => {
  if (status) {
    const result = await query<RequestedPerson>(
      `SELECT * FROM requested_people
       WHERE status = $1
       ORDER BY request_count DESC, last_requested_at DESC`,
      [status]
    );
    return result.rows;
  }

  const result = await query<RequestedPerson>(
    `SELECT * FROM requested_people
     ORDER BY request_count DESC, last_requested_at DESC`
  );
  return result.rows;
};

export const updateRequestedPersonStatus = async (
  normalizedName: string,
  status: RequestedPersonStatus
): Promise<RequestedPerson> => {
  const cleaned = normalizeRequestedName(normalizedName);
  const result = await query<RequestedPerson>(
    `UPDATE requested_people
     SET status = $2
     WHERE normalized_name = $1
     RETURNING *`,
    [cleaned, status]
  );

  if (!result.rows[0]) {
    throw new ApiError(404, 'NOT_FOUND', 'Requested person not found');
  }

  return result.rows[0];
};

export const findRequestedPerson = async (normalizedName: string): Promise<RequestedPerson | null> => {
  const cleaned = normalizeRequestedName(normalizedName);
  const result = await query<RequestedPerson>('SELECT * FROM requested_people WHERE normalized_name = $1', [cleaned]);
  return result.rows[0] ?? null;
};

export interface SkillRequest {
  id: string;
  user_id: string | null;
  skills_description: string;
  search_query: string | null;
  request_count: number;
  status: string;
  last_requested_at: string;
  created_at: string;
  updated_at: string;
}

interface LogSkillRequestInput {
  skillsDescription: string;
  searchQuery: string;
  userId: string;
}

export const logSkillRequest = async (input: LogSkillRequestInput): Promise<SkillRequest> => {
  const skillsDescription = input.skillsDescription.trim();
  if (!skillsDescription || skillsDescription.length < 3) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Skills description is required and must be at least 3 characters.');
  }

  // Normalize the skills description (lowercase, remove extra spaces) for deduplication
  const normalized = skillsDescription.toLowerCase().replace(/\s+/g, ' ').trim();

  // Try to find existing similar skill request (exact match on normalized description)
  const existing = await query<SkillRequest>(
    `SELECT * FROM skill_requests 
     WHERE LOWER(TRIM(REPLACE(skills_description, E'\\s+', ' '))) = $1
     ORDER BY last_requested_at DESC
     LIMIT 1`,
    [normalized]
  );

  if (existing.rows.length > 0) {
    // Update existing request
    const updated = await query<SkillRequest>(
      `UPDATE skill_requests
       SET request_count = request_count + 1,
           last_requested_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [existing.rows[0].id]
    );
    return updated.rows[0];
  }

  // Create new skill request
  const insert = await query<SkillRequest>(
    `INSERT INTO skill_requests (user_id, skills_description, search_query, request_count, status, last_requested_at, created_at)
     VALUES ($1, $2, $3, 1, 'pending', NOW(), NOW())
     RETURNING *`,
    [input.userId, skillsDescription, input.searchQuery || null]
  );

  return insert.rows[0];
};

export { normalizeRequestedName };
