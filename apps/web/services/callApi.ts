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
    let rawText = '';
    
    try {
      // Read as text first to preserve the body
      rawText = await response.text();
      console.log('[fetchWithAuth] Raw error response:', rawText);
      
      // Try to parse as JSON
      error = JSON.parse(rawText);
      console.log('[fetchWithAuth] Parsed error:', error);
    } catch (parseError) {
      console.log('[fetchWithAuth] JSON parse failed, using raw text');
      // If JSON parsing fails, use the raw text
      error = { 
        message: rawText || response.statusText || 'Request failed',
        statusCode: response.status 
      };
    }
    
    // Handle nested error format: {success: false, error: {code, message}}
    const actualError = error.error || error;
    const errorCode = actualError.code;
    const errorMessage = actualError.message || response.statusText || `HTTP ${response.status}`;
    
    // Suppress expected 400 errors for call operations (race conditions)
    const isCallOperationError = url.includes('/decline') || url.includes('/end');
    const is400Error = response.status === 400;
    const isAlreadyEndedError = errorMessage?.includes('declined') || 
                                errorMessage?.includes('ended') || 
                                errorCode === 'INVALID_REQUEST';
    
    if (isCallOperationError && is400Error && isAlreadyEndedError) {
      const err: any = new Error('Call already ended');
      err.status = 400;
      err.data = actualError;
      throw err;
    }
    
    // Log unexpected errors with full details
    console.error('[API Error] Full details:', { 
      url, 
      status: response.status, 
      statusText: response.statusText,
      errorCode,
      errorMessage,
      errorDetails: actualError.details,
      rawResponse: rawText.substring(0, 1000),
      fullError: error
    });
    
    throw {
      status: response.status,
      message: errorMessage,
      code: errorCode,
      details: actualError.details,
      ...actualError,
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
