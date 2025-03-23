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
      


