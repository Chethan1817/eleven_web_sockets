
import React from "react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useAuth } from "@/context/AuthContext";

const StatusIndicator: React.FC = () => {
  const { user } = useAuth();
  console.log("[StatusIndicator] User data:", user);
  const userId = user?.id ? String(user.id) : user?.phone_number || "";
  console.log("[StatusIndicator] Using userId:", userId);
  
  const { isConnected, isListening } = useVoiceAssistant(userId);
  console.log("[StatusIndicator] Current state:", { isConnected, isListening });

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
    </div>
  );
};

export default StatusIndicator;
