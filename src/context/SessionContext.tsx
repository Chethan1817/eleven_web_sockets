import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "./AuthContext";
import { ENDPOINTS, DEBUG_MODE } from "@/config";

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
  raw_data?: any;
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
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  clearSession: () => void;
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
  
  const websocketRef = useRef<WebSocket | null>(null);
  const websocketReadyRef = useRef<boolean>(false);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sessionActiveRef = useRef<boolean>(false);
  const isManuallyStoppingRef = useRef<boolean>(false);
  const hasOpenedRef = useRef<boolean>(false);
  
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data === 'string') {
      console.log("📥 RECEIVED FROM SERVER (text data):", event.data.substring(0, 100) + (event.data.length > 100 ? '...' : ''));
      
      try {
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
      } catch (err) {
        console.warn("Failed to parse WebSocket text message as JSON:", err);
        console.log("Raw message content:", event.data);
      }
    } else if (event.data instanceof Blob) {
      console.log(`📥 RECEIVED FROM SERVER (binary): ${event.data.size} bytes of audio`);
      
      const audio = new Audio(URL.createObjectURL(event.data));
      audio.play();
    }
  }, []);
  
  const createWebSocketConnection = useCallback((userId: string, sessionId: string) => {
    const wsUrl = ENDPOINTS.AUDIO_WEBSOCKET(userId, sessionId);
    console.log(`Creating WebSocket connection to: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    websocketReadyRef.current = false;
    hasOpenedRef.current = false;
    
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
      console.log("✅ WebSocket connection opened successfully", { readyState: ws.readyState });
      clearTimeout(connectionTimeoutId);
      
      websocketReadyRef.current = true;
      hasOpenedRef.current = true;
      
      setIsConnecting(false);
      setIsSessionActive(true);
      
      try {
        ws.send(JSON.stringify({ 
          type: "connection_status", 
          status: "client_connected",
          client_info: {
            user_id: userId,
            session_id: sessionId,
            timestamp: Date.now()
          }
        }));
        console.log("Sent connection confirmation to server");
      } catch (err) {
        console.error("Error sending connection confirmation:", err);
      }
      
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
      console.error("❌ WebSocket connection error:", error);
      
      toast({
        title: "Connection Error",
        description: "Failed to establish WebSocket connection.",
        variant: "destructive"
      });
    };
    
    ws.onclose = (event) => {
      console.log(`🔌 WebSocket connection closed: Code ${event.code}`, {
        reason: event.reason,
        wasClean: event.wasClean,
        hasOpened: hasOpenedRef.current
      });
      
      clearTimeout(connectionTimeoutId);
      
      if ((ws as any).pingInterval) {
        clearInterval((ws as any).pingInterval);
        (ws as any).pingInterval = null;
      }
      
      websocketReadyRef.current = false;
      
      if (!hasOpenedRef.current && !isManuallyStoppingRef.current) {
        console.warn("❗ WebSocket closed before connection was established");
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
  }, [handleWebSocketMessage, toast, isSessionActive]);
  
  const stopSession = useCallback(async (): Promise<void> => {
    if (!sessionActiveRef.current && !isSessionActive) {
      console.log("No active session to stop");
      return;
    }
    
    console.log("Stopping session...");
    
    isManuallyStoppingRef.current = true;
    
    sessionActiveRef.current = false;
    setIsSessionActive(false);
    setIsRecording(false);
    setIsProcessing(false);
    
    if (websocketRef.current) {
      const ws = websocketRef.current;
      
      if ((ws as any).pingInterval) {
        clearInterval((ws as any).pingInterval);
        (ws as any).pingInterval = null;
      }
      
      if (ws.readyState === WebSocket.CONNECTING) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            console.log("Closing WebSocket after delay (was in CONNECTING state)");
            ws.close();
          }
        }, 500);
      } else if (websocketReadyRef.current && ws.readyState === WebSocket.OPEN) {
        console.log("Closing open WebSocket connection");
        ws.close();
      } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        console.log(`WebSocket is already in ${ws.readyState === WebSocket.CLOSED ? 'CLOSED' : 'CLOSING'} state`);
      }
      
      websocketRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (sessionId && user) {
      try {
        const userIdString = String(user.id);
        
        await fetch(ENDPOINTS.CLOSE_AUDIO_SESSION, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify({ 
            user_id: userIdString,
            session_id: sessionId
          })
        });
      } catch (error) {
        console.error("Error ending session on server:", error);
      }
    }
    
    setSessionId(null);
    
    setTimeout(() => {
      isManuallyStoppingRef.current = false;
    }, 100);
  }, [sessionId, user, accessToken, isSessionActive]);
  
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
      const userIdString = String(user.id);
      
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
      const newSessionId = data.session_id;
      setSessionId(newSessionId);
      
      const ws = createWebSocketConnection(userIdString, newSessionId);
      websocketRef.current = ws;
      
      toast({
        title: "Session Started",
        description: "WebSocket connection established successfully.",
        variant: "default"
      });
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
  }, [user, accessToken, stopSession, toast, createWebSocketConnection, isSessionActive]);
  
  const startRecording = useCallback(async () => {
    if (!isSessionActive) {
      console.log("Cannot start recording: No active session");
      return;
    }
    
    if (isRecording) {
      console.log("Already recording");
      return;
    }
    
    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      console.error("Cannot start recording: WebSocket is not in OPEN state", 
        websocketRef.current ? `Current state: ${websocketRef.current.readyState}` : "WebSocket not initialized");
      
      toast({
        title: "Connection Issue",
        description: "Cannot start recording as the WebSocket connection is not ready. Please try restarting the session.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsRecording(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && 
            websocketRef.current && 
            websocketRef.current.readyState === WebSocket.OPEN) {
          console.log(`Sending audio chunk (${event.data.size} bytes) to WebSocket`);
          websocketRef.current.send(event.data);
        } else {
          if (!websocketRef.current) {
            console.warn("Cannot send audio: WebSocket is not initialized");
          } else if (websocketRef.current.readyState !== WebSocket.OPEN) {
            console.warn(`Cannot send audio: WebSocket is not open (state: ${websocketRef.current.readyState})`);
          } else if (event.data.size <= 0) {
            console.log("Empty audio chunk received - no data to send");
          }
        }
      };
      
      recorder.onstop = () => {
        setIsRecording(false);
        setIsProcessing(false);
      };
      
      mediaRecorderRef.current = recorder;
      
      console.log(`Starting MediaRecorder with WebSocket in state: ${websocketRef.current.readyState}`, {
        CONNECTING: WebSocket.CONNECTING,
        OPEN: WebSocket.OPEN,
        CLOSING: WebSocket.CLOSING,
        CLOSED: WebSocket.CLOSED,
      });
      
      recorder.start(100);
      console.log("Recording started successfully - speak now");
      
      toast({
        title: "Recording Started",
        description: "Speak now. Your audio is being sent to the server.",
        variant: "default"
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
      
      toast({
        title: "Recording Failed",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  }, [isSessionActive, isRecording, toast]);
  
  const stopRecording = useCallback(() => {
    setIsProcessing(true);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setIsRecording(false);
    
    toast({
      title: "Recording Stopped",
      description: "Audio recording has been stopped.",
      variant: "default"
    });
  }, [toast]);
  
  const clearSession = useCallback(() => {
    stopSession();
    setTranscripts([]);
    setResponses([]);
  }, [stopSession]);
  
  useEffect(() => {
    const initialSync = () => {
      sessionActiveRef.current = isSessionActive;
    };
    
    initialSync();
  }, []);
  
  useEffect(() => {
    return () => {
      if (!isManuallyStoppingRef.current) {
        console.log("Component unmounting, but waiting briefly before stopping session...");
        
        setTimeout(() => {
          const ws = websocketRef.current;

          if (ws?.readyState === WebSocket.CONNECTING) {
            console.warn("Skipping stopSession: WebSocket still connecting during unmount");
            // No longer manually close the WebSocket if it's still connecting
            // Let it either connect successfully or time out naturally
          } else {
            console.log("Safe to stop session after delay");
            stopSession();
          }
        }, 250);
      }
    };
  }, [stopSession]);
  
  useEffect(() => {
    if (sessionActiveRef.current !== isSessionActive && !isManuallyStoppingRef.current) {
      sessionActiveRef.current = isSessionActive;
    }
  }, [isSessionActive]);
  
  const getWebSocketStateText = () => {
    if (!websocketRef.current) return 'Not Connected';
    
    switch (websocketRef.current.readyState) {
      case WebSocket.CONNECTING: return 'Connecting (0)';
      case WebSocket.OPEN: return 'Open (1)';
      case WebSocket.CLOSING: return 'Closing (2)';
      case WebSocket.CLOSED: return 'Closed (3)';
      default: return 'Unknown';
    }
  };
  
  const contextValue: SessionContextType = {
    isSessionActive,
    isRecording,
    isConnecting,
    isProcessing,
    transcripts,
    responses,
    sessionId,
    websocket: websocketRef.current,
    startSession,
    stopSession,
    startRecording,
    stopRecording,
    clearSession,
  };
  
  return (
    <SessionContext.Provider value={contextValue}>
      {children}
      {DEBUG_MODE && (
        <div className="fixed bottom-2 right-2 text-xs text-muted-foreground border border-border rounded px-2 py-1 bg-background/80">
          WebSocket: {getWebSocketStateText()}
        </div>
      )}
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
