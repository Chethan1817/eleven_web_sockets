import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader } from "lucide-react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

const AudioRecorder: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.phone_number || "";
  const { toast } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const { 
    sendAudioChunk, 
    isConnected, 
    isListening, 
    isPlaying,
    startListening, 
    stopListening 
  } = useVoiceAssistant(userId);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize AudioContext for PCM processing
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      // Process audio to get PCM data
      processor.onaudioprocess = (e) => {
        const pcmData = e.inputBuffer.getChannelData(0);
        // Convert Float32Array to ArrayBuffer
        sendAudioChunk(pcmData.buffer);
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // Also keep MediaRecorder as backup
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      startListening();
      
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Microphone Error",
        description: "Could not access your microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      
      // Stop all audio tracks from the stream
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
    }
    
    // Clean up AudioContext resources
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    
    setIsRecording(false);
    stopListening();
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
      
      stopListening();
    };
  }, [stopListening]);

  const toggleRecording = () => {
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
