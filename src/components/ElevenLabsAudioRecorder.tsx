import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader, Volume2 } from "lucide-react";
import { useElevenLabsVoiceAssistant } from "@/hooks/useElevenLabsVoiceAssistant";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import StatusIndicator from "@/components/ElevenLabsStatusIndicator";
import AudioWaveform from "@/components/AudioWaveform";

const ElevenLabsAudioRecorder: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : user?.phone_number || "";
  const { toast } = useToast();
  
  const [showLogs, setShowLogs] = useState(false);
  const [audioVisualizationData, setAudioVisualizationData] = useState<Uint8Array>(new Uint8Array(50).fill(0));
  
  const { 
    isConnected, 
    isListening, 
    isPlaying, 
    startListening, 
    stopListening,
    micLevel,
    logs,
    conversation
  } = useElevenLabsVoiceAssistant(userId);

  // Update visualization data based on mic level
  useEffect(() => {
    // Create randomized visualization data based on the mic level
    if (micLevel > 0 && !isPlaying) {
      const newData = new Uint8Array(50);
      for (let i = 0; i < 50; i++) {
        // Create a wave-like pattern based on mic level
        const baseLevel = micLevel * 2.5; // Scale up for better visibility
        const variation = Math.sin(i / 5 + Date.now() / 200) * 20; // Add wave pattern
        newData[i] = Math.min(255, Math.max(0, baseLevel + variation));
      }
      setAudioVisualizationData(newData);
    } else if (isPlaying) {
      // Simulate speech visualization when agent is speaking
      const newData = new Uint8Array(50);
      for (let i = 0; i < 50; i++) {
        const baseLevel = 60; // Base level for speech
        const variation = Math.sin(i / 3 + Date.now() / 100) * 40 * Math.random(); // More dynamic pattern
        newData[i] = Math.min(255, Math.max(0, baseLevel + variation));
      }
      setAudioVisualizationData(newData);
    } else {
      // Idle state - low amplitude waves
      const newData = new Uint8Array(50);
      for (let i = 0; i < 50; i++) {
        const baseLevel = 5; // Very low base level
        const variation = Math.sin(i / 8 + Date.now() / 500) * 10; // Gentle waves
        newData[i] = Math.max(0, baseLevel + variation);
      }
      setAudioVisualizationData(newData);
    }
    
    // Update visualization regularly
    const animationId = requestAnimationFrame(() => {});
    return () => cancelAnimationFrame(animationId);
  }, [micLevel, isPlaying]);

  const toggleVoiceAssistant = async () => {
    if (!isListening) {
      await startListening();
    } else {
      await stopListening();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-lg mx-auto">
        {/* Audio Waveform Visualization */}
        <AudioWaveform 
          audioData={audioVisualizationData}
          isRecording={isListening && !isPlaying}
          isPlaying={isPlaying}
        />
        
        <div className="relative mb-4 mt-4 flex justify-center">
          <Button
            onClick={toggleVoiceAssistant}
            variant={isListening ? "destructive" : "default"}
            size="lg"
            className={`rounded-full h-16 w-16 flex items-center justify-center ${isPlaying ? 'animate-pulse shadow-lg' : 'shadow-md'}`}
            disabled={isPlaying}
          >
            {isListening ? <MicOff size={24} /> : <Mic size={24} />}
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
        
        {/* Status indicator */}
        <div className="text-center mb-4">
          <div className="text-sm font-medium">
            {isListening ? (
              isConnected ? (
                isPlaying ? 
                <div className="flex items-center justify-center gap-2 text-primary animate-pulse">
                  <Volume2 className="h-4 w-4" />
                  <span>Assistant is speaking...</span>
                </div> : 
                <div className="text-green-500">Listening...</div>
              ) : (
                <div className="text-amber-500">Connecting...</div>
              )
            ) : (
              <div className="text-muted-foreground">Tap to speak</div>
            )}
          </div>
        </div>
        
        {/* Microphone level indicator */}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
          <div 
            className={`h-full transition-all duration-100 ${
              micLevel > 80 ? 'bg-red-500' : 
              micLevel > 40 ? 'bg-orange-500' : 
              'bg-green-500'
            }`}
            style={{ width: `${micLevel}%` }}
          />
        </div>
        
        {/* Session ID indicator (if connected) */}
        {conversation && (
          <div className="text-center text-xs text-muted-foreground mb-4">
            Session ID: {conversation.getId()}
          </div>
        )}
      </div>

      {/* Debug logs toggle button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setShowLogs(!showLogs)}
        className="mt-2"
      >
        {showLogs ? "Hide Logs" : "Show Logs"}
      </Button>

      {/* Debug logs */}
      {showLogs && logs.length > 0 && (
        <Card className="w-full mt-4 max-h-80 overflow-y-auto p-4 bg-black text-green-500 font-mono text-xs">
          {logs.map((log, i) => (
            <div key={i} className="whitespace-pre-wrap">{log}</div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default ElevenLabsAudioRecorder;