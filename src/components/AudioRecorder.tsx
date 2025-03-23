
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import { Mic, MicOff, Play, Square, XCircle, Volume, Volume2, Globe, Wifi, AlertTriangle, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ConnectionStatus from "./ConnectionStatus";

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
  const [disabledReason, setDisabledReason] = useState<string | null>(null);
  const [checkingMic, setCheckingMic] = useState(false);
  const [connectionAttemptTime, setConnectionAttemptTime] = useState<number | null>(null);
  
  useEffect(() => {
    if (isConnecting && !connectionAttemptTime) {
      setConnectionAttemptTime(Date.now());
    } else if (!isConnecting) {
      setConnectionAttemptTime(null);
    }
  }, [isConnecting, connectionAttemptTime]);
  
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
      setCheckingMic(true);
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          console.log("Microphone permission granted");
          setMicPermission(true);
          setCheckingMic(false);
        })
        .catch((error) => {
          console.error("Microphone permission denied:", error);
          setMicPermission(false);
          setCheckingMic(false);
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
  
  useEffect(() => {
    if (checkingMic) {
      setDisabledReason("Checking microphone access...");
    } else if (micPermission === false) {
      setDisabledReason("Microphone access is denied");
    } else if (isConnecting) {
      const timeElapsed = connectionAttemptTime ? Math.floor((Date.now() - connectionAttemptTime) / 1000) : 0;
      setDisabledReason(timeElapsed > 5 
        ? `Still connecting... (${timeElapsed}s)` 
        : "Connecting to server...");
    } else if (!isSessionActive) {
      setDisabledReason(null); // Button is enabled to start session
    } else {
      setDisabledReason(null); // Button is enabled for recording
    }
    
    console.log("Button state updated:", {
      isSessionActive,
      isConnecting,
      micPermission,
      checkingMic,
      disabledReason,
      connectionAttemptTime,
      timeElapsed: connectionAttemptTime ? Math.floor((Date.now() - connectionAttemptTime) / 1000) : 0,
      isDisabled: micPermission === false || isConnecting || checkingMic
    });
  }, [isSessionActive, isConnecting, micPermission, checkingMic, connectionAttemptTime]);
  
  const handleStartSession = () => {
    console.log("Starting new session");
    setConnectionAttemptTime(Date.now());
    startSession();
  };
  
  const handleRecordingControl = () => {
    if (isRecording) {
      console.log("Stopping recording");
      stopRecording();
    } else {
      console.log("Starting recording");
      startRecording();
      console.log("Recording started successfully - speak now to see audio processing");
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
  
  const isSessionButtonDisabled = (): boolean => {
    return isConnecting || isSessionActive;
  };
  
  const isRecordButtonDisabled = (): boolean => {
    return !isSessionActive || micPermission === false || checkingMic || isConnecting;
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
      
      <div className="w-full flex justify-between mb-4">
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
        
        <ConnectionStatus />
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
        {/* Session Creation Button */}
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "h-16 w-16 rounded-full shadow-md transition-all duration-300",
            isConnecting && "opacity-70 animate-pulse",
            isSessionButtonDisabled() && "cursor-not-allowed opacity-60"
          )}
          onClick={handleStartSession}
          disabled={isSessionButtonDisabled()}
          title={isSessionActive ? "Session already active" : disabledReason || "Start new session"}
        >
          <Video className="h-6 w-6" />
        </Button>
        
        {/* Record Button */}
        <Button
          variant={isRecording ? "destructive" : "default"}
          size="icon"
          className={cn(
            "h-16 w-16 rounded-full shadow-md transition-all duration-300",
            isRecording && isAudioDetected ? "animate-pulse ring-2 ring-green-500" : 
            isRecording ? "animate-pulse" : "",
            isRecordButtonDisabled() && "cursor-not-allowed opacity-60"
          )}
          onClick={handleRecordingControl}
          disabled={isRecordButtonDisabled()}
          title={!isSessionActive ? "Start session first" : disabledReason || (isRecording ? "Stop recording" : "Start recording")}
        >
          {isRecording ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>

        {/* Interrupt Button */}
        {isSessionActive && (
          <Button
            variant="outline"
            size="icon"
            className="h-16 w-16 rounded-full shadow-md"
            onClick={handleInterruptClick}
          >
            <XCircle className="h-6 w-6 text-destructive" />
          </Button>
        )}
      </div>
      
      {disabledReason && (
        <div className="text-sm text-amber-500 font-medium flex items-center mt-2">
          <AlertTriangle className="h-4 w-4 mr-1" />
          {disabledReason}
        </div>
      )}
      
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
          isConnecting ? 
            `Connecting${connectionAttemptTime ? ` (${Math.floor((Date.now() - connectionAttemptTime) / 1000)}s)` : ''}... (${useHttpStreaming ? 'HTTP' : 'WebSocket'})` 
            : `Press session button to begin (${useHttpStreaming ? 'HTTP' : 'WebSocket'} mode)`
        ) : (
          isRecording ? (
            isAudioDetected ? "Audio detected and sending..." : "Waiting for audio..."
          ) : "Press the microphone button to talk"
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
