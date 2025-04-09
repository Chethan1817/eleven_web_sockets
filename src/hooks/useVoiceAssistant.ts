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
  const isProcessingAudioRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const { toast } = useToast();

  // Helper function to log messages
  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  // Function to play PCM audio with improved handling
  const playPcmAudio = useCallback(async (pcmData: ArrayBuffer): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({ sampleRate: 44100 });
        }

        const audioCtx = audioContextRef.current;
        const audioBuffer = audioCtx.createBuffer(1, pcmData.byteLength / 2, 44100);
        const channel = audioBuffer.getChannelData(0);
        const view = new DataView(pcmData);

        // Use a more optimized buffer filling approach
        for (let i = 0; i < channel.length; i++) {
          channel[i] = view.getInt16(i * 2, true) / 0x8000;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        
        // Add a small gain node to smooth transitions
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 1.0;
        
        // Connect through gain node to smooth playback
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        // Use a tiny fade-in/fade-out to smooth transitions
        gainNode.gain.setValueAtTime(0.98, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 0.02);
        
        const bufferDuration = audioBuffer.duration;
        if (bufferDuration > 0.1) { // Only fade out if buffer is long enough
          gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime + bufferDuration - 0.02);
          gainNode.gain.linearRampToValueAtTime(0.98, audioCtx.currentTime + bufferDuration);
        }
        
        source.onended = () => {
          resolve();
        };
        
        source.start();
      } catch (error) {
        console.error("[useVoiceAssistant] Error playing PCM audio:", error);
        reject(error);
      }
    });
  }, []);

  // Function to play the next audio in the queue with minimal gaps
  const playNextInQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      setIsPlaying(false);
      isProcessingAudioRef.current = false;
      return;
    }

    isProcessingAudioRef.current = true;
    setIsPlaying(true);
    
    // Create or reuse AudioContext
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 44100 });
    }
    
    // Get next buffer from the queue instead of combining
    // This change will help with the choppy playback issue
    const buffer = audioQueueRef.current.shift()!;
    
    addLog(`🔊 Playing ${buffer.byteLength} bytes of audio`);
    
    try {
      await playPcmAudio(buffer);
      
      // No delay between checks - process next audio immediately if available
      if (audioQueueRef.current.length > 0) {
        playNextInQueue();
      } else {
        setIsPlaying(false);
        isProcessingAudioRef.current = false;
      }
    } catch (error) {
      console.error("[useVoiceAssistant] Error playing audio:", error);
      setIsPlaying(false);
      isProcessingAudioRef.current = false;
    }
  }, [addLog, playPcmAudio]);

  // Improved enqueueAudio function
  const enqueueAudio = useCallback((buffer: ArrayBuffer) => {
    addLog(`Enqueuing ${buffer.byteLength} bytes of audio`);
    
    // If the queue is empty and we're not processing audio,
    // start playback immediately
    const shouldStartPlaying = audioQueueRef.current.length === 0 && !isProcessingAudioRef.current;
    
    // Add to queue
    audioQueueRef.current.push(buffer);
    
    // Start playing if needed
    if (shouldStartPlaying) {
      playNextInQueue();
    }
  }, [addLog, playNextInQueue]);

  // Function to check if the user is speaking while audio is playing
  const checkUserSpeaking = useCallback((volume: number) => {
    const threshold = 0.02; // Match the example threshold
    setMicLevel(Math.min(volume * 300, 100));
    
    if (volume > threshold && isPlaying) {
      addLog("🛑 User spoke — interrupting playback.");
      audioQueueRef.current = [];
      setIsPlaying(false);
      isProcessingAudioRef.current = false;
    }
  }, [isPlaying, addLog]);

  const sendAudioChunk = useCallback((pcmChunk: ArrayBuffer) => {
    if (!socketRef.current) {
      return;
    }
    
    const readyState = socketRef.current.readyState;
    
    if (readyState === WebSocket.OPEN) {
      try {
        // Calculate volume for the audio chunk
        const view = new DataView(pcmChunk);
        let sum = 0;
        const length = pcmChunk.byteLength / 2;
        
        for (let i = 0; i < length; i++) {
          const int16 = view.getInt16(i * 2, true);
          const normalized = Math.abs(int16) / 0x8000;
          sum += normalized;
        }
        
        const volume = sum / length;
        
        // Update mic level for UI and check if user is speaking during playback
        setMicLevel(Math.min(volume * 300, 100));
        checkUserSpeaking(volume);
        
        // Send the audio data
        socketRef.current.send(pcmChunk);
      } catch (error) {
        console.error("[useVoiceAssistant] Error sending audio chunk:", error);
      }
    } else {
      console.log(`[useVoiceAssistant] Cannot send audio - WebSocket state: ${readyState}`);
    }
  }, [checkUserSpeaking]);

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

  // WebSocket connection setup
  useEffect(() => {
    // The rest of your websocket effect code

    if (!isListening) {
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

    const wsUrl = `wss://${import.meta.env.VITE_WEBSOCKET_URL}/ws/audio/?user_id=${userId}`;
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
          // Process audio data - THIS IS WHERE WE FIX THE CHOPPY AUDIO
          enqueueAudio(event.data);
        } else {
          // Handle text messages
          try {
            const message = JSON.parse(event.data);
            addLog(`📩 ${message.type}: ${message.text || message.status || message.message || JSON.stringify(message)}`);
            
            if (message.type === "error") {
              toast({
                title: "Error",
                description: message.message,
                variant: "destructive",
              });
            }
          } catch (e) {
            addLog(`📩 Text: ${event.data}`);
            console.error("[useVoiceAssistant] Failed to parse JSON message:", e, "Raw message:", event.data);
          }
        }
      };

      // Rest of WebSocket setup same as your code...
      
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
          setTimeout(() => {
            if (isListening) {
              // Reconnection logic would go here
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

    // Cleanup logic same as your code...
    return () => {
      if (socketRef.current && !isListening) {
        const readyState = socketRef.current.readyState;
        
        if (readyState !== WebSocket.CLOSED && readyState !== WebSocket.CLOSING) {
          try {
            socketRef.current.close();
          } catch (error) {
            console.error("[useVoiceAssistant] Error closing WebSocket:", error);
          }
        }
        
        if (globalWsRef === socketRef.current) {
          globalWsRef = null;
        }
      }
      setIsConnected(false);
      
      audioQueueRef.current = [];
      isProcessingAudioRef.current = false;
      setIsPlaying(false);
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => 
          console.error("[useVoiceAssistant] Error closing AudioContext:", e)
        );
        audioContextRef.current = null;
      }
    };
  }, [userId, isListening, toast, addLog, enqueueAudio]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      audioQueueRef.current = [];
      isProcessingAudioRef.current = false;
      setIsPlaying(false);
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => 
          console.error("[useVoiceAssistant] Error closing AudioContext:", e)
        );
        audioContextRef.current = null;
      }
    };
  }, []);

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