import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "./AuthContext";
import { ENDPOINTS } from "@/config";
import { playAudio, isMP3Format } from "@/utils/audioUtils";
import { 
  createHttpSession, 
  startHttpStreaming, 
  closeHttpSession, 
  HttpAudioRecorder 
} from "@/utils/httpStreamingUtils";

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
  streamController: AbortController | null;
  greeting: string | null;
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  clearSession: () => void;
  interruptResponse: () => void;
  useHttpStreaming: boolean;
  setUseHttpStreaming: (useHttp: boolean) => void;
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
  const [useHttpStreaming, setUseHttpStreaming] = useState<boolean>(true);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const streamControllerRef = useRef<AbortController | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const httpRecorderRef = useRef<HttpAudioRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioQueueRef = useRef<{blob: Blob, id: string, format: "mp3" | "pcm" | "auto"}[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const sessionActiveRef = useRef<boolean>(false);
  const isManuallyStoppingRef = useRef<boolean>(false);
  
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
            setTimeout(playNextInQueue, 100);
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
    if (typeof event.data === 'string') {
      console.log("📥 RECEIVED FROM SERVER (text data):", event.data.substring(0, 100) + (event.data.length > 100 ? '...' : ''));
      
      try {
        const data = JSON.parse(event.data);
        console.log("📥 PARSED JSON DATA:", data);
        
        if (data.type === "connection_status" && data.status === "connected") {
          console.log("Connection confirmed by server");
          setIsConnecting(false);
          setIsSessionActive(true);
        }
        
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
      } catch (err) {
        console.warn("Failed to parse WebSocket text message as JSON:", err);
        console.log("Raw message content:", event.data);
      }
    } else if (event.data instanceof Blob) {
      const audioSize = event.data.size;
      
      console.log(`📥 RECEIVED FROM SERVER (binary): ${audioSize} bytes of audio`);
      
      const isMp3 = await isMP3Format(event.data);
      const audioFormat = isMp3 ? "mp3" : "pcm";
      const audioMimeType = isMp3 ? "audio/mpeg" : "audio/pcm";
      
      console.log(`Audio format detected: ${audioFormat.toUpperCase()}`);
      
      const audioBlob = new Blob([event.data], { type: audioMimeType });
      const audioId = `audio-${Date.now()}`;
      
      audioQueueRef.current.push({
        blob: audioBlob,
        id: audioId,
        format: audioFormat
      });
      
      playNextInQueue();
    }
  }, [playNextInQueue]);
  
  const createWebSocketConnection = useCallback((userId: string, sessionId: string) => {
    const wsUrl = ENDPOINTS.AUDIO_WEBSOCKET(userId, sessionId);
    console.log(`Creating WebSocket connection to: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    const connectionTimeoutId = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.warn("WebSocket connection timeout after 30 seconds");
        ws.close();
        setIsConnecting(false);
        toast({
          title: "Connection Timeout",
          description: "The WebSocket connection timed out. Please try again.",
          variant: "destructive"
        });
      }
    }, 30000);
    
    ws.onopen = () => {
      console.log("WebSocket connection opened successfully", { readyState: ws.readyState });
      clearTimeout(connectionTimeoutId);
      
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: "ping" }));
            console.log("Ping sent to keep WebSocket connection alive");
          } catch (err) {
            console.error("Error sending ping:", err);
          }
        } else {
          clearInterval(pingInterval);
          console.log("Clearing ping interval, WebSocket is no longer open");
        }
      }, 30000);
      
      (ws as any).pingInterval = pingInterval;
    };
    
    ws.onmessage = handleWebSocketMessage;
    
    ws.onerror = (error) => {
      console.error("WebSocket connection error:", error);
      console.log("Error details:", {
        type: error.type,
        target: error.target,
        eventPhase: error.eventPhase,
        bubbles: error.bubbles,
        cancelable: error.cancelable,
        composed: error.composed,
        timeStamp: error.timeStamp,
        defaultPrevented: error.defaultPrevented,
        isTrusted: error.isTrusted,
        currentTarget: error.currentTarget
      });
      
      toast({
        title: "Connection Error",
        description: "Failed to establish WebSocket connection. Trying alternative method...",
        variant: "destructive"
      });
      
      if (!useHttpStreaming) {
        setUseHttpStreaming(true);
        toast({
          title: "Switching to HTTP Streaming",
          description: "Using more compatible streaming method",
          variant: "default"
        });
      }
    };
    
    ws.onclose = (event) => {
      console.log(`WebSocket connection closed: Code ${event.code}`, {
        reason: event.reason,
        wasClean: event.wasClean
      });
      
      clearTimeout(connectionTimeoutId);
      
      if ((ws as any).pingInterval) {
        clearInterval((ws as any).pingInterval);
      }
      
      if (event.code === 1006) {
        console.log("Abnormal closure. This might be due to network issues or server problems.");
        
        if (isSessionActive) {
          toast({
            title: "Connection Lost",
            description: "The connection was lost unexpectedly. Please try again.",
            variant: "destructive"
          });
          
          setIsSessionActive(false);
          setIsConnecting(false);
          setIsRecording(false);
          setIsProcessing(false);
        }
      }
    };
    
    return ws;
  }, [handleWebSocketMessage, toast, isSessionActive, useHttpStreaming, setUseHttpStreaming]);
  
  const stopSession = useCallback(async (): Promise<void> => {
    if (!sessionActiveRef.current && !isSessionActive) {
      console.log("No active session to stop");
      return;
    }
    
    console.log("Stopping session...", new Error().stack);
    
    isManuallyStoppingRef.current = true;
    
    sessionActiveRef.current = false;
    setIsSessionActive(false);
    setIsRecording(false);
    setIsProcessing(false);
    
    clearAudioQueue();
    
    if (httpRecorderRef.current) {
      httpRecorderRef.current.stop();
      httpRecorderRef.current = null;
    }
    
    if (streamControllerRef.current) {
      console.log("Aborting HTTP stream controller");
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
    }
    
    if (websocketRef.current) {
      if ((websocketRef.current as any).pingInterval) {
        clearInterval((websocketRef.current as any).pingInterval);
      }
      
      if (websocketRef.current.readyState === WebSocket.OPEN || 
          websocketRef.current.readyState === WebSocket.CONNECTING) {
        websocketRef.current.close();
      }
      websocketRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    audioSourceRef.current = null;
    
    if (sessionId && user) {
      try {
        const userIdString = String(user.id);
        
        if (useHttpStreaming) {
          await closeHttpSession(userIdString, sessionId);
        } else {
          await fetch(ENDPOINTS.END_AUDIO_SESSION(sessionId), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {})
            },
            body: JSON.stringify({ user_id: userIdString })
          });
        }
      } catch (error) {
        console.error("Error ending session on server:", error);
      }
    }
    
    setSessionId(null);
    
    setTimeout(() => {
      isManuallyStoppingRef.current = false;
    }, 100);
  }, [sessionId, user, accessToken, clearAudioQueue, useHttpStreaming, isSessionActive]);
  
  const startSession = useCallback(async (): Promise<void> => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to start a session.",
        variant: "destructive"
      });
      return;
    }
    
    isManuallyStoppingRef.current = true;
    
    if (isSessionActive || sessionActiveRef.current) {
      console.log("Closing existing session before starting a new one");
      await stopSession();
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    isManuallyStoppingRef.current = false;
    
    setIsConnecting(true);
    sessionActiveRef.current = true;
    
    try {
      console.log("Starting new session...");
      let newSessionId;
      const userIdString = String(user.id);
      
      if (useHttpStreaming) {
        newSessionId = await createHttpSession(userIdString, user.name);
        console.log(`Got new session ID: ${newSessionId}`);
        setSessionId(newSessionId);
        
        const controller = startHttpStreaming(
          userIdString,
          newSessionId,
          (text: string, isFinal: boolean) => {
            console.log(`Received transcript: "${text}", isFinal: ${isFinal}`);
            setTranscripts(prev => [...prev, {
              id: `trans-${Date.now()}`,
              text: text || "",
              is_final: isFinal || false,
              timestamp: Date.now()
            }]);
          },
          (text: string, audioData?: ArrayBuffer) => {
            console.log(`Received response: "${text.substring(0, 50)}..."`);
            setResponses(prev => [...prev, {
              id: `resp-${Date.now()}`,
              text: text || "",
              type: "main",
              timestamp: Date.now()
            }]);
          },
          (status: string, message?: string) => {
            console.log(`Connection status update: ${status} - ${message || ""}`);
            
            if (status === "connected") {
              console.log("Session connected successfully");
              setIsConnecting(false);
              setIsSessionActive(true);
              sessionActiveRef.current = true;
              
              toast({
                title: "Connection Established",
                description: "HTTP streaming connection is active.",
                variant: "default"
              });
              
              // IMPORTANT: Mark session as active immediately after setup
              setIsSessionActive(true);
            } else if (status === "disconnected" || status === "error") {
              console.log(`Session ${status}: ${message}`);
              if (sessionActiveRef.current && !isManuallyStoppingRef.current) {
                setIsConnecting(false);
                setIsSessionActive(false);
                sessionActiveRef.current = false;
                
                toast({
                  title: `Connection ${status === "error" ? "Error" : "Closed"}`,
                  description: message || `The streaming connection was ${status}.`,
                  variant: status === "error" ? "destructive" : "default"
                });
              }
            }
          }
        );
        
        streamControllerRef.current = controller;
        
        console.log("HTTP streaming setup complete, context state:", {
          sessionId: newSessionId,
          isConnecting: true,
          isSessionActive: sessionActiveRef.current,
          hasStreamController: !!controller
        });
      } else {
        const response = await fetch(ENDPOINTS.CREATE_AUDIO_SESSION, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify({ user_id: userIdString })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        newSessionId = data.session_id;
        setSessionId(newSessionId);
        
        const ws = createWebSocketConnection(userIdString, newSessionId);
        websocketRef.current = ws;
      }
    } catch (error) {
      console.error("Failed to start session:", error);
      setIsConnecting(false);
      setIsSessionActive(false);
      sessionActiveRef.current = false;
      
      toast({
        title: "Session Start Failed",
        description: `Could not start session: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive"
      });
    }
  }, [user, accessToken, stopSession, toast, createWebSocketConnection, useHttpStreaming, isSessionActive]);
  
  const startRecording = useCallback(async () => {
    if (!isSessionActive) {
      console.log("Cannot start recording: No active session");
      return;
    }
    
    if (isRecording) {
      console.log("Already recording");
      return;
    }
    
    try {
      setIsRecording(true);
      
      if (useHttpStreaming) {
        if (!httpRecorderRef.current && user && sessionId) {
          const userIdString = String(user.id);
          httpRecorderRef.current = new HttpAudioRecorder(userIdString, sessionId);
        }
        
        if (httpRecorderRef.current) {
          await httpRecorderRef.current.start();
          console.log("HTTP streaming recorder started");
        }
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        const source = audioContext.createMediaStreamSource(stream);
        audioSourceRef.current = source;
        
        const recorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        });
        
        audioChunksRef.current = [];
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        recorder.onstop = async () => {
          setIsRecording(false);
          setIsProcessing(true);
          
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          
          if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
            console.log(`Sending recorded audio (${audioBlob.size} bytes) to WebSocket`);
            websocketRef.current.send(audioBlob);
          } else {
            console.error("WebSocket not open, cannot send audio");
            setIsProcessing(false);
          }
          
          audioChunksRef.current = [];
        };
        
        mediaRecorderRef.current = recorder;
        
        recorder.start();
      }
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
      
      toast({
        title: "Recording Failed",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  }, [isSessionActive, isRecording, sessionId, user, toast, useHttpStreaming]);
  
  const stopRecording = useCallback(() => {
    setIsProcessing(true);
    
    if (useHttpStreaming) {
      if (httpRecorderRef.current) {
        httpRecorderRef.current.stop();
        console.log("HTTP streaming recorder stopped");
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    }
    
    setIsRecording(false);
  }, [useHttpStreaming]);
  
  const clearSession = useCallback(() => {
    stopSession();
    setTranscripts([]);
    setResponses([]);
    setGreeting(null);
  }, [stopSession]);
  
  const interruptResponse = useCallback(() => {
    setIsProcessing(false);
    clearAudioQueue();
    
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ type: "interrupt" }));
    }
  }, [clearAudioQueue]);
  
  useEffect(() => {
    const initialSync = () => {
      sessionActiveRef.current = isSessionActive;
      console.log("Initial session state sync:", { isSessionActive, sessionActiveRef: sessionActiveRef.current });
    };
    
    initialSync();
  }, []);
  
  useEffect(() => {
    return () => {
      if (!isManuallyStoppingRef.current) {
        console.log("Component unmounting, stopping session if not manual:", { 
          isManuallyStoppingRef: isManuallyStoppingRef.current
        });
        stopSession();
      } else {
        console.log("Component unmounting, manual stop in progress - not calling stopSession again");
      }
    };
  }, [stopSession]);
  
  useEffect(() => {
    if (sessionActiveRef.current !== isSessionActive && !isManuallyStoppingRef.current) {
      console.log(`Updating sessionActiveRef from ${sessionActiveRef.current} to ${isSessionActive}`);
      sessionActiveRef.current = isSessionActive;
    }
  }, [isSessionActive]);
  
  const contextValue: SessionContextType = {
    isSessionActive,
    isRecording,
    isConnecting,
    isProcessing,
    transcripts,
    responses,
    sessionId,
    websocket: websocketRef.current,
    streamController: streamControllerRef.current,
    greeting,
    startSession,
    stopSession,
    startRecording,
    stopRecording,
    clearSession,
    interruptResponse,
    useHttpStreaming,
    setUseHttpStreaming,
  };
  
  console.log("SessionContext provider rendering with:", {
    isSessionActive,
    isConnecting,
    hasStreamController: !!streamControllerRef.current,
    sessionId,
    manuallyStoppingRef: isManuallyStoppingRef.current
  });
  
  return (
    <SessionContext.Provider value={contextValue}>
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
