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
  const audioQueueRef = useRef<{url: string, id: string, blob: Blob}[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
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
  
  const clearAudioQueue = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.src = '';
    }
    isPlayingRef.current = false;
    audioQueueRef.current = [];
  }, []);
  
  const playNextInQueue = useCallback(() => {
    if (audioQueueRef.current.length > 0 && !isPlayingRef.current && audioPlayerRef.current) {
      const next = audioQueueRef.current.shift();
      if (next) {
        console.log("Playing next audio in queue:", next.id);
        isPlayingRef.current = true;
        
        try {
          // Create a new object URL each time to avoid caching issues
          URL.revokeObjectURL(next.url);
          const newUrl = URL.createObjectURL(next.blob);
          
          audioPlayerRef.current.src = newUrl;
          
          audioPlayerRef.current.play()
            .then(() => {
              console.log("Audio playback started successfully");
            })
            .catch(error => {
              console.error("Error playing audio:", error);
              isPlayingRef.current = false;
              // Try next audio after delay
              setTimeout(playNextInQueue, 100);
            });
        } catch (err) {
          console.error("Exception in audio playback:", err);
          isPlayingRef.current = false;
          setTimeout(playNextInQueue, 100);
        }
      }
    }
  }, []);
  
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
        const contentType = event.data.type || 'audio/mpeg';
        console.log(`📥 RECEIVED FROM SERVER (binary): ${audioSize} bytes, type: ${contentType}`);
        
        // Extract Content-Type from the blob if possible, or use a default
        // Some browsers may handle audio/mpeg better than audio/webm
        const blobWithType = new Blob([event.data], { type: contentType });
        
        const audioUrl = URL.createObjectURL(blobWithType);
        const responseId = `audio-${Date.now()}`;
        
        const newResponse: Response = {
          id: responseId,
          text: `Audio response received (${audioSize} bytes, format: ${contentType})`,
          audio_url: audioUrl,
          type: "main",
          timestamp: Date.now(),
        };
        
        setResponses(prev => [...prev, newResponse]);
        
        // Store the blob in the queue for better memory management
        audioQueueRef.current.push({
          url: audioUrl, 
          id: responseId,
          blob: blobWithType
        });
        
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
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
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
