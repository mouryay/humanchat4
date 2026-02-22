/**
 * Call API service
 * REST API client for call endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface StartCallRequest {
  conversationId: string;
  callType: 'video' | 'audio';
  idempotencyKey?: string;
}

interface StartCallResponse {
  callId: string;
  status: string;
  liveKitToken: string;
  roomName: string;
  participants: {
    caller: {
      userId: string;
      name: string;
      avatar?: string;
    };
    callee: {
      userId: string;
      name: string;
      avatar?: string;
    };
  };
  initiatedAt: string;
}

interface AcceptCallResponse {
  callId: string;
  status: string;
  liveKitToken: string;
  roomName: string;
  acceptedAt: string;
}

/**
 * Fetch with credentials (cookies)
 */
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let error;
    
    try {
      error = await response.json();
    } catch (parseError) {
      const rawText = await response.text().catch(() => 'Unknown error');
      error = { message: rawText || 'Request failed' };
    }
    
    // Suppress expected 400 errors for call operations (race conditions)
    const isCallOperationError = url.includes('/decline') || url.includes('/end');
    const is400Error = response.status === 400;
    const isAlreadyEndedError = error.message?.includes('declined') || 
                                error.message?.includes('ended') || 
                                error.code === 'INVALID_REQUEST';
    
    if (isCallOperationError && is400Error && isAlreadyEndedError) {
      const err: any = new Error('Call already ended');
      err.status = 400;
      err.data = error;
      throw err;
    }
    
    // Log unexpected errors
    console.error('[API Error]', { url, status: response.status, message: error.message });
    
    throw {
      status: response.status,
      message: error.message || `HTTP ${response.status}`,
      ...error,
    };
  }

  return response.json();
}

/**
 * Start a new call
 */
export async function startCall(request: StartCallRequest): Promise<StartCallResponse> {
  return fetchWithAuth(`${API_BASE_URL}/api/calls/start`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Accept an incoming call
 */
export async function acceptCall(callId: string): Promise<AcceptCallResponse> {
  return fetchWithAuth(`${API_BASE_URL}/api/calls/${callId}/accept`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Decline an incoming call
 */
export async function declineCall(
  callId: string,
  reason: 'busy' | 'declined' | 'other' = 'declined'
): Promise<void> {
  return fetchWithAuth(`${API_BASE_URL}/api/calls/${callId}/decline`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * End an active call
 */
export async function endCall(
  callId: string,
  endReason: 'normal' | 'timeout' | 'error' = 'normal'
): Promise<void> {
  return fetchWithAuth(`${API_BASE_URL}/api/calls/${callId}/end`, {
    method: 'POST',
    body: JSON.stringify({ endReason }),
  });
}

/**
 * Mark call as connected (when both parties join)
 */
export async function markCallConnected(callId: string): Promise<void> {
  return fetchWithAuth(`${API_BASE_URL}/api/calls/${callId}/connected`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Get call details
 */
export async function getCall(callId: string): Promise<any> {
  return fetchWithAuth(`${API_BASE_URL}/api/calls/${callId}`);
}
