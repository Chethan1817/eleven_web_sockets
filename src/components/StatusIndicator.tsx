
import React from "react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useAuth } from "@/context/AuthContext";
import { Mic, Volume2, Wifi } from "lucide-react";

// Create a wrapper component to manage the hook instance
const StatusIndicatorContent: React.FC<{ userId: string }> = ({ userId }) => {
  const { isConnected, isListening, isPlaying, micLevel } = useVoiceAssistant(userId);
  console.log("[StatusIndicator] Current state:", { isConnected, isListening, isPlaying, micLevel });

  if (!isConnected && !isListening) {
    console.log("[StatusIndicator] Not connected or listening, not rendering");
    return null;
  }

  console.log("[StatusIndicator] Rendering status indicator");
  return (
    <div className="flex items-center justify-center space-x-2 p-2 bg-secondary/60 backdrop-blur-md rounded-full mb-4 shadow-sm w-full max-w-sm mx-auto">
      <div className="flex items-center">
        <Wifi 
          className={`h-3 w-3 mr-1 ${isConnected ? "text-green-500" : "text-amber-500 animate-pulse"}`} 
        />
        <span className="text-xs text-muted-foreground">
          {isConnected ? "Connected" : "Connecting..."}
        </span>
      </div>
      
      {isPlaying && (
        <div className="flex items-center">
          <Volume2 className="h-3 w-3 text-blue-500 animate-pulse mr-1" />
          <span className="text-xs text-muted-foreground">
            Playing
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
const StatusIndicator: React.FC = () => {
  const { user } = useAuth();
  console.log("[StatusIndicator] User data:", user);
  const userId = user?.id ? String(user.id) : user?.phone_number || "";
  console.log("[StatusIndicator] Using userId:", userId);
  
  if (!userId) {
    return null;
  }

  return <StatusIndicatorContent userId={userId} />;
};

export default StatusIndicator;
