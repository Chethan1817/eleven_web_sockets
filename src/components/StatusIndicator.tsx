
import React from "react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useAuth } from "@/context/AuthContext";

const StatusIndicator: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.phone_number || "";
  const { isConnected, isListening } = useVoiceAssistant(userId);

  if (!isConnected && !isListening) return null;

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
