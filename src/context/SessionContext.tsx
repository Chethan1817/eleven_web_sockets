
import React, { createContext, useContext, useState, useRef, useCallback } from "react";
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
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
      
      const response = await fetch(ENDPOINTS.CREATE_AUDIO_SESSION, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: user?.phone_number }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create audio session");
      }
      
      const data = await response.json();
      console.log("Session created response:", data);
      setSessionId(data.session_id);
      
      // Use the websocket_url from the response instead of constructing it
      const wsUrl = data.websocket_url || ENDPOINTS.AUDIO_WEBSOCKET(user?.phone_number || "");
      console.log("Connecting to WebSocket URL:", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("WebSocket connection established");
        setIsSessionActive(true);
        setIsConnecting(false);
        
        // Set the greeting message with the user's name
        const userName = user?.name || "there";
        setGreeting(`Hello ${userName}, how are you doing today?`);
        
        // Add the greeting as a response
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
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "transcript") {
            const newTranscript: Transcript = {
              id: data.id || `transcript-${Date.now()}`,
              text: data.text,
              is_final: data.is_final || false,
              timestamp: Date.now(),
            };
            
            setTranscripts(prev => {
              const filteredTranscripts = prev.filter(t => 
                !(t.id === newTranscript.id && !t.is_final)
              );
              return [...filteredTranscripts, newTranscript];
            });
            
            setIsProcessing(true);
          } else if (data.type === "response") {
            const newResponse: Response = {
              id: data.id || `response-${Date.now()}`,
              text: data.text,
              audio_url: data.audio_url,
              type: data.response_type || "main",
              timestamp: Date.now(),
            };
            
            setResponses(prev => [...prev, newResponse]);
            setIsProcessing(false);
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnecting(false);
        toast({
          title: "Connection Error",
          description: "Failed to establish WebSocket connection.",
          variant: "destructive",
        });
      };
      
      ws.onclose = () => {
        console.log("WebSocket connection closed");
        setIsSessionActive(false);
        setIsRecording(false);
      };
      
      websocketRef.current = ws;
      
    } catch (error) {
      setIsConnecting(false);
      const errorMessage = error instanceof Error ? error.message : "Failed to start session";
      toast({
        title: "Session Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };
  
  const stopSession = async () => {
    if (!sessionId || !accessToken) return;
    
    try {
      if (isRecording) {
        stopRecording();
      }
      
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
      
      await fetch(ENDPOINTS.END_AUDIO_SESSION(sessionId), {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });
      
      setIsSessionActive(false);
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
    if (!isSessionActive || isRecording) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
            console.log("Sending audio chunk, size:", event.data.size);
            websocketRef.current.send(event.data);
          } else {
            console.warn("WebSocket not open, cannot send audio data");
          }
        }
      };
      
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Use a smaller time slice for more frequent data sending
      mediaRecorder.start(250);
      setIsRecording(true);
      
      console.log("Recording started");
      
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Recording Error",
        description: "Could not access microphone.",
        variant: "destructive",
      });
    }
  }, [isSessionActive, isRecording, toast]);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);
  
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
  }, [transcripts.length, responses.length, sessionId]);
  
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
