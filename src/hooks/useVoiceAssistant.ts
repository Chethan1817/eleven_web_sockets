
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function useVoiceAssistant(userId: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Only connect if we're actively listening
    if (!isListening) return;

    const wsUrl = `ws://localhost:8000/ws/audio/?user_id=${userId}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      setIsConnected(true);
      toast({
        title: "Connected to voice assistant",
        description: "You can now speak to the assistant",
      });
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const blob = new Blob([event.data], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        
        setIsPlaying(true);
        
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(url); // Clean up the blob URL
        };
        
        audio.play().catch(error => {
          console.error("Failed to play audio:", error);
          setIsPlaying(false);
        });
      } else {
        try {
          const message = JSON.parse(event.data);
          console.log("ℹ️ JSON message:", message);
          
          // Handle different message types
          if (message.type === "error") {
            toast({
              title: "Error",
              description: message.message,
              variant: "destructive",
            });
          }
        } catch (e) {
          console.error("Failed to parse JSON message:", e);
        }
      }
    };

    ws.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
      toast({
        title: "Connection Error",
        description: "Failed to connect to voice assistant",
        variant: "destructive",
      });
    };
    
    ws.onclose = () => {
      console.warn("🔌 WebSocket closed");
      setIsConnected(false);
      if (isListening) {
        toast({
          title: "Disconnected",
          description: "Connection to voice assistant closed",
        });
      }
    };

    return () => {
      if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
        socketRef.current.close();
      }
      setIsConnected(false);
    };
  }, [userId, isListening, toast]);

  const startListening = () => {
    setIsListening(true);
  };

  const stopListening = () => {
    setIsListening(false);
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  const sendAudioChunk = (pcmChunk: ArrayBuffer) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(pcmChunk);
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
