
/**
 * Application configuration settings
 */

// API base URLs - Use the current origin as default with fallback to localhost
export const API_BASE_URL = window.location.protocol === 'https:' 
  ? `${window.location.origin}`  // Use current origin in production
  : "http://localhost:8000";  // Use localhost in development

// Ensure WebSocket protocol matches HTTP protocol (ws for http, wss for https)
export const WEBSOCKET_BASE_URL = window.location.protocol === 'https:'
  ? `wss://${window.location.host}`    // Use WSS for secure connections
  : "ws://localhost:8000";    // Use WS for non-secure connections

// Add debug flag to enable additional logging
export const DEBUG_MODE = true;

// Define connection timeouts
export const CONNECTION_TIMEOUT_MS = 30000; // 30 seconds

// API endpoints
export const ENDPOINTS = {
  // Auth endpoints
  REGISTER: `${API_BASE_URL}/users/register/`,
  LOGIN: `${API_BASE_URL}/users/login/`,
  VERIFY_OTP: `${API_BASE_URL}/users/verify_otp/`,
  
  // Session endpoints - no "api/" prefix
  CREATE_AUDIO_SESSION: `${API_BASE_URL}/letta/audio_streaming_session/`,
  END_AUDIO_SESSION: (sessionId: string) => `${API_BASE_URL}/letta/end_audio_session/${sessionId}/`,
  
  // WebSocket endpoint for bidirectional audio streaming
  AUDIO_WEBSOCKET: (userId: string, sessionId: string) => 
    `${WEBSOCKET_BASE_URL}/ws/audio_streaming/receive/?user_id=${userId}&session_id=${sessionId}`,
  
  // HTTP streaming endpoints
  CREATE_HTTP_SESSION: `${API_BASE_URL}/letta/audio_http_session/`,
  AUDIO_HTTP_STREAM: (userId: string, sessionId: string) => 
    `${API_BASE_URL}/letta/audio_stream/?user_id=${userId}&session_id=${sessionId}`,
  AUDIO_HTTP_INPUT: (userId: string, sessionId: string) => 
    `${API_BASE_URL}/letta/audio_input/?user_id=${userId}&session_id=${sessionId}`,
  CLOSE_HTTP_SESSION: `${API_BASE_URL}/letta/close_session/`,
  
  // Health check endpoint (used to verify server status)
  HEALTH_CHECK: `${API_BASE_URL}/health/`,
};
