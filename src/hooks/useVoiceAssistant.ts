
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function useVoiceAssistant(userId: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();

  console.log("[useVoiceAssistant] Initializing with userId:", userId);

  useEffect(() => {
    // Only connect if we're actively listening
    if (!isListening) {
      console.log("[useVoiceAssistant] Not listening, skipping WebSocket connection");
      return;
    }

    const wsUrl = `ws://localhost:8000/ws/audio/?user_id=${userId}`;
    console.log("[useVoiceAssistant] Connecting to WebSocket:", wsUrl);
    
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.binaryType = "arraybuffer";
    console.log("[useVoiceAssistant] Set WebSocket binaryType to arraybuffer");

    ws.onopen = () => {
      console.log("[useVoiceAssistant] ✅ WebSocket connected successfully");
      setIsConnected(true);
      toast({
        title: "Connected to voice assistant",
        description: "You can now speak to the assistant",
      });
      console.log("[useVoiceAssistant] Connection toast displayed");
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        console.log(`[useVoiceAssistant] Received binary data: ${event.data.byteLength} bytes`);
        const blob = new Blob([event.data], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        console.log("[useVoiceAssistant] Created audio URL:", url);
        const audio = new Audio(url);
        
        setIsPlaying(true);
        console.log("[useVoiceAssistant] Starting audio playback");
        
        audio.onended = () => {
          console.log("[useVoiceAssistant] Audio playback ended");
          setIsPlaying(false);
          URL.revokeObjectURL(url); // Clean up the blob URL
          console.log("[useVoiceAssistant] Revoked audio URL");
        };
        
        audio.play().catch(error => {
          console.error("[useVoiceAssistant] Failed to play audio:", error);
          setIsPlaying(false);
        });
      } else {
        console.log("[useVoiceAssistant] Received text message:", event.data);
        try {
          const message = JSON.parse(event.data);
          console.log("[useVoiceAssistant] ℹ️ Parsed JSON message:", message);
          
          // Handle different message types
          if (message.type === "error") {
            console.warn("[useVoiceAssistant] Error message received:", message.message);
            toast({
              title: "Error",
              description: message.message,
              variant: "destructive",
            });
            console.log("[useVoiceAssistant] Error toast displayed");
          }
        } catch (e) {
          console.error("[useVoiceAssistant] Failed to parse JSON message:", e, "Raw message:", event.data);
        }
      }
    };

    ws.onerror = (err) => {
      console.error("[useVoiceAssistant] ❌ WebSocket error:", err);
      console.log("[useVoiceAssistant] WebSocket readyState:", ws.readyState);
      toast({
        title: "Connection Error",
        description: "Failed to connect to voice assistant",
        variant: "destructive",
      });
      console.log("[useVoiceAssistant] Error toast displayed");
    };
    
    ws.onclose = (event) => {
      console.warn("[useVoiceAssistant] 🔌 WebSocket closed with code:", event.code, "reason:", event.reason);
      setIsConnected(false);
      if (isListening) {
        console.log("[useVoiceAssistant] Notifying user about disconnection");
        toast({
          title: "Disconnected",
          description: "Connection to voice assistant closed",
        });
        console.log("[useVoiceAssistant] Disconnection toast displayed");
      }
    };

    return () => {
      console.log("[useVoiceAssistant] Cleaning up WebSocket connection");
      if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
        console.log("[useVoiceAssistant] Closing WebSocket connection");
        socketRef.current.close();
        console.log("[useVoiceAssistant] WebSocket connection closed");
      }
      setIsConnected(false);
      console.log("[useVoiceAssistant] Set isConnected to false");
    };
  }, [userId, isListening, toast]);

  const startListening = () => {
    console.log("[useVoiceAssistant] Starting to listen");
    setIsListening(true);
  };

  const stopListening = () => {
    console.log("[useVoiceAssistant] Stopping listening");
    setIsListening(false);
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      console.log("[useVoiceAssistant] Closing WebSocket connection on stopListening");
      socketRef.current.close();
      socketRef.current = null;
      console.log("[useVoiceAssistant] WebSocket connection closed and reference cleared");
    }
  };

  const sendAudioChunk = (pcmChunk: ArrayBuffer) => {
    if (!socketRef.current) {
      console.warn("[useVoiceAssistant] Cannot send audio chunk: socket is null");
      return;
    }
    
    if (socketRef.current.readyState === WebSocket.OPEN) {
      console.log(`[useVoiceAssistant] Sending audio chunk: ${pcmChunk.byteLength} bytes`);
      socketRef.current.send(pcmChunk);
    } else {
      console.warn(`[useVoiceAssistant] Cannot send audio chunk: socket readyState is ${socketRef.current.readyState}`);
    }
  };

  return { 
    sendAudioChunk, 
    isConnected, 
    isListening, 
    isPlaying, 
    startListening, 
    stopListening 
  };
}
