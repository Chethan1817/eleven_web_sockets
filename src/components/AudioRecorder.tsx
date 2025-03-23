
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import { Mic, MicOff, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const AudioRecorder: React.FC = () => {
  const { 
    isSessionActive, 
    isRecording,
    isConnecting,
    greeting,
    startSession, 
    stopSession, 
    startRecording, 
    stopRecording 
  } = useSession();
  
  const { toast } = useToast();
  const [audioLevel, setAudioLevel] = useState<number[]>(Array(10).fill(5));
  const [showGreeting, setShowGreeting] = useState(false);
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  
  // Simulate audio levels when recording
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isRecording) {
      intervalId = setInterval(() => {
        setAudioLevel(Array(10).fill(0).map(() => Math.floor(Math.random() * 25) + 5));
      }, 100);
      
      console.log("Audio visualization active");
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRecording]);
  
  // Check microphone permissions
  useEffect(() => {
    if (isSessionActive && micPermission === null) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          console.log("Microphone permission granted");
          setMicPermission(true);
        })
        .catch((error) => {
          console.error("Microphone permission denied:", error);
          setMicPermission(false);
          toast({
            title: "Microphone Access Denied",
            description: "Please enable microphone access in your browser settings to use the recording feature.",
            variant: "destructive",
          });
        });
    }
  }, [isSessionActive, micPermission, toast]);
  
  // Show greeting when session becomes active
  useEffect(() => {
    if (isSessionActive && greeting) {
      setShowGreeting(true);
      const timer = setTimeout(() => {
        setShowGreeting(false);
      }, 5000); // Hide greeting after 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [isSessionActive, greeting]);
  
  // Single button handler for all audio actions
  const handleTalkButtonClick = () => {
    if (!isSessionActive) {
      console.log("Starting new session");
      startSession();
    } else if (isRecording) {
      console.log("Stopping recording");
      stopRecording();
    } else {
      console.log("Starting recording");
      startRecording();
    }
  };
  
  return (
    <div className="w-full flex flex-col items-center space-y-6 py-4">
      {/* Greeting Message */}
      {showGreeting && greeting && (
        <div className="animate-fade-in-out text-primary font-medium text-lg mb-2">
          {greeting}
        </div>
      )}
      
      {/* Microphone Permission Warning */}
      {micPermission === false && (
        <div className="bg-destructive/10 text-destructive p-2 rounded-md text-sm animate-pulse">
          Microphone access is denied. Please enable it in your browser settings.
        </div>
      )}
      
      {/* Audio Visualization */}
      <div 
        className={cn(
          "h-16 flex items-center justify-center space-x-1 transition-opacity duration-300",
          isRecording ? "opacity-100" : "opacity-30"
        )}
      >
        {isRecording ? (
          <div className="audio-recording flex items-end h-16">
            {audioLevel.map((level, index) => (
              <div 
                key={index}
                className="audio-bar bg-primary/80 w-2 rounded-t-sm mx-px transition-all duration-100"
                style={{ 
                  '--index': index,
                  height: `${level}px` 
                } as React.CSSProperties}
              />
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground">
            {isSessionActive ? "Ready to record" : "Start session to record"}
          </div>
        )}
      </div>
      
      {/* Single Button UI */}
      <div className="flex items-center justify-center">
        <Button
          variant={isRecording ? "destructive" : "default"}
          size="icon"
          className={cn(
            "h-20 w-20 rounded-full shadow-lg transition-all duration-300",
            isRecording && "animate-pulse",
            isConnecting && "opacity-70"
          )}
          onClick={handleTalkButtonClick}
          disabled={isConnecting || micPermission === false}
        >
          {!isSessionActive ? (
            <Play className="h-8 w-8" />
          ) : isRecording ? (
            <MicOff className="h-8 w-8" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </Button>
      </div>
      
      {/* Session Controls */}
      {isSessionActive && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={stopSession}
          disabled={isConnecting}
        >
          <Square className="h-4 w-4 mr-2" />
          End Session
        </Button>
      )}
      
      <div className="text-xs text-muted-foreground">
        {!isSessionActive ? (
          isConnecting ? "Connecting..." : "Start a new session to begin"
        ) : (
          isRecording ? "Recording audio..." : "Press the button to talk"
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
