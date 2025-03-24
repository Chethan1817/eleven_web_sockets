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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[AudioRecorder] Microphone access granted:", stream);
      
      // Initialize AudioContext
      console.log("[AudioRecorder] Creating new AudioContext");
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      console.log("[AudioRecorder] AudioContext created with state:", audioContext.state);
      
      // Create source from the microphone stream
      console.log("[AudioRecorder] Creating MediaStreamAudioSourceNode");
      const source = audioContext.createMediaStreamSource(stream);
      audioNodesRef.current.source = source;
      console.log("[AudioRecorder] MediaStreamAudioSourceNode created");
      
      // Create an analyzer to get audio data
      console.log("[AudioRecorder] Creating AnalyserNode");
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
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
          console.log(`[AudioRecorder] Got audio data, sample values: ${dataArray[0].toFixed(3)}, ${dataArray[1].toFixed(3)}...`);
          
          // Convert to ArrayBuffer and send
          console.log(`[AudioRecorder] Sending audio chunk: ${dataArray.buffer.byteLength} bytes`);
          sendAudioChunk(dataArray.buffer);
        } else {
          console.warn("[AudioRecorder] Analyzer node is unavailable");
        }
        
        // Schedule next processing
        requestAnimationFrame(processAudio);
      };
      
      // Start processing audio frames
      processAudio();
      console.log("[AudioRecorder] Started audio processing loop");
      
      // Also keep MediaRecorder as backup
      console.log("[AudioRecorder] Creating MediaRecorder");
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`[AudioRecorder] MediaRecorder data available: ${event.data.size} bytes`);
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start();
      console.log("[AudioRecorder] MediaRecorder started");
      
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
    
    if (mediaRecorderRef.current) {
      console.log("[AudioRecorder] Stopping MediaRecorder");
      mediaRecorderRef.current.stop();
      
      // Stop all audio tracks from the stream
      if (mediaRecorderRef.current.stream) {
        console.log("[AudioRecorder] Stopping media tracks");
        mediaRecorderRef.current.stream.getTracks().forEach(track => {
          console.log(`[AudioRecorder] Stopping track: ${track.kind}`);
          track.stop();
        });
      }
      
      audioChunksRef.current = [];
      console.log("[AudioRecorder] Cleared audio chunks");
      
      mediaRecorderRef.current = null;
      console.log("[AudioRecorder] Set mediaRecorderRef to null");
    } else {
      console.log("[AudioRecorder] No MediaRecorder to stop");
    }
    
    // Clean up AudioContext resources
    if (audioContextRef.current) {
      console.log("[AudioRecorder] Cleaning up AudioContext resources");
      
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
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== 'inactive') {
          console.log("[AudioRecorder] Stopping active MediaRecorder");
          mediaRecorderRef.current.stop();
        }
        if (mediaRecorderRef.current.stream) {
          console.log("[AudioRecorder] Stopping media tracks");
          mediaRecorderRef.current.stream.getTracks().forEach(track => {
            console.log(`[AudioRecorder] Stopping track: ${track.kind}`);
            track.stop();
          });
        }
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
