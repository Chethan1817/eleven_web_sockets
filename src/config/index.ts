
/**
 * Application configuration settings
 */

// API base URLs - handle both HTTP and HTTPS protocols
export const API_BASE_URL = window.location.protocol === 'https:' 
  ? "https://localhost:8000"  // Use HTTPS in production
  : "http://localhost:8000";  // Use HTTP in development

// Ensure WebSocket protocol matches HTTP protocol (ws for http, wss for https)
export const WEBSOCKET_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

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
  
  // Chat endpoint
  TEXT_CHAT: `${API_BASE_URL}/letta/chat/`,
};
