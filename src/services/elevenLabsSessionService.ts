/**
 * ElevenLabsSessionService
 * 
 * Service to handle ElevenLabs session management including:
 * - Storing session IDs
 * - Retrieving session history
 * - Fetching conversation transcripts from ElevenLabs API
 */

// Use environment variables directly
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Store an ElevenLabs session ID in the database
 * 
 * @param sessionId - The ElevenLabs session ID to store
 * @returns Promise with the response data or empty object on error
 */
export const storeElevenLabsSessionId = async (sessionId: string) => {
  try {
    // Get user ID from localStorage
    const userId = localStorage.getItem("id");
    
    if (!userId) {
      console.warn("User ID not found in localStorage");
      return {};
    }
    
    // Use the same endpoint structure as your existing code
    const token = localStorage.getItem("sara_token");
    const response = await fetch(`${BASE_URL}/sessions/store_session/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token ? `Bearer ${token}` : ""
      },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId
      })
    });
    
    if (!response.ok) {
      console.warn(`Failed to store session ID. Status: ${response.status}`);
      return {};
    }
    
    const data = await response.json();
    console.log("Successfully stored ElevenLabs session:", sessionId);
    return data;
  } catch (error) {
    console.error("Error storing ElevenLabs session ID:", error);
    return {};
  }
};

/**
 * Get ElevenLabs session history from the database
 * 
 * @returns Promise with the session history or empty array on error
 */
export const getElevenLabsSessionHistory = async () => {
  try {
    // Use the same endpoint structure as your existing code
    const token = localStorage.getItem("sara_token");
    const userId = localStorage.getItem("id");
    
    if (!token || !userId) {
      console.warn("Missing authentication or user information");
      return [];
    }
    
    const response = await fetch(`${BASE_URL}/sessions/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch session history. Status: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching ElevenLabs session history:", error);
    return [];
  }
};

/**
 * Fetch conversation transcript from ElevenLabs API
 * 
 * @param sessionId - ElevenLabs session ID
 * @returns Promise with the conversation transcript or empty object on error
 */
export const getElevenLabsConversationTranscript = async (sessionId: string) => {
  try {
    // Get the API key from your environment variables or backend
    // You should consider fetching this securely from your backend instead
    const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || 
                           localStorage.getItem("elevenlabs_api_key") || 
                           "";
    
    if (!ELEVENLABS_API_KEY) {
      console.warn("ElevenLabs API key not found");
      return { transcript: [] };
    }
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${sessionId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );
    
    if (!response.ok) {
      console.warn(`Failed to fetch conversation transcript. Status: ${response.status}`);
      return { transcript: [] };
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching ElevenLabs conversation transcript:", error);
    return { transcript: [] };
  }
};

/**
 * Get a signed URL from ElevenLabs API via the backend
 * 
 * @returns Promise with the signed URL or empty string on error
 */
export const getElevenLabsSignedUrl = async () => {
  try {
    const response = await fetch(`/api/signed-url`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get signed URL. Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.signedUrl) {
      throw new Error('No signed URL in response');
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL from ElevenLabs:', error);
    throw error;
  }
};