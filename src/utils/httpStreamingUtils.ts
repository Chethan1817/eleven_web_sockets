
/**
 * Utility functions for HTTP streaming audio communication
 */

import { toast } from "@/components/ui/use-toast";
import { ENDPOINTS } from "@/config";
import { playAudio, isMP3Format } from "@/utils/audioUtils";

interface StreamMessage {
  type: string;
  [key: string]: any;
}

/**
 * Creates a new HTTP streaming session
 */
export async function createHttpSession(userId: string, userName?: string) {
  try {
    console.log("Creating HTTP streaming session...");
    
    const response = await fetch(ENDPOINTS.CREATE_HTTP_SESSION, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        user_id: userId,
        user_name: userName
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error creating HTTP session:", errorText);
      throw new Error(`Failed to create session: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log("HTTP session created:", data);
    
    if (!data.session_id) {
      throw new Error("No session ID returned from server");
    }
    
    return data.session_id;
  } catch (error) {
    console.error("Error in createHttpSession:", error);
    throw error;
  }
}

/**
 * Starts streaming from the server and processes messages
 */
export function startHttpStreaming(
  userId: string, 
  sessionId: string,
  onTranscript: (text: string, isFinal: boolean) => void,
  onResponse: (text: string, audioData?: ArrayBuffer) => void,
  onConnectionStatus: (status: string, message?: string) => void
): AbortController {
  console.log(`Starting HTTP streaming for session ${sessionId}...`);
  
  // Create AbortController for cleanup
  const controller = new AbortController();
  const streamUrl = ENDPOINTS.AUDIO_HTTP_STREAM(userId, sessionId);
  
  console.log("Connecting to stream URL:", streamUrl);
  
  // Inform that we're attempting to connect
  onConnectionStatus("connecting", "Establishing HTTP stream connection");
  
  fetch(streamUrl, { 
    signal: controller.signal,
    headers: {
      "Accept": "text/event-stream,application/octet-stream,application/json",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    },
    // Important: Prevent the browser from caching the response
    cache: "no-store"
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(errorText => {
        console.error(`HTTP stream error: ${response.status} ${response.statusText}`, errorText);
        onConnectionStatus("error", `Connection error: ${response.status} ${response.statusText}`);
        throw new Error(`Stream error: ${response.status} ${errorText}`);
      });
    }
    
    if (!response.body) {
      console.error("ReadableStream not supported in this browser");
      onConnectionStatus("error", "Your browser doesn't support streaming");
      throw new Error("ReadableStream not supported");
    }
    
    onConnectionStatus("connected", "HTTP stream connected");
    console.log("HTTP stream connected successfully");
    
    // Get a reader to consume the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    // This function actively consumes the stream to prevent auto-abortion
    async function readStream() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log("Stream complete");
            onConnectionStatus("disconnected", "Stream ended");
            break;
          }
          
          // Process the received chunk
          const chunk = decoder.decode(value, { stream: true });
          console.log(`Received chunk: ${chunk.length} bytes`);
          buffer += chunk;
          
          // Process complete messages
          const { processed, remainder } = processBuffer(buffer);
          buffer = remainder;
          
          // Handle each message
          processed.forEach(message => {
            handleStreamMessage(
              message, 
              onTranscript, 
              onResponse, 
              onConnectionStatus
            );
          });
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log("HTTP stream aborted by user");
          onConnectionStatus("disconnected", "Connection closed by user");
        } else {
          console.error("Error reading from stream:", error);
          onConnectionStatus("error", `Stream error: ${error.message}`);
        }
      }
    }
    
    // Start consuming the stream immediately to prevent browser auto-abortion
    readStream();
  })
  .catch(error => {
    // Only log non-abort errors (abort is expected during cleanup)
    if (error.name !== 'AbortError') {
      console.error("HTTP stream connection error:", error);
      onConnectionStatus("error", `Connection error: ${error.message}`);
    }
  });
  
  return controller;
}

/**
 * Process the buffer and extract complete messages
 */
function processBuffer(buffer: string): { 
  processed: StreamMessage[], 
  remainder: string 
} {
  const processed: StreamMessage[] = [];
  let remainder = buffer;
  
  while (remainder.includes('\n')) {
    const newlinePos = remainder.indexOf('\n');
    const message = remainder.substring(0, newlinePos);
    
    if (message.trim().length > 0) {
      try {
        // Try to parse as JSON
        const msgObj = JSON.parse(message);
        
        if (msgObj.type === 'audio' && msgObj.data) {
          // This is audio data that our backend has already extracted
          const audioData = new Uint8Array(msgObj.data);
          processed.push({
            type: 'audio',
            data: audioData.buffer
          });
        } else {
          // Regular JSON message
          processed.push(msgObj);
        }
      } catch (e) {
        console.error('Error parsing message:', e, message);
      }
    }
    
    remainder = remainder.substring(newlinePos + 1);
  }
  
  return { processed, remainder };
}

/**
 * Handle different types of stream messages
 */
async function handleStreamMessage(
  message: StreamMessage,
  onTranscript: (text: string, isFinal: boolean) => void,
  onResponse: (text: string, audioData?: ArrayBuffer) => void,
  onConnectionStatus: (status: string, message?: string) => void
) {
  console.log(`Received ${message.type} message:`, message);
  
  switch (message.type) {
    case 'audio':
      if (message.data) {
        // Play the audio
        const audioData = message.data as ArrayBuffer;
        const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
        
        try {
          const isMp3 = await isMP3Format(audioBlob);
          const format = isMp3 ? "mp3" : "pcm";
          const audioId = `audio-${Date.now()}`;
          
          console.log(`Playing ${format.toUpperCase()} audio from stream`);
          playAudio(audioBlob, audioId, {
            sampleRate: 16000,
            channels: 1,
            format: format
          });
          
          // If there's response text with this audio, call the response handler
          if (message.text) {
            onResponse(message.text, audioData);
          }
        } catch (err) {
          console.error("Failed to play audio from stream:", err);
        }
      }
      break;
      
    case 'transcript':
      if (message.text) {
        onTranscript(message.text, message.is_final || false);
      }
      break;
      
    case 'response':
    case 'text':
      if (message.text) {
        onResponse(message.text);
      }
      break;
      
    case 'user_transcript':
      if (message.text) {
        onTranscript(message.text, message.is_final || false);
      }
      break;
      
    case 'connection_status':
      onConnectionStatus(message.status, message.message);
      break;
      
    default:
      console.log('Unknown message type:', message.type);
  }
}

/**
 * Send audio data to the server
 */
export async function sendHttpAudio(userId: string, sessionId: string, audioBlob: Blob) {
  try {
    const url = ENDPOINTS.AUDIO_HTTP_INPUT(userId, sessionId);
    console.log(`Sending audio to ${url}, size: ${audioBlob.size} bytes`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': audioBlob.type || 'audio/webm',
        'Accept': 'application/json'
      },
      body: audioBlob,
    });
    
    if (!response.ok) {
      console.error(`Error sending audio: ${response.status} ${response.statusText}`);
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to send audio: ${response.status}`);
      } catch (e) {
        throw new Error(`Failed to send audio: ${response.status}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error sending audio:', error);
    return false;
  }
}

/**
 * Close the HTTP streaming session
 */
export async function closeHttpSession(userId: string, sessionId: string) {
  try {
    console.log(`Closing HTTP session ${sessionId}...`);
    
    const response = await fetch(ENDPOINTS.CLOSE_HTTP_SESSION, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ 
        user_id: userId, 
        session_id: sessionId 
      }),
    });
    
    if (!response.ok) {
      console.error(`Error closing session: ${response.status}`);
    } else {
      console.log("HTTP session closed successfully");
    }
    
    return response.ok;
  } catch (error) {
    console.error('Error closing HTTP session:', error);
    return false;
  }
}

/**
 * HTTP Streaming Audio Recorder class
 */
export class HttpAudioRecorder {
  private userId: string;
  private sessionId: string;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording: boolean = false;
  private chunkInterval: number;
  
  constructor(userId: string, sessionId: string, chunkInterval: number = 200) {
    this.userId = userId;
    this.sessionId = sessionId;
    this.chunkInterval = chunkInterval;
  }
  
  async start() {
    if (this.isRecording) return;
    
    try {
      console.log("Starting HTTP audio recorder...");
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Find supported MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg'
      ];
      
      let mimeType = 'audio/webm;codecs=opus';
      
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log(`Using supported MIME type for recording: ${mimeType}`);
          break;
        }
      }
      
      // Create MediaRecorder with appropriate settings
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000 // 128 kbps
      });
      
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          console.log(`Recording data available: ${event.data.size} bytes`);
          // Send chunk to server
          await sendHttpAudio(this.userId, this.sessionId, event.data);
        }
      };
      
      // Record in small chunks for responsive conversation
      this.mediaRecorder.start(this.chunkInterval);
      this.isRecording = true;
      
      console.log(`HTTP audio recorder started with ${this.chunkInterval}ms chunks`);
    } catch (error) {
      console.error('Error starting HTTP recording:', error);
      toast({
        title: "Recording Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
      throw error;
    }
  }
  
  stop() {
    if (!this.isRecording) return;
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.isRecording = false;
    console.log('HTTP audio recording stopped');
  }
  
  isActive() {
    return this.isRecording;
  }
}
