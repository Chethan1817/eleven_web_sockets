
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
  CREATE_AUDIO_SESSION: `${API_BASE_URL}/letta/audio_streaming_session/`,
  END_AUDIO_SESSION: (sessionId: string) => `${API_BASE_URL}/letta/end_audio_session/${sessionId}/`,
  
  // WebSocket endpoints
  AUDIO_WEBSOCKET: (phoneNumber: string) => `${WEBSOCKET_BASE_URL}/ws/audio/${phoneNumber}/`,
};
