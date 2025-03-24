
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function useVoiceAssistant(userId: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const { toast } = useToast();

  console.log("[useVoiceAssistant] Initializing with userId:", userId);
  console.log("[useVoiceAssistant] Current state:", { isConnected, isListening, isPlaying });

  useEffect(() => {
    // Only connect if we're actively listening
    if (!isListening) {
      console.log("[useVoiceAssistant] Not listening, skipping WebSocket connection");
      return;
    }

    const wsUrl = `ws://localhost:8000/ws/audio/?user_id=${userId}`;
    console.log("[useVoiceAssistant] Connecting to WebSocket:", wsUrl);
    console.log("[useVoiceAssistant] Reconnect attempt:", reconnectAttemptsRef.current);
    
    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.binaryType = "arraybuffer";
      console.log("[useVoiceAssistant] Set WebSocket binaryType to arraybuffer");

      ws.onopen = () => {
        console.log("[useVoiceAssistant] ✅ WebSocket connected successfully");
        console.log("[useVoiceAssistant] WebSocket readyState:", ws.readyState);
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
        toast({
          title: "Connected to voice assistant",
          description: "You can now speak to the assistant",
        });
        console.log("[useVoiceAssistant] Connection toast displayed");
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          const byteLength = event.data.byteLength;
          console.log(`[useVoiceAssistant] Received binary data: ${byteLength} bytes`);
          
          // Only log details for smaller audio chunks to avoid flooding the console
          if (byteLength < 10000) {
            const view = new DataView(event.data);
            const firstBytes = [];
            for (let i = 0; i < Math.min(8, byteLength); i += 2) {
              if (i < byteLength) {
                firstBytes.push(view.getInt16(i, true));
              }
            }
            console.log(`[useVoiceAssistant] Audio data samples: ${firstBytes.join(', ')}...`);
          }
          
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
            } else if (message.type === "status") {
              console.log("[useVoiceAssistant] Status message:", message.status);
            }
          } catch (e) {
            console.error("[useVoiceAssistant] Failed to parse JSON message:", e, "Raw message:", event.data);
          }
        }
      };

      ws.onerror = (err) => {
        console.error("[useVoiceAssistant] ❌ WebSocket error:", err);
        console.log("[useVoiceAssistant] WebSocket readyState:", ws.readyState);
        console.log("[useVoiceAssistant] Error details:", {
          message: err.message,
          type: err.type,
          bubbles: err.bubbles,
          cancelable: err.cancelable
        });
        
        toast({
          title: "Connection Error",
          description: "Failed to connect to voice assistant. Please try again.",
          variant: "destructive",
        });
        console.log("[useVoiceAssistant] Error toast displayed");
      };
      
      ws.onclose = (event) => {
        console.warn("[useVoiceAssistant] 🔌 WebSocket closed with code:", event.code, "reason:", event.reason);
        console.log("[useVoiceAssistant] WebSocket was clean:", event.wasClean);
        setIsConnected(false);
        
        // Try to reconnect if the connection was lost unexpectedly and we're still listening
        if (isListening && !event.wasClean && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`[useVoiceAssistant] Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          // Wait a bit before reconnecting
          setTimeout(() => {
            if (isListening) {
              console.log("[useVoiceAssistant] Reconnecting...");
              // The useEffect will run again and reconnect
            }
          }, 1000);
        } else if (isListening) {
          console.log("[useVoiceAssistant] Notifying user about disconnection");
          toast({
            title: "Disconnected",
            description: "Connection to voice assistant closed",
          });
          console.log("[useVoiceAssistant] Disconnection toast displayed");
        }
      };
    } catch (error) {
      console.error("[useVoiceAssistant] Error creating WebSocket:", error);
      toast({
        title: "Connection Error",
        description: "Failed to create WebSocket connection",
        variant: "destructive",
      });
    }

    return () => {
      console.log("[useVoiceAssistant] Cleaning up WebSocket connection");
      if (socketRef.current) {
        const readyState = socketRef.current.readyState;
        console.log("[useVoiceAssistant] Current WebSocket readyState:", readyState);
        
        if (readyState !== WebSocket.CLOSED && readyState !== WebSocket.CLOSING) {
          console.log("[useVoiceAssistant] Closing WebSocket connection");
          try {
            socketRef.current.close();
            console.log("[useVoiceAssistant] WebSocket connection closed");
          } catch (error) {
            console.error("[useVoiceAssistant] Error closing WebSocket:", error);
          }
        } else {
          console.log("[useVoiceAssistant] WebSocket already closed or closing, skipping close call");
        }
      }
      setIsConnected(false);
      console.log("[useVoiceAssistant] Set isConnected to false");
    };
  }, [userId, isListening, toast]);

  const startListening = () => {
    console.log("[useVoiceAssistant] Starting to listen");
    reconnectAttemptsRef.current = 0; // Reset reconnect attempts when manually starting
    setIsListening(true);
  };

  const stopListening = () => {
    console.log("[useVoiceAssistant] Stopping listening");
    setIsListening(false);
    if (socketRef.current) {
      const readyState = socketRef.current.readyState;
      console.log("[useVoiceAssistant] WebSocket readyState on stopListening:", readyState);
      
      if (readyState !== WebSocket.CLOSED && readyState !== WebSocket.CLOSING) {
        console.log("[useVoiceAssistant] Closing WebSocket connection on stopListening");
        try {
          socketRef.current.close();
          console.log("[useVoiceAssistant] WebSocket connection closed");
        } catch (error) {
          console.error("[useVoiceAssistant] Error closing WebSocket:", error);
        }
      } else {
        console.log("[useVoiceAssistant] WebSocket already closed or closing on stopListening");
      }
      
      socketRef.current = null;
      console.log("[useVoiceAssistant] WebSocket reference cleared");
    } else {
      console.log("[useVoiceAssistant] No WebSocket to close on stopListening");
    }
  };

  const sendAudioChunk = (pcmChunk: ArrayBuffer) => {
    if (!socketRef.current) {
      console.warn("[useVoiceAssistant] Cannot send audio chunk: socket is null");
      return;
    }
    
    const readyState = socketRef.current.readyState;
    if (readyState === WebSocket.OPEN) {
      const chunkSize = pcmChunk.byteLength;
      console.log(`[useVoiceAssistant] Sending audio chunk: ${chunkSize} bytes`);
      
      // Log the first few bytes of the chunk for debugging
      if (chunkSize > 0) {
        const view = new DataView(pcmChunk);
        const firstBytes = [];
        for (let i = 0; i < Math.min(8, chunkSize); i += 2) {
          if (i < chunkSize) {
            firstBytes.push(view.getInt16(i, true));
          }
        }
        console.log(`[useVoiceAssistant] Audio chunk samples: ${firstBytes.join(', ')}...`);
      }
      
      try {
        socketRef.current.send(pcmChunk);
        console.log("[useVoiceAssistant] Audio chunk sent successfully");
      } catch (error) {
        console.error("[useVoiceAssistant] Error sending audio chunk:", error);
      }
    } else {
      console.warn(`[useVoiceAssistant] Cannot send audio chunk: socket readyState is ${readyState}`);
      
      // Map readyState to a human-readable string for better debugging
      const readyStateMap = {
        [WebSocket.CONNECTING]: "CONNECTING",
        [WebSocket.OPEN]: "OPEN",
        [WebSocket.CLOSING]: "CLOSING",
        [WebSocket.CLOSED]: "CLOSED"
      };
      console.warn(`[useVoiceAssistant] Current WebSocket state: ${readyStateMap[readyState] || "UNKNOWN"}`);
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
