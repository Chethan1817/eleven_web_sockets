import { useState, useEffect, useRef, useCallback } from "react";
import { Conversation } from "@11labs/client";
import { useToast } from "../hooks/use-toast";
import { AGENT_PROMPTS } from "../lib/prompts";
import { storeElevenLabsSessionId } from "../services/elevenLabsSessionService";

// Keep a global reference to the conversation
let globalConversation: Conversation | null = null;

export function useElevenLabsVoiceAssistant(userId: string) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const { toast } = useToast();

  // Helper function to log messages
  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  // Request microphone permissions
  const requestMicrophonePermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch (error) {
      console.error('Microphone permission denied', error);
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to use the voice assistant",
        variant: "destructive",
      });
      return false;
    }
  };

  // Helper function to resample audio to 16kHz Int16 PCM
  const resampleTo16kHz = async (
    float32Array: Float32Array,
    fromSampleRate: number
  ): Promise<Int16Array> => {
    // console.log("[AudioRecorder] Resampling audio from", fromSampleRate, "Hz to 16kHz");
    
    const offlineCtx = new OfflineAudioContext(1, float32Array.length * (16000 / fromSampleRate), 16000);
    const buffer = offlineCtx.createBuffer(1, float32Array.length, fromSampleRate);
    buffer.copyToChannel(float32Array, 0);

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start();

    const rendered = await offlineCtx.startRendering();
    const resampled = rendered.getChannelData(0);
    // console.log("[AudioRecorder] Resampled audio length:", resampled.length);

    // Convert Float32 to Int16
    const int16 = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
      const s = Math.max(-1, Math.min(1, resampled[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    return int16;
  };

  // Get signed URL from the server
  // Get signed URL from the server
  const getSignedUrl = async (): Promise<string> => {
    try {
      // Change to absolute path that matches your Next.js API route
      const response = await fetch('/api/signed-url');
      if (!response.ok) {
        throw Error('Failed to get signed url');
      }
      const data = await response.json();
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      throw error;
    }
  };

  // Start the conversation with ElevenLabs
  const startListening = useCallback(async () => {
    if (isConnected || conversation) {
      addLog("Already connected to ElevenLabs");
      return;
    }
    
    addLog("Starting voice assistant session with ElevenLabs");
    
    try {
      // Check for microphone permission
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        addLog("❌ Microphone permission denied");
        return;
      }
      
      // Get signed URL from server
      const signedUrl = await getSignedUrl();
      addLog(`✅ Obtained signed URL from server`);
      
      // Use global conversation if it exists
      if (globalConversation) {
        setConversation(globalConversation);
        setIsConnected(true);
        setIsListening(true);
        addLog("Using existing ElevenLabs conversation");
        return;
      }
      
      // Start ElevenLabs conversation
      const newConversation = await Conversation.startSession({
        signedUrl: signedUrl,
        overrides: {
          agent: {
            prompt: {
              prompt: AGENT_PROMPTS.default.replace('{userId}', userId || 'unknown')
            }
          }
        },
        onConnect: () => {
          addLog("✅ Connected to ElevenLabs");
          setIsConnected(true);
          setIsListening(true);
          
          toast({
            title: "Connected to voice assistant",
            description: "You can now speak to the assistant",
          });
        },
        onDisconnect: () => {
          addLog("🔌 Disconnected from ElevenLabs");
          setIsConnected(false);
          setIsListening(false);
          setIsSpeaking(false);
        },
        onError: (error) => {
          addLog(`❌ ElevenLabs error: ${error}`);
          console.error("ElevenLabs error:", error);
          
          toast({
            title: "Connection Error",
            description: "An error occurred during the conversation",
            variant: "destructive",
          });
        },
        onModeChange: ({ mode }) => {
          addLog(`Mode changed to: ${mode}`);
          setIsSpeaking(mode === 'speaking');
          
          // Update mic level when speaking/listening changes
          if (mode === 'speaking') {
            setMicLevel(0);
          }
        },
      });
      
      addLog(`✅ ElevenLabs session started with ID: ${newConversation.getId()}`);
      
      // Log available methods for debugging
      addLog(`Available methods on conversation: ${Object.getOwnPropertyNames(
        Object.getPrototypeOf(newConversation)
      ).join(', ')}`);
      console.log("Conversation methods:", Object.getOwnPropertyNames(
        Object.getPrototypeOf(newConversation)
      ));
      
      // Save conversation references
      setConversation(newConversation);
      globalConversation = newConversation;
      
      // Store session ID in localStorage and backend
      localStorage.setItem('elevenlabs_session_id', newConversation.getId());
      
      // Store session ID in database through API
      try {
        await storeElevenLabsSessionId(newConversation.getId());
        addLog(`✅ Session ID stored in database: ${newConversation.getId()}`);
      } catch (error) {
        addLog(`⚠️ Failed to store session ID in database: ${error}`);
        console.error("Failed to store session ID:", error);
      }
      
      // Start recording audio
      startRecording();
      
    } catch (error) {
      addLog(`❌ Error starting ElevenLabs session: ${error}`);
      console.error("Error starting ElevenLabs session:", error);
      
      toast({
        title: "Connection Error",
        description: "Failed to connect to voice assistant",
        variant: "destructive",
      });
    }
  }, [addLog, isConnected, conversation, toast, userId]);

  // Stop the conversation
  const stopListening = useCallback(async () => {
    addLog("Stopping voice assistant session");
    
    // Stop recording
    stopRecording();
    
    // End ElevenLabs session
    if (conversation) {
      try {
        await conversation.endSession();
        addLog("✅ ElevenLabs session ended");
      } catch (error) {
        addLog(`❌ Error ending ElevenLabs session: ${error}`);
        console.error("Error ending ElevenLabs session:", error);
      }
    }
    
    // Reset states
    setConversation(null);
    globalConversation = null;
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setMicLevel(0);
    
    // Remove session ID from localStorage
    localStorage.removeItem('elevenlabs_session_id');
    
  }, [addLog, conversation]);

  // Start recording audio
  const startRecording = useCallback(() => {
    if (!isConnected) {
      addLog("Cannot start recording: Not connected to ElevenLabs");
      return;
    }
    
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        addLog("Starting audio recording");
        
        // Keep track of the stream for cleanup
        streamRef.current = stream;
        
        // Initialize AudioContext
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        
        // Create source from the microphone stream
        const sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = sourceNode;
        
        // Create an analyzer for visualization
        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 2048;
        analyzer.smoothingTimeConstant = 0.8;
        analyzerRef.current = analyzer;
        sourceNode.connect(analyzer);
        
        // Create ScriptProcessorNode for direct audio processing
        const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
        processorNodeRef.current = processorNode;
        
        // Connect the processing chain
        analyzer.connect(processorNode);
        processorNode.connect(audioContext.destination);
        
        // Process audio data directly
        processorNode.onaudioprocess = async (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          
          // Clone the data since it's from a live buffer
          const audioData = new Float32Array(inputData.length);
          audioData.set(inputData);
          
          try {
            if (audioContextRef.current && !isPlaying && conversation) {
              const int16Data = await resampleTo16kHz(audioData, audioContextRef.current.sampleRate);
              const blob = new Blob([int16Data.buffer], { type: 'audio/wav' });
              
              // Try multiple methods to send audio to ElevenLabs
              try {
                // @ts-ignore - Bypass TypeScript errors while we find the right method
                if (typeof conversation.pushAudio === 'function') {
                  // @ts-ignore
                  conversation.pushAudio(blob);
                }
                // @ts-ignore
                else if (typeof conversation.recordAudio === 'function') {
                  // @ts-ignore
                  conversation.recordAudio(blob);
                }
                // @ts-ignore
                else if (typeof conversation.sendUserMessage === 'function') {
                  // @ts-ignore
                  conversation.sendUserMessage({ audio: blob });
                }
                // @ts-ignore
                else if (typeof conversation.addAudio === 'function') {
                  // @ts-ignore
                  conversation.addAudio(blob);
                }
                // @ts-ignore
                else if (typeof conversation.pushUserAudio === 'function') {
                  // @ts-ignore
                  conversation.pushUserAudio(blob);
                }
                else {
                  console.log("No suitable method found to send audio");
                }
              } catch (err) {
                console.error("Error sending audio to ElevenLabs:", err);
              }
            }
          } catch (error) {
            console.error("[AudioRecorder] Error processing audio:", error);
          }
        };
        
        // Also keep MediaRecorder as backup
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        
        // Set up audio analyzer for microphone level
        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        
        // Function to update mic level visualization
        const updateMicLevel = () => {
          if (isListening && !isPlaying) {
            analyzer.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const normalizedLevel = Math.min((average / 128) * 100, 100);
            
            // Update mic level state
            setMicLevel(normalizedLevel);
          }
          
          // Schedule next update if still recording
          if (isListening) {
            requestAnimationFrame(updateMicLevel);
          }
        };
        
        // Start the mic level visualization
        updateMicLevel();
      })
      .catch(error => {
        addLog(`❌ Error accessing microphone: ${error}`);
        console.error("Error accessing microphone:", error);
        
        toast({
          title: "Microphone Error",
          description: "Could not access your microphone",
          variant: "destructive",
        });
      });
  }, [addLog, isConnected, conversation, isPlaying, isListening, toast]);
  
  // Stop recording audio
  const stopRecording = useCallback(() => {
    // Stop MediaRecorder if it exists
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
    
    // Stop and clean up audio processing
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    
    if (analyzerRef.current) {
      analyzerRef.current.disconnect();
      analyzerRef.current = null;
    }
    
    // Stop media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close()
        .then(() => console.log("[AudioRecorder] AudioContext closed successfully"))
        .catch(e => console.error("[AudioRecorder] Error closing AudioContext:", e));
      audioContextRef.current = null;
    }
    
    addLog("Audio recording stopped");
  }, [addLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      
      if (conversation) {
        conversation.endSession()
          .catch(error => console.error("Error ending session on cleanup:", error));
      }
      
      setConversation(null);
      globalConversation = null;
    };
  }, [conversation, stopRecording]);

  return {
    isConnected,
    isListening,
    isPlaying,
    startListening,
    stopListening,
    micLevel,
    logs,
    conversation,
  };
}