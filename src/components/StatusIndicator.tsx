
import React from "react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useAuth } from "@/context/AuthContext";

// Create a wrapper component to manage the hook instance
const StatusIndicatorContent: React.FC<{ userId: string }> = ({ userId }) => {
  const { isConnected, isListening, isPlaying } = useVoiceAssistant(userId);
  console.log("[StatusIndicator] Current state:", { isConnected, isListening, isPlaying });

  if (!isConnected && !isListening) {
    console.log("[StatusIndicator] Not connected or listening, not rendering");
    return null;
  }

  console.log("[StatusIndicator] Rendering status indicator");
  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center">
        <span
          className={`h-2 w-2 rounded-full ${
            isConnected ? "bg-green-500" : "bg-amber-500 animate-pulse"
          }`}
        />
        <span className="ml-2 text-xs text-muted-foreground">
          {isConnected ? "Connected" : "Connecting..."}
        </span>
      </div>
      
      {isPlaying && (
        <div className="ml-2 flex items-center">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="ml-2 text-xs text-muted-foreground">
            Playing
          </span>
        </div>
      )}
      
      <span className="text-xs text-muted-foreground ml-2">
        {userId ? `User: ${userId}` : "No User ID"}
      </span>
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
