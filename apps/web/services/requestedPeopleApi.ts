const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type RequestedPersonStatus = 'pending' | 'contacted' | 'declined' | 'onboarded';

export interface RequestedPerson {
  name: string;
  normalized_name: string;
  request_count: number;
  status: RequestedPersonStatus;
  last_requested_at: string;
  created_at: string;
}

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || 'Request failed');
  }
  return response.json();
};

export const fetchRequestedPeople = async (status?: RequestedPersonStatus): Promise<RequestedPerson[]> => {
  const url = new URL('/api/requested-people', API_BASE_URL);
  if (status) {
    url.searchParams.set('status', status);
  }
  const payload = await handleResponse(
    await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include'
    })
  );
  return payload.people ?? [];
};

export const updateRequestedPerson = async (normalizedName: string, status: RequestedPersonStatus): Promise<RequestedPerson> => {
  const payload = await handleResponse(
    await fetch(`${API_BASE_URL}/api/requested-people/${normalizedName}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
  );
  return payload.person;
};
