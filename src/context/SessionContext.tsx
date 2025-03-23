
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "./AuthContext";
import { ENDPOINTS } from "@/config";

interface Transcript {
  id: string;
  text: string;
  is_final: boolean;
  timestamp: number;
}

interface Response {
  id: string;
  text: string;
  audio_url?: string;
  type: "quick" | "main";
  timestamp: number;
  raw_data?: any; // Adding raw data for debugging
}

interface SessionContextType {
  isSessionActive: boolean;
  isRecording: boolean;
  isConnecting: boolean;
  isProcessing: boolean;
  transcripts: Transcript[];
  responses: Response[];
  sessionId: string | null;
  websocket: WebSocket | null;
  greeting: string | null;
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  clearSession: () => void;
  interruptResponse: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, accessToken } = useAuth();
  const { toast } = useToast();
  
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [greeting, setGreeting] = useState<string | null>(null);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioQueueRef = useRef<{url: string, id: string, blob: Blob, format: string}[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  // Create audio player on component mount
  useEffect(() => {
    const audioPlayer = new Audio();
    
    audioPlayer.addEventListener('ended', () => {
      console.log("Audio playback ended");
      isPlayingRef.current = false;
      playNextInQueue();
    });
    
    audioPlayer.addEventListener('error', (e) => {
      // Log the full error details
      const target = e.target as HTMLAudioElement;
      const errorCode = target.error ? target.error.code : 'unknown';
      const errorMessage = target.error ? target.error.message : 'unknown';
      
      console.error("Audio player error:", {
        event: e,
        errorCode,
        errorMessage,
        currentSrc: target.currentSrc
      });
      
      isPlayingRef.current = false;
      playNextInQueue();
    });
    
    audioPlayerRef.current = audioPlayer;
    
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = '';
      }
    };
  }, []);
  
  // Function to clear the audio queue and stop current playback
  const clearAudioQueue = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.src = '';
    }
    
    // Clean up blob URLs to avoid memory leaks
    audioQueueRef.current.forEach(item => {
      try {
        URL.revokeObjectURL(item.url);
      } catch (err) {
        console.error("Error revoking URL:", err);
      }
    });
    
    isPlayingRef.current = false;
    audioQueueRef.current = [];
  }, []);
  
  // Try to play audio with different formats if one fails
  const tryPlayAudio = useCallback(async (blob: Blob, id: string): Promise<boolean> => {
    if (!audioPlayerRef.current) return false;
    
    // Try different audio formats
    const formatsToTry = [
      { type: 'audio/mpeg', ext: 'mp3' },
      { type: 'audio/wav', ext: 'wav' },
      { type: 'audio/webm', ext: 'webm' },
      { type: 'audio/aac', ext: 'aac' },
      { type: 'audio/ogg', ext: 'ogg' },
    ];
    
    // Try the original blob first
    try {
      const originalUrl = URL.createObjectURL(blob);
      audioPlayerRef.current.src = originalUrl;
      await audioPlayerRef.current.play();
      console.log(`Successfully playing audio ${id} with original format: ${blob.type}`);
      return true;
    } catch (err) {
      console.log(`Failed to play with original format ${blob.type}, trying other formats...`);
      URL.revokeObjectURL(audioPlayerRef.current.src);
    }
    
    // Try with different MIME types
    for (const format of formatsToTry) {
      if (blob.type === format.type) continue; // Skip if same as original
      
      try {
        const newBlob = new Blob([blob], { type: format.type });
        const url = URL.createObjectURL(newBlob);
        audioPlayerRef.current.src = url;
        
        console.log(`Attempting to play audio ${id} with format: ${format.type}`);
        await audioPlayerRef.current.play();
        console.log(`Successfully playing audio ${id} with format: ${format.type}`);
        return true;
      } catch (err) {
        console.log(`Failed to play audio ${id} with format: ${format.type}:`, err);
        URL.revokeObjectURL(audioPlayerRef.current.src);
      }
    }
    
    console.error(`All playback attempts failed for audio ${id}`);
    return false;
  }, []);
  
  const playNextInQueue = useCallback(() => {
    if (audioQueueRef.current.length > 0 && !isPlayingRef.current && audioPlayerRef.current) {
      const next = audioQueueRef.current.shift();
      if (next) {
        console.log(`Playing next audio in queue: ${next.id} (format: ${next.format})`);
        isPlayingRef.current = true;
        
        try {
          // Try to play with format transformation
          tryPlayAudio(next.blob, next.id)
            .then(success => {
              if (!success) {
                console.error(`Failed to play audio ${next.id} after trying all formats`);
                isPlayingRef.current = false;
                // Try next audio after delay
                setTimeout(playNextInQueue, 100);
              }
            })
            .catch(error => {
              console.error(`Error in audio playback process for ${next.id}:`, error);
              isPlayingRef.current = false;
              setTimeout(playNextInQueue, 100);
            });
        } catch (err) {
          console.error("Exception in audio playback:", err);
          isPlayingRef.current = false;
          setTimeout(playNextInQueue, 100);
        }
      }
    }
  }, [tryPlayAudio]);
  
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      if (typeof event.data === 'string') {
        const data = JSON.parse(event.data);
        console.log("📥 RECEIVED FROM SERVER (text):", data);
        
        if (data.text) {
          const newResponse: Response = {
            id: `resp-${Date.now()}`,
            text: data.text,
            type: data.type || "main",
            timestamp: Date.now(),
            raw_data: data
          };
          
          setResponses(prev => [...prev, newResponse]);
        }
        
        if (data.transcript) {
          const newTranscript: Transcript = {
            id: `trans-${Date.now()}`,
            text: data.transcript,
            is_final: data.is_final || false,
            timestamp: Date.now(),
          };
          
          setTranscripts(prev => [...prev, newTranscript]);
        }
      }
      else if (event.data instanceof Blob) {
        const audioSize = event.data.size;
        const originalContentType = event.data.type || 'audio/mpeg';
        console.log(`📥 RECEIVED FROM SERVER (binary): ${audioSize} bytes, type: ${originalContentType}`);
        
        // Store the original blob
        const originalBlob = new Blob([event.data], { type: originalContentType });
        const audioId = `audio-${Date.now()}`;
        const audioUrl = URL.createObjectURL(originalBlob);
        
        // Create and add response
        const newResponse: Response = {
          id: audioId,
          text: `Audio response received (${audioSize} bytes, format: ${originalContentType})`,
          audio_url: audioUrl,
          type: "main",
          timestamp: Date.now(),
          raw_data: { size: audioSize, type: originalContentType }
        };
        
        setResponses(prev => [...prev, newResponse]);
        
        // Add audio to play queue
        audioQueueRef.current.push({
          url: audioUrl, 
          id: audioId,
          blob: originalBlob,
          format: originalContentType
        });
        
        // Try playing if not already playing
        if (!isPlayingRef.current) {
          playNextInQueue();
        }
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  }, [playNextInQueue]);
  
  const startSession = async () => {
    if (!accessToken) {
      toast({
        title: "Authentication Required",
        description: "Please log in to start a session.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsConnecting(true);
      console.log("Starting new session with API URL:", ENDPOINTS.CREATE_AUDIO_SESSION);
      
      const userId = user?.id ? String(user.id) : "";
      const requestBody = { 
        user_id: userId,
        user_name: user?.name 
      };
      
      console.log("📤 SENDING TO SERVER (create session):", requestBody);
      
      const response = await fetch(ENDPOINTS.CREATE_AUDIO_SESSION, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create audio session");
      }
      
      const data = await response.json();
      console.log("📥 RECEIVED FROM SERVER (session creation):", data);
      
      if (!data.session_id) {
        throw new Error("No session ID returned from server");
      }
      
      setSessionId(data.session_id);
      
      const wsUrl = data.websocket_url || ENDPOINTS.AUDIO_WEBSOCKET(userId, data.session_id);
      console.log("Connecting to WebSocket URL:", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("📡 WebSocket connection established");
        setIsSessionActive(true);
        setIsConnecting(false);
        
        const userName = user?.name || "there";
        setGreeting(`Hello ${userName}, how are you doing today?`);
        
        const greetingResponse: Response = {
          id: `greeting-${Date.now()}`,
          text: `Hello ${userName}, how are you doing today?`,
          type: "main",
          timestamp: Date.now(),
        };
        
        setResponses(prev => [...prev, greetingResponse]);
        
        toast({
          title: "Session Started",
          description: "Audio streaming session is now active.",
        });
      };
      
      ws.onmessage = handleWebSocketMessage;
      
      ws.onerror = (error) => {
        console.error("📡 WebSocket error:", error);
        toast({
          title: "Connection Error",
          description: "Error with audio streaming connection.",
          variant: "destructive",
        });
      };
      
      ws.onclose = () => {
        console.log("📡 WebSocket connection closed");
        if (isSessionActive) {
          setIsSessionActive(false);
          
          toast({
            title: "Connection Closed",
            description: "Audio streaming session has ended.",
          });
        }
      };
      
      websocketRef.current = ws;
      
    } catch (error) {
      setIsConnecting(false);
      const errorMessage = error instanceof Error ? error.message : "Failed to start session";
      console.error("Session start error:", errorMessage);
      toast({
        title: "Session Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };
  
  const stopSession = async () => {
    if (!sessionId) return;
    
    try {
      if (isRecording) {
        stopRecording();
      }
      
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      
      // Clean up audio resources
      clearAudioQueue();
      
      if (accessToken) {
        try {
          const endpointUrl = ENDPOINTS.END_AUDIO_SESSION(sessionId);
          console.log("📤 SENDING TO SERVER (end session):", { session_id: sessionId });
          
          await fetch(endpointUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          });
        } catch (endError) {
          console.error("Error ending session via API:", endError);
        }
      }
      
      setIsSessionActive(false);
      setSessionId(null);
      
      toast({
        title: "Session Ended",
        description: "Audio streaming session has been terminated.",
      });
      
    } catch (error) {
      console.error("Error stopping session:", error);
      toast({
        title: "Error",
        description: "Failed to properly end the session.",
        variant: "destructive",
      });
    }
  };
  
  const startRecording = useCallback(async () => {
    if (!isSessionActive || isRecording || !websocketRef.current) return;
    
    try {
      console.log("Attempting to access microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microphone access granted");
      audioStreamRef.current = stream;
      
      // Try to get the most compatible audio format
      let mimeType = 'audio/webm;codecs=opus';
      
      // Check supported mime types for better compatibility
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg'
      ];
      
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log(`Using supported MIME type for recording: ${mimeType}`);
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      });
      
      console.log(`Created MediaRecorder with MIME type: ${mimeType}`);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
          console.log(`📤 SENDING TO SERVER (audio): ${event.data.size} bytes, type: ${event.data.type}`);
          websocketRef.current.send(event.data);
        } else {
          console.log("Cannot send audio:", {
            dataSize: event.data.size,
            wsExists: !!websocketRef.current,
            wsState: websocketRef.current?.readyState
          });
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log("Media recorder stopped");
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      };
      
      mediaRecorder.start(250);
      setIsRecording(true);
      
      console.log("Recording started successfully");
      
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Recording Error",
        description: "Could not access microphone. Please check your browser permissions.",
        variant: "destructive",
      });
    }
  }, [isSessionActive, isRecording, toast]);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      console.log("Stopping recording...");
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log("Recording stopped");
    }
  }, [isRecording]);
  
  const interruptResponse = useCallback(() => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      const interruptCommand = { command: "interrupt" };
      console.log("📤 SENDING TO SERVER (command):", interruptCommand);
      websocketRef.current.send(JSON.stringify(interruptCommand));
      
      clearAudioQueue();
    }
  }, [clearAudioQueue]);
  
  const clearSession = useCallback(() => {
    if (transcripts.length > 0) {
      setTranscripts([]);
    }
    if (responses.length > 0) {
      setResponses([]);
    }
    if (sessionId !== null) {
      setSessionId(null);
    }
    if (greeting !== null) {
      setGreeting(null);
    }
  }, [transcripts.length, responses.length, sessionId, greeting]);
  
  return (
    <SessionContext.Provider
      value={{
        isSessionActive,
        isRecording,
        isConnecting,
        isProcessing,
        transcripts,
        responses,
        sessionId,
        websocket: websocketRef.current,
        greeting,
        startSession,
        stopSession,
        startRecording,
        stopRecording,
        clearSession,
        interruptResponse,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};
