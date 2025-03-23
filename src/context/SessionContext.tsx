
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "./AuthContext";
import { ENDPOINTS } from "@/config";
import { playAudio, isMP3Format } from "@/utils/audioUtils";

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
  const audioQueueRef = useRef<{blob: Blob, id: string, format: "mp3" | "pcm" | "auto"}[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  
  const clearAudioQueue = useCallback(() => {
    isPlayingRef.current = false;
    audioQueueRef.current = [];
  }, []);
  
  const playNextInQueue = useCallback(async () => {
    if (audioQueueRef.current.length > 0 && !isPlayingRef.current) {
      const next = audioQueueRef.current.shift();
      if (next) {
        console.log(`Playing next audio in queue: ${next.id} (format: ${next.format})`);
        isPlayingRef.current = true;
        
        try {
          const success = await playAudio(next.blob, next.id, {
            sampleRate: 16000,
            channels: 1,
            format: next.format
          });
          
          if (success) {
            let durationMs: number;
            
            if (next.format === "mp3") {
              durationMs = 10000; // 10 seconds max
            } else {
              durationMs = (next.blob.size / 32) + 500; // Add buffer
            }
            
            setTimeout(() => {
              isPlayingRef.current = false;
              playNextInQueue();
            }, durationMs);
          } else {
            console.error(`Failed to play audio ${next.id}`);
            isPlayingRef.current = false;
            setTimeout(playNextInQueue, 100); // Try next audio after delay
          }
        } catch (err) {
          console.error("Exception in audio playback:", err);
          isPlayingRef.current = false;
          setTimeout(playNextInQueue, 100);
        }
      }
    }
  }, []);
  
  const handleWebSocketMessage = useCallback(async (event: MessageEvent) => {
    try {
      if (typeof event.data === 'string') {
        console.log("📥 RECEIVED FROM SERVER (text data):", event.data.substring(0, 100) + (event.data.length > 100 ? '...' : ''));
        const data = JSON.parse(event.data);
        console.log("📥 PARSED JSON DATA:", data);
        
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
        
        console.log(`📥 RECEIVED FROM SERVER (binary): ${audioSize} bytes of audio`);
        
        const isMp3 = await isMP3Format(event.data);
        const audioFormat = isMp3 ? "mp3" : "pcm";
        const audioMimeType = isMp3 ? "audio/mpeg" : "audio/pcm";
        
        console.log(`Audio format detected: ${audioFormat.toUpperCase()}`);
        
        const audioBlob = new Blob([event.data], { type: audioMimeType });
        const audioId = `audio-${Date.now()}`;
        
        const placeholderUrl = URL.createObjectURL(audioBlob);
        
        const newResponse: Response = {
          id: audioId,
          text: `Audio response received (${audioSize} bytes, ${audioFormat.toUpperCase()} format)`,
          audio_url: placeholderUrl,
          type: "main",
          timestamp: Date.now(),
          raw_data: { 
            size: audioSize, 
            type: audioMimeType,
            format: audioFormat.toUpperCase() 
          }
        };
        
        setResponses(prev => [...prev, newResponse]);
        
        audioQueueRef.current.push({
          blob: audioBlob, 
          id: audioId,
          format: audioFormat
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
      
      if (websocketRef.current && websocketRef.current.readyState !== WebSocket.CLOSED) {
        console.log("Closing existing WebSocket connection");
        websocketRef.current.close();
      }
      
      const ws = new WebSocket(wsUrl);
      console.log("WebSocket object created with readyState:", ws.readyState, 
        ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][ws.readyState]);
      
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error("WebSocket connection timeout");
          ws.close();
          setIsConnecting(false);
          toast({
            title: "Connection Timeout",
            description: "Failed to establish WebSocket connection. Please try again.",
            variant: "destructive",
          });
        }
      }, 10000); // 10 seconds timeout
      
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log("📡 WebSocket connection established");
        setIsSessionActive(true);
        setIsConnecting(false);
        
        // Send an initial ping to test the connection
        try {
          ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
          console.log("📤 SENT PING TO SERVER");
        } catch (err) {
          console.error("Error sending initial ping:", err);
        }
        
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
        clearTimeout(connectionTimeout);
        console.error("📡 WebSocket error:", error);
        setIsConnecting(false);
        
        toast({
          title: "Connection Error",
          description: "Error with audio streaming connection.",
          variant: "destructive",
        });
      };
      
      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`📡 WebSocket connection closed: Code ${event.code}${event.reason ? `, Reason: ${event.reason}` : ''}`);
        
        if (isSessionActive) {
          setIsSessionActive(false);
          
          toast({
            title: "Connection Closed",
            description: "Audio streaming session has ended.",
          });
        } else if (isConnecting) {
          setIsConnecting(false);
          
          toast({
            title: "Connection Failed",
            description: "Could not establish connection to the audio server.",
            variant: "destructive",
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
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
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
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      });
      
      console.log(`Created MediaRecorder with MIME type: ${mimeType}`);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          console.log(`Recording data available: ${event.data.size} bytes, type: ${event.data.type}`);
          audioChunksRef.current.push(event.data);
          
          if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
            console.log(`📤 SENDING TO SERVER (audio): ${event.data.size} bytes, type: ${event.data.type}`);
            websocketRef.current.send(event.data);
            console.log(`Audio data sent to server`);
          } else {
            console.error("Cannot send audio:", {
              dataSize: event.data.size,
              wsExists: !!websocketRef.current,
              wsState: websocketRef.current?.readyState,
              wsStateDesc: websocketRef.current ? 
                ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][websocketRef.current.readyState] : "NO_WEBSOCKET"
            });
          }
        } else {
          console.log("Recording data available but size is 0");
        }
      };
      
      mediaRecorder.onstart = () => {
        console.log("MediaRecorder started");
        setIsRecording(true);
      };
      
      mediaRecorder.onstop = () => {
        console.log("MediaRecorder stopped");
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      };
      
      mediaRecorder.onerror = (error) => {
        console.error("MediaRecorder error:", error);
      };
      
      mediaRecorder.start(100);
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
