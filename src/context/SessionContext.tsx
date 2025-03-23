
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
  const audioStreamRef = useRef<MediaStream | null>(null);
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
        body: JSON.stringify({ 
          user_id: user?.phone_number,
          user_name: user?.name 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create audio session");
      }
      
      const data = await response.json();
      console.log("Session created response:", data);
      setSessionId(data.session_id);
      
      // Setup audio stream for receiving responses
      setupAudioReceiveStream(data.receive_url);
      
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
  
  const setupAudioReceiveStream = (receiveUrl: string) => {
    try {
      // For now, we'll just log that we've set up the receive stream
      // In a real implementation, you would connect to the audio stream
      console.log("Setting up audio receive stream from URL:", receiveUrl);
      
      // Simulate receiving audio - this would be replaced with real implementation
      // that connects to the streaming endpoint
    } catch (error) {
      console.error("Error setting up audio receive stream:", error);
    }
  };
  
  const stopSession = async () => {
    if (!sessionId || !accessToken) return;
    
    try {
      if (isRecording) {
        stopRecording();
      }
      
      // Close any open audio streams
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
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
      audioStreamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && sessionId) {
          audioChunksRef.current.push(event.data);
          
          try {
            // Send audio chunk to the new endpoint
            const formData = new FormData();
            formData.append('audio', event.data);
            formData.append('session_id', sessionId);
            
            await fetch(ENDPOINTS.SEND_AUDIO_CHUNK, {
              method: 'POST',
              headers: {
                "Authorization": `Bearer ${accessToken}`,
              },
              body: formData
            });
            
            console.log("Audio chunk sent, size:", event.data.size);
          } catch (error) {
            console.error("Error sending audio chunk:", error);
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
  }, [isSessionActive, isRecording, sessionId, accessToken, toast]);
  
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
