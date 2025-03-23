
/**
 * Application configuration settings
 */

// API base URLs - Use the current origin as default with fallback to localhost
export const API_BASE_URL = window.location.protocol === 'https:' 
  ? `${window.location.origin}`  // Use current origin in production
  : "http://localhost:8000";  // Use localhost in development

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
  
  // Health check endpoint (used to verify server status)
  HEALTH_CHECK: `${API_BASE_URL}/health/`,
};
