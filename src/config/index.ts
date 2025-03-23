
/**
 * Application configuration settings
 */

// API base URLs
export const API_BASE_URL = "http://localhost:8000";
export const WEBSOCKET_BASE_URL = "ws://localhost:8000";

// API endpoints
export const ENDPOINTS = {
  // Auth endpoints
  REGISTER: `${API_BASE_URL}/users/register/`,
  LOGIN: `${API_BASE_URL}/users/login/`,
  VERIFY_OTP: `${API_BASE_URL}/users/verify_otp/`,
  
  // Session endpoints
  CREATE_AUDIO_SESSION: `${API_BASE_URL}/api/letta/audio_streaming_session/`,
  END_AUDIO_SESSION: (sessionId: string) => `${API_BASE_URL}/letta/end_audio_session/${sessionId}/`,
  
  // WebSocket endpoint for bidirectional audio streaming
  AUDIO_WEBSOCKET: (userId: string, sessionId: string) => 
    `${WEBSOCKET_BASE_URL}/ws/audio_streaming/receive/?user_id=${userId}&session_id=${sessionId}`,
  
  // Legacy endpoints (deprecated)
  SEND_AUDIO_CHUNK: `${API_BASE_URL}/letta/audio_streaming/send/`,
  RECEIVE_AUDIO_STREAM: `${API_BASE_URL}/letta/audio_streaming/receive/`,
  
  // Chat endpoint
  TEXT_CHAT: `${API_BASE_URL}/letta/chat/`,
};
