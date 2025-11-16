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

export { normalizeRequestedName };
