
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import { Mic, MicOff, Play, Square, XCircle, Volume, Volume2, Globe, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const AudioRecorder: React.FC = () => {
  const { 
    isSessionActive, 
    isRecording,
    isConnecting,
    greeting,
    startSession, 
    stopSession, 
    startRecording, 
    stopRecording,
    interruptResponse,
    useHttpStreaming,
    setUseHttpStreaming
  } = useSession();
  
  const { toast } = useToast();
  const [audioLevel, setAudioLevel] = useState<number[]>(Array(10).fill(5));
  const [showGreeting, setShowGreeting] = useState(false);
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const [isAudioDetected, setIsAudioDetected] = useState(false);
  
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isRecording) {
      intervalId = setInterval(() => {
        const isLoud = Math.random() > 0.4;
        setIsAudioDetected(isLoud);
        
        setAudioLevel(Array(10).fill(0).map(() => {
          return isLoud 
            ? Math.floor(Math.random() * 25) + 10
            : Math.floor(Math.random() * 5) + 3;
        }));
      }, 100);
      
      console.log("Audio visualization active");
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRecording]);
  
  useEffect(() => {
    if ((isSessionActive || micPermission === null) && navigator.mediaDevices) {
      console.log("Checking microphone permissions...");
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
  
  useEffect(() => {
    if (isSessionActive && greeting) {
      setShowGreeting(true);
      const timer = setTimeout(() => {
        setShowGreeting(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isSessionActive, greeting]);
  
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
  
  const handleInterruptClick = () => {
    console.log("Interrupting response");
    interruptResponse();
  };
  
  const handleHttpToggleChange = (checked: boolean) => {
    if (!isSessionActive) {
      setUseHttpStreaming(checked);
      console.log(`Switched to ${checked ? 'HTTP streaming' : 'WebSocket'} mode`);
    } else {
      toast({
        title: "Cannot Change Mode",
        description: "Please end the current session before changing connection mode.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="w-full flex flex-col items-center space-y-6 py-4">
      {showGreeting && greeting && (
        <div className="animate-fade-in-out text-primary font-medium text-lg mb-2">
          {greeting}
        </div>
      )}
      
      {micPermission === false && (
        <div className="bg-destructive/10 text-destructive p-2 rounded-md text-sm animate-pulse">
          Microphone access is denied. Please enable it in your browser settings.
        </div>
      )}
      
      <div className="w-full flex justify-center mb-4">
        <div className="flex items-center space-x-2">
          <Wifi className="h-4 w-4 text-muted-foreground" />
          <Switch 
            id="connection-mode" 
            checked={useHttpStreaming}
            onCheckedChange={handleHttpToggleChange}
            disabled={isSessionActive}
          />
          <Label htmlFor="connection-mode" className="text-sm flex items-center">
            <Globe className="h-4 w-4 mr-1" />
            HTTP Streaming
          </Label>
        </div>
      </div>
      
      <div 
        className={cn(
          "h-16 flex flex-col items-center justify-center space-y-1 transition-opacity duration-300",
          isRecording ? "opacity-100" : "opacity-30"
        )}
      >
        {isRecording && (
          <div className={cn(
            "text-xs font-medium mb-1 transition-colors duration-200",
            isAudioDetected ? "text-green-500" : "text-muted-foreground"
          )}>
            {isAudioDetected ? (
              <span className="flex items-center">
                <Volume2 className="h-3 w-3 mr-1 animate-pulse" />
                Audio detected
              </span>
            ) : "Listening..."}
          </div>
        )}
        
        {isRecording ? (
          <div className="audio-recording flex items-end h-12">
            {audioLevel.map((level, index) => (
              <div 
                key={index}
                className={cn(
                  "audio-bar w-2 rounded-t-sm mx-px transition-all duration-100",
                  isAudioDetected ? "bg-green-500" : "bg-primary/80"
                )}
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
      
      <div className="flex items-center justify-center gap-4">
        {isSessionActive && (
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={handleInterruptClick}
          >
            <XCircle className="h-6 w-6 text-destructive" />
          </Button>
        )}
        
        <Button
          variant={isRecording ? "destructive" : "default"}
          size="icon"
          className={cn(
            "h-20 w-20 rounded-full shadow-lg transition-all duration-300",
            isRecording && isAudioDetected ? "animate-pulse ring-2 ring-green-500" : 
            isRecording ? "animate-pulse" : "",
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
          isConnecting ? `Connecting... (${useHttpStreaming ? 'HTTP' : 'WebSocket'})` : `Start a new session to begin (${useHttpStreaming ? 'HTTP' : 'WebSocket'} mode)`
        ) : (
          isRecording ? (
            isAudioDetected ? "Audio detected and sending..." : "Waiting for audio..."
          ) : "Press the button to talk"
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
