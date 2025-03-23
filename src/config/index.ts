
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
  CREATE_AUDIO_SESSION: `${API_BASE_URL}/api/letta/audio_streaming_session`,
  END_AUDIO_SESSION: (sessionId: string) => `${API_BASE_URL}/api/letta/end_audio_session/${sessionId}/`,
  
  // Audio streaming endpoints
  SEND_AUDIO_CHUNK: `${API_BASE_URL}/api/letta/audio_streaming/send`,
  
  // Chat endpoint
  TEXT_CHAT: `${API_BASE_URL}/api/letta/chat`,
};
