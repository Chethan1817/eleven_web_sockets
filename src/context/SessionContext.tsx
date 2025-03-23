
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
  const [receiveUrl, setReceiveUrl] = useState<string | null>(null);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Setup audio streaming from server
  useEffect(() => {
    if (receiveUrl && isSessionActive) {
      console.log("Setting up EventSource for audio responses at:", receiveUrl);
      
      // Create an EventSource to handle server-sent events for audio responses
      const eventSource = new EventSource(receiveUrl);
      
      eventSource.onopen = () => {
        console.log("EventSource connection opened");
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received message from server:", data);
          
          if (data.text) {
            // Create a new response object
            const newResponse: Response = {
              id: `resp-${Date.now()}`,
              text: data.text,
              audio_url: data.audio_url,
              type: data.type || "main",
              timestamp: Date.now(),
            };
            
            setResponses(prev => [...prev, newResponse]);
          }
          
          if (data.transcript) {
            // Create a new transcript object
            const newTranscript: Transcript = {
              id: `trans-${Date.now()}`,
              text: data.transcript,
              is_final: data.is_final || false,
              timestamp: Date.now(),
            };
            
            setTranscripts(prev => [...prev, newTranscript]);
          }
        } catch (error) {
          console.error("Error processing server message:", error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error("EventSource error:", error);
      };
      
      // Clean up EventSource on component unmount or when session ends
      return () => {
        console.log("Closing EventSource connection");
        eventSource.close();
      };
    }
  }, [receiveUrl, isSessionActive]);
  
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
      
      // Store the receive URL for streaming audio responses
      if (data.receive_url) {
        setReceiveUrl(data.receive_url);
        console.log("Receive URL set:", data.receive_url);
      } else {
        console.error("No receive_url in response:", data);
      }
      
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
      
      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      
      await fetch(ENDPOINTS.END_AUDIO_SESSION(sessionId), {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });
      
      setIsSessionActive(false);
      setReceiveUrl(null);
      
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
        if (event.data.size > 0 && sessionId && accessToken) {
          audioChunksRef.current.push(event.data);
          
          try {
            console.log(`Sending audio chunk of size: ${event.data.size} bytes`);
            
            // Create a FormData object to send the audio chunk
            const formData = new FormData();
            formData.append('audio', new Blob([event.data], { type: 'audio/webm' }));
            formData.append('session_id', sessionId);
            
            const response = await fetch(ENDPOINTS.SEND_AUDIO_CHUNK, {
              method: 'POST',
              headers: {
                "Authorization": `Bearer ${accessToken}`,
              },
              body: formData
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Error sending audio chunk: ${response.status}`, errorText);
              throw new Error(`Error sending audio chunk: ${response.status}`);
            }
            
            console.log("Audio chunk sent successfully");
          } catch (error) {
            console.error("Error sending audio chunk:", error);
          }
        } else {
          console.log("No audio data or missing session ID/token", {
            dataSize: event.data.size,
            sessionId,
            hasToken: !!accessToken
          });
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log("Media recorder stopped");
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Use a smaller time slice for more frequent data sending (250ms)
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
  }, [isSessionActive, isRecording, sessionId, accessToken, toast]);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      console.log("Stopping recording...");
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log("Recording stopped");
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
    if (receiveUrl !== null) {
      setReceiveUrl(null);
    }
  }, [transcripts.length, responses.length, sessionId, greeting, receiveUrl]);
  
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
