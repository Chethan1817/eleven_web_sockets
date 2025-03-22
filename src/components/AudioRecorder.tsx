
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import { Mic, MicOff, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";

const AudioRecorder: React.FC = () => {
  const { 
    isSessionActive, 
    isRecording,
    isConnecting,
    startSession, 
    stopSession, 
    startRecording, 
    stopRecording 
  } = useSession();
  
  const [audioLevel, setAudioLevel] = useState<number[]>(Array(10).fill(5));
  
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
  
  const handleStartRecording = () => {
    console.log("Start recording button clicked");
    startRecording();
  };
  
  const handleStopRecording = () => {
    console.log("Stop recording button clicked");
    stopRecording();
  };
  
  return (
    <div className="w-full flex flex-col items-center space-y-6 py-4">
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
                className="audio-bar"
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
      
      <div className="flex items-center space-x-4">
        {isSessionActive ? (
          <>
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-full border-2 border-destructive hover:bg-destructive/10 transition-all duration-300"
              onClick={stopSession}
              disabled={isRecording}
            >
              <Square className="h-6 w-6 text-destructive" />
            </Button>
            
            <Button
              variant={isRecording ? "destructive" : "default"}
              size="icon"
              className={cn(
                "h-20 w-20 rounded-full shadow-lg transition-all duration-300",
                isRecording && "animate-pulse"
              )}
              onClick={isRecording ? handleStopRecording : handleStartRecording}
            >
              {isRecording ? (
                <MicOff className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
          </>
        ) : (
          <Button
            variant="default"
            size="lg"
            className="h-16 w-48 rounded-full shadow-lg transition-all duration-300 text-lg"
            onClick={startSession}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <span className="flex items-center">
                <div className="mr-2 h-4 w-4 rounded-full bg-white animate-pulse" />
                Connecting...
              </span>
            ) : (
              <span className="flex items-center">
                <Play className="mr-2 h-5 w-5" />
                Start Session
              </span>
            )}
          </Button>
        )}
      </div>
      
      <div className="text-xs text-muted-foreground">
        {isSessionActive ? (
          isRecording ? "Recording audio..." : "Press the microphone button to start recording"
        ) : (
          "Start a new session to begin testing"
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
