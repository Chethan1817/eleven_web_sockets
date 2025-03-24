
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader } from "lucide-react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

const AudioRecorder: React.FC = () => {
  const { user } = useAuth();
  console.log("[AudioRecorder] User data:", user);
  const userId = user?.id ? String(user.id) : user?.phone_number || "";
  console.log("[AudioRecorder] Using userId:", userId);
  
  const { toast } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<{
    source?: MediaStreamAudioSourceNode,
    analyzer?: AnalyserNode
  }>({});
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { 
    sendAudioChunk, 
    isConnected, 
    isListening, 
    isPlaying,
    startListening, 
    stopListening 
  } = useVoiceAssistant(userId);

  console.log("[AudioRecorder] Current state:", { isRecording, isConnected, isListening, isPlaying });

  const startRecording = async () => {
    console.log("[AudioRecorder] Starting recording process");
    try {
      console.log("[AudioRecorder] Requesting microphone access");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      console.log("[AudioRecorder] Microphone access granted:", stream);
      streamRef.current = stream;
      
      // Initialize AudioContext
      console.log("[AudioRecorder] Creating new AudioContext");
      const audioContext = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: 44100
      });
      audioContextRef.current = audioContext;
      console.log("[AudioRecorder] AudioContext created with state:", audioContext.state);
      console.log("[AudioRecorder] AudioContext sample rate:", audioContext.sampleRate);
      
      // Create source from the microphone stream
      console.log("[AudioRecorder] Creating MediaStreamAudioSourceNode");
      const source = audioContext.createMediaStreamSource(stream);
      audioNodesRef.current.source = source;
      console.log("[AudioRecorder] MediaStreamAudioSourceNode created");
      
      // Create an analyzer to get audio data
      console.log("[AudioRecorder] Creating AnalyserNode");
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      analyzer.smoothingTimeConstant = 0.8;
      audioNodesRef.current.analyzer = analyzer;
      console.log("[AudioRecorder] AnalyserNode created with fftSize:", analyzer.fftSize);
      
      source.connect(analyzer);
      console.log("[AudioRecorder] Connected source to analyzer");
      
      // Use a smaller buffer size and process audio
      const bufferSize = 4096;
      console.log("[AudioRecorder] Setting up audio processing with buffer size:", bufferSize);
      
      const processAudio = () => {
        if (!isRecording || !audioContextRef.current) {
          console.log("[AudioRecorder] Audio processing stopped: recording inactive or context null");
          return;
        }
        
        const dataArray = new Float32Array(bufferSize);
        if (audioNodesRef.current.analyzer) {
          audioNodesRef.current.analyzer.getFloatTimeDomainData(dataArray);
          
          // Log only occasionally to avoid console flooding
          if (Math.random() < 0.05) {  // Log roughly 5% of the time
            console.log(`[AudioRecorder] Got audio data, sample values: ${dataArray[0].toFixed(3)}, ${dataArray[1].toFixed(3)}...`);
            
            // Calculate audio level for debugging
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += Math.abs(dataArray[i]);
            }
            const average = sum / dataArray.length;
            console.log(`[AudioRecorder] Average audio level: ${average.toFixed(5)}`);
          }
          
          // Convert to ArrayBuffer and send
          console.log(`[AudioRecorder] Sending audio chunk: ${dataArray.buffer.byteLength} bytes`);
          sendAudioChunk(dataArray.buffer);
        } else {
          console.warn("[AudioRecorder] Analyzer node is unavailable");
        }
        
        // Schedule next processing
        animationFrameRef.current = requestAnimationFrame(processAudio);
      };
      
      // Start processing audio frames
      animationFrameRef.current = requestAnimationFrame(processAudio);
      console.log("[AudioRecorder] Started audio processing loop");
      
      // Also keep MediaRecorder as backup
      console.log("[AudioRecorder] Creating MediaRecorder");
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      console.log("[AudioRecorder] MediaRecorder created with mimeType:", mediaRecorder.mimeType);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`[AudioRecorder] MediaRecorder data available: ${event.data.size} bytes`);
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(1000);  // Collect data every second
      console.log("[AudioRecorder] MediaRecorder started with interval: 1000ms");
      
      setIsRecording(true);
      console.log("[AudioRecorder] Set isRecording to true");
      
      startListening();
      console.log("[AudioRecorder] Started listening for assistant responses");
      
    } catch (error) {
      console.error("[AudioRecorder] Error starting recording:", error);
      toast({
        title: "Microphone Error",
        description: "Could not access your microphone. Please check permissions.",
        variant: "destructive",
      });
      console.log("[AudioRecorder] Displayed microphone error toast");
    }
  };

  const stopRecording = () => {
    console.log("[AudioRecorder] Stopping recording");
    
    // Cancel any ongoing animation frame
    if (animationFrameRef.current !== null) {
      console.log("[AudioRecorder] Cancelling animation frame:", animationFrameRef.current);
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      console.log("[AudioRecorder] Animation frame cancelled");
    }
    
    // Stop MediaRecorder if it exists
    if (mediaRecorderRef.current) {
      console.log("[AudioRecorder] Stopping MediaRecorder, current state:", mediaRecorderRef.current.state);
      
      if (mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
          console.log("[AudioRecorder] MediaRecorder stopped successfully");
        } catch (error) {
          console.error("[AudioRecorder] Error stopping MediaRecorder:", error);
        }
      } else {
        console.log("[AudioRecorder] MediaRecorder already inactive, no need to stop");
      }
      
      mediaRecorderRef.current = null;
      console.log("[AudioRecorder] Set mediaRecorderRef to null");
    } else {
      console.log("[AudioRecorder] No MediaRecorder to stop");
    }
    
    // Stop audio tracks
    if (streamRef.current) {
      console.log("[AudioRecorder] Stopping media tracks");
      streamRef.current.getTracks().forEach(track => {
        console.log(`[AudioRecorder] Stopping track: ${track.kind}, ID: ${track.id}`);
        track.stop();
      });
      streamRef.current = null;
      console.log("[AudioRecorder] Stream reference cleared");
    }
    
    // Clean up AudioContext resources
    if (audioContextRef.current) {
      console.log("[AudioRecorder] Cleaning up AudioContext resources, current state:", audioContextRef.current.state);
      
      // Disconnect nodes first
      if (audioNodesRef.current.source) {
        console.log("[AudioRecorder] Disconnecting source node");
        try {
          audioNodesRef.current.source.disconnect();
          console.log("[AudioRecorder] Source node disconnected");
        } catch (e) {
          console.error("[AudioRecorder] Error disconnecting source node:", e);
        }
      }
      
      if (audioNodesRef.current.analyzer) {
        console.log("[AudioRecorder] Disconnecting analyzer node");
        try {
          audioNodesRef.current.analyzer.disconnect();
          console.log("[AudioRecorder] Analyzer node disconnected");
        } catch (e) {
          console.error("[AudioRecorder] Error disconnecting analyzer node:", e);
        }
      }
      
      // Only close if not already closed
      if (audioContextRef.current.state !== 'closed') {
        console.log("[AudioRecorder] Closing AudioContext, current state:", audioContextRef.current.state);
        audioContextRef.current.close()
          .then(() => console.log("[AudioRecorder] AudioContext closed successfully"))
          .catch(e => console.error("[AudioRecorder] Error closing AudioContext:", e));
      } else {
        console.log("[AudioRecorder] AudioContext already closed");
      }
      
      audioContextRef.current = null;
      console.log("[AudioRecorder] Set audioContextRef to null");
    }
    
    // Clear audio nodes
    audioNodesRef.current = {};
    console.log("[AudioRecorder] Cleared audio nodes reference");
    
    // Clear audio chunks
    audioChunksRef.current = [];
    console.log("[AudioRecorder] Cleared audio chunks");
    
    setIsRecording(false);
    console.log("[AudioRecorder] Set isRecording to false");
    
    stopListening();
    console.log("[AudioRecorder] Stopped listening for assistant responses");
  };

  // Clean up on component unmount
  useEffect(() => {
    console.log("[AudioRecorder] Component mounted");
    return () => {
      console.log("[AudioRecorder] Component unmounting, cleaning up resources");
      
      // Cancel any ongoing animation frame
      if (animationFrameRef.current !== null) {
        console.log("[AudioRecorder] Cleanup: Cancelling animation frame");
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== 'inactive') {
          console.log("[AudioRecorder] Stopping active MediaRecorder");
          try {
            mediaRecorderRef.current.stop();
          } catch (error) {
            console.error("[AudioRecorder] Error stopping MediaRecorder during cleanup:", error);
          }
        }
      }
      
      if (streamRef.current) {
        console.log("[AudioRecorder] Stopping media tracks");
        streamRef.current.getTracks().forEach(track => {
          console.log(`[AudioRecorder] Stopping track: ${track.kind}`);
          track.stop();
        });
        streamRef.current = null;
      }
      
      // Safely close AudioContext if it exists and isn't already closed
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          console.log("[AudioRecorder] Cleanup: Disconnecting audio nodes");
          // Disconnect any nodes first to prevent memory leaks
          if (audioNodesRef.current.source) {
            audioNodesRef.current.source.disconnect();
          }
          if (audioNodesRef.current.analyzer) {
            audioNodesRef.current.analyzer.disconnect();
          }
          
          console.log("[AudioRecorder] Cleanup: Closing AudioContext");
          audioContextRef.current.close()
            .then(() => console.log("[AudioRecorder] Cleanup: AudioContext closed successfully"))
            .catch(e => console.error("[AudioRecorder] Cleanup: Error closing AudioContext:", e));
        } catch (e) {
          console.error("[AudioRecorder] Error during cleanup of AudioContext:", e);
        }
      }
      
      console.log("[AudioRecorder] Cleanup: Stopping listening");
      stopListening();
    };
  }, [stopListening]);

  const toggleRecording = () => {
    console.log("[AudioRecorder] Toggle recording, current state:", isRecording);
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative mb-4">
        <Button
          onClick={toggleRecording}
          variant={isRecording ? "destructive" : "default"}
          size="lg"
          className={`rounded-full h-16 w-16 flex items-center justify-center ${isPlaying ? 'animate-pulse' : ''}`}
          disabled={isPlaying}
        >
          {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
        </Button>
        
        {isConnected && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
        )}
        
        {isListening && !isConnected && (
          <span className="absolute -top-1 -right-1">
            <Loader className="h-4 w-4 animate-spin text-primary" />
          </span>
        )}
      </div>
      
      <div className="text-sm text-muted-foreground">
        {isRecording ? (
          isConnected ? "Listening..." : "Connecting..."
        ) : (
          "Tap to speak"
        )}
      </div>
      
      {isPlaying && (
        <div className="mt-2 text-sm font-medium text-primary animate-pulse">
          Assistant is speaking...
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
