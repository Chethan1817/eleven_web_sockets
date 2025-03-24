import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

// Create a singleton WebSocket reference that persists across component instances
let globalWsRef: WebSocket | null = null;
let globalHasConnected = false;

export function useVoiceAssistant(userId: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const hasStartedRef = useRef(false);
  const { toast } = useToast();

  console.log("[useVoiceAssistant] Initializing with userId:", userId);
  console.log("[useVoiceAssistant] Current state:", { isConnected, isListening, isPlaying });

  // Helper function to log messages - modified to avoid the infinite loop
  const addLog = useCallback((message: string) => {
    console.log(`[useVoiceAssistant] ${message}`);
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  // Function to enqueue audio and start playback if not already playing
  const enqueueAudio = useCallback((buffer: ArrayBuffer) => {
    addLog(`Enqueuing ${buffer.byteLength} bytes of audio`);
    audioQueueRef.current.push(buffer);
    if (!isPlaying) {
      playNextInQueue();
    }
  }, [isPlaying, addLog]);

  // Function to play the next audio in the queue
  const playNextInQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    const buffer = audioQueueRef.current.shift();
    
    if (!buffer) {
      setIsPlaying(false);
      return;
    }

    addLog(`🔊 Playing ${buffer.byteLength} bytes of audio`);
    
    try {
      await playPcmAudio(buffer);
      
      // Add a delay between audio responses
      setTimeout(() => {
        playNextInQueue();
      }, 500);
    } catch (error) {
      console.error("[useVoiceAssistant] Error playing audio:", error);
      setIsPlaying(false);
    }
  }, [addLog]);

  const startListening = useCallback(() => {
    // Guard against multiple starts
    if (isConnected || socketRef.current || hasStartedRef.current) {
      addLog("⚠️ Ignoring startListening - already active or started");
      return;
    }

    addLog("Starting voice assistant session");
    reconnectAttemptsRef.current = 0;
    audioQueueRef.current = [];
    setIsPlaying(false);
    setIsListening(true);
    setLogs([]);
    hasStartedRef.current = true;
  }, [addLog, isConnected]);

  const stopListening = useCallback(() => {
    addLog("Stopping voice assistant session");
    setIsListening(false);
    audioQueueRef.current = [];
    setIsPlaying(false);
    hasStartedRef.current = false;
    
    if (socketRef.current) {
      const readyState = socketRef.current.readyState;
      
      if (readyState !== WebSocket.CLOSED && readyState !== WebSocket.CLOSING) {
        try {
          socketRef.current.close();
        } catch (error) {
          console.error("[useVoiceAssistant] Error closing WebSocket:", error);
        }
      }
      
      socketRef.current = null;
      
      // Clear the global reference if we're closing it
      if (globalWsRef === socketRef.current) {
        globalWsRef = null;
      }
    }
  }, [addLog]);

  // Function to check if the user is speaking while audio is playing
  const checkUserSpeaking = useCallback((volume: number) => {
    const threshold = 0.05; // Adjust as needed
    if (volume > threshold && isPlaying) {
      addLog("🛑 User spoke — interrupting playback.");
      audioQueueRef.current = [];
      setIsPlaying(false);
    }
  }, [isPlaying, addLog]);

  // Function to play PCM audio data
  const playPcmAudio = async (pcmData: ArrayBuffer): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const audioCtx = new AudioContext({ sampleRate: 16000 });

        const audioBuffer = audioCtx.createBuffer(1, pcmData.byteLength / 2, 16000);
        const channel = audioBuffer.getChannelData(0);
        const view = new DataView(pcmData);

        for (let i = 0; i < channel.length; i++) {
          const int16 = view.getInt16(i * 2, true);
          channel[i] = int16 / 0x8000;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        
        source.onended = () => {
          audioCtx.close().then(() => {
            resolve();
          });
        };
        
        source.start();
      } catch (error) {
        console.error("[useVoiceAssistant] Error playing PCM audio:", error);
        reject(error);
      }
    });
  };

  const sendAudioChunk = useCallback((pcmChunk: ArrayBuffer) => {
    if (!socketRef.current) {
      return;
    }
    
    const readyState = socketRef.current.readyState;
    if (readyState === WebSocket.OPEN) {
      const chunkSize = pcmChunk.byteLength;
      
      // Calculate volume for the audio chunk
      const view = new DataView(pcmChunk);
      let sum = 0;
      for (let i = 0; i < chunkSize / 2; i++) {
        const int16 = view.getInt16(i * 2, true);
        sum += Math.abs(int16) / 0x8000;
      }
      const volume = sum / (chunkSize / 2);
      
      // Update mic level for UI and check if user is speaking during playback
      setMicLevel(Math.min(volume * 300, 100));
      checkUserSpeaking(volume);
      
      // Send the audio chunk to the server
      try {
        socketRef.current.send(pcmChunk);
      } catch (error) {
        console.error("[useVoiceAssistant] Error sending audio chunk:", error);
      }
    }
  }, [checkUserSpeaking]);

  useEffect(() => {
    if (!isListening) {
      console.log("[useVoiceAssistant] Not listening, skipping WebSocket connection");
      return;
    }

    // Use the global WebSocket if it exists and is in a good state
    if (globalWsRef && (globalWsRef.readyState === WebSocket.OPEN || globalWsRef.readyState === WebSocket.CONNECTING)) {
      addLog("Using existing global WebSocket connection");
      socketRef.current = globalWsRef;
      if (globalWsRef.readyState === WebSocket.OPEN) {
        setIsConnected(true);
      }
      return;
    }

    const wsUrl = `ws://localhost:8000/ws/audio/?user_id=${userId}`;
    addLog(`Connecting to WebSocket: ${wsUrl}`);
    
    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;
      globalWsRef = ws; // Store in the global reference
      
      ws.binaryType = "arraybuffer";
      addLog("Set WebSocket binaryType to arraybuffer");

      ws.onopen = () => {
        addLog("✅ WebSocket connected successfully");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        globalHasConnected = true;
        
        toast({
          title: "Connected to voice assistant",
          description: "You can now speak to the assistant",
        });
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          const byteLength = event.data.byteLength;
          console.log(`[useVoiceAssistant] Received binary data: ${byteLength} bytes`);
          
          // Enqueue audio for playback
          enqueueAudio(event.data);
        } else {
          console.log("[useVoiceAssistant] Received text message:", event.data);
          try {
            const message = JSON.parse(event.data);
            addLog(`📩 ${message.type}: ${message.text || message.status || message.message || JSON.stringify(message)}`);
            
            if (message.type === "error") {
              console.warn("[useVoiceAssistant] Error message received:", message.message);
              toast({
                title: "Error",
                description: message.message,
                variant: "destructive",
              });
            } else if (message.type === "status") {
              console.log("[useVoiceAssistant] Status message:", message.status);
            }
          } catch (e) {
            addLog(`📩 Text: ${event.data}`);
            console.error("[useVoiceAssistant] Failed to parse JSON message:", e, "Raw message:", event.data);
          }
        }
      };

      ws.onerror = (err) => {
        addLog("❌ WebSocket error");
        console.error("[useVoiceAssistant] ❌ WebSocket error:", err);
        
        toast({
          title: "Connection Error",
          description: "Failed to connect to voice assistant. Please try again.",
          variant: "destructive",
        });
      };
      
      ws.onclose = (event) => {
        addLog(`🔌 WebSocket closed (code ${event.code})`);
        setIsConnected(false);
        
        if (isListening && !event.wasClean && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`[useVoiceAssistant] Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          setTimeout(() => {
            if (isListening) {
              console.log("[useVoiceAssistant] Reconnecting...");
            }
          }, 1000);
        } else if (isListening) {
          toast({
            title: "Disconnected",
            description: "Connection to voice assistant closed",
          });
        }
        
        // Clear the global reference if this was our socket
        if (globalWsRef === ws) {
          globalWsRef = null;
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
      // Only close the WebSocket if this component is being unmounted and we want to stop listening
      // Otherwise, keep it alive for the next component that will use it
      if (socketRef.current && !isListening) {
        const readyState = socketRef.current.readyState;
        
        if (readyState !== WebSocket.CLOSED && readyState !== WebSocket.CLOSING) {
          try {
            socketRef.current.close();
          } catch (error) {
            console.error("[useVoiceAssistant] Error closing WebSocket:", error);
          }
        }
        
        // Clear the global reference if this was our socket and we're closing it
        if (globalWsRef === socketRef.current) {
          globalWsRef = null;
        }
      }
      setIsConnected(false);
      
      // Clear audio queue on cleanup
      audioQueueRef.current = [];
      setIsPlaying(false);
    };
  }, [userId, isListening, toast, addLog, enqueueAudio]);

  return { 
    sendAudioChunk, 
    isConnected, 
    isListening, 
    isPlaying, 
    startListening, 
    stopListening,
    micLevel,
    logs
  };
}
