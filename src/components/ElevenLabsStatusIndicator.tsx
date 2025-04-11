import React from "react";
import { useElevenLabsVoiceAssistant } from "@/hooks/useElevenLabsVoiceAssistant";
import { useAuth } from "@/context/AuthContext";
import { Mic, Volume2, Wifi } from "lucide-react";

// Create a wrapper component to manage the hook instance
const ElevenLabsStatusIndicatorContent: React.FC<{ userId: string }> = ({ userId }) => {
  const { isConnected, isListening, isPlaying, micLevel } = useElevenLabsVoiceAssistant(userId);
  
  if (!isConnected && !isListening) {
    return null;
  }

  return (
    <div className="flex items-center justify-center space-x-2 p-2 bg-secondary/60 backdrop-blur-md rounded-full mb-4 shadow-sm w-full max-w-sm mx-auto">
      <div className="flex items-center">
        <Wifi 
          className={`h-3 w-3 mr-1 ${isConnected ? "text-green-500" : "text-amber-500 animate-pulse"}`} 
        />
        <span className="text-xs text-muted-foreground">
          {isConnected ? "Connected to ElevenLabs" : "Connecting..."}
        </span>
      </div>
      
      {isPlaying && (
        <div className="flex items-center">
          <Volume2 className="h-3 w-3 text-blue-500 animate-pulse mr-1" />
          <span className="text-xs text-muted-foreground">
            Assistant Speaking
          </span>
        </div>
      )}
      
      {isListening && !isPlaying && (
        <div className="flex items-center">
          <Mic className="h-3 w-3 text-green-500 animate-pulse mr-1" />
          <span className="text-xs text-muted-foreground">
            Listening
          </span>
        </div>
      )}
      
      {micLevel > 0 && (
        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div 
            className={`h-full ${micLevel > 80 ? 'bg-red-500' : micLevel > 40 ? 'bg-orange-500' : 'bg-green-500'} transition-all duration-100`}
            style={{ width: `${Math.min(micLevel, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

// Main component that manages whether to render the content
const ElevenLabsStatusIndicator: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : user?.phone_number || "";
  
  if (!userId) {
    return null;
  }

  return <ElevenLabsStatusIndicatorContent userId={userId} />;
};

export default ElevenLabsStatusIndicator;