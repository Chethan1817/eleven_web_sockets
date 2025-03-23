
import React from "react";
import { useSession } from "@/context/SessionContext";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, WifiOff } from "lucide-react";

const ConnectionStatus: React.FC = () => {
  const { 
    isSessionActive, 
    isConnecting,
    streamController
  } = useSession();
  
  // Use a more detailed debug log to track rendering and props
  console.log("ConnectionStatus rendering with detailed state:", { 
    isSessionActive, 
    isConnecting, 
    hasStreamController: !!streamController,
    sessionActiveRef: sessionActiveRef?.current,
    renderTime: new Date().toISOString()
  });
  
  // Handle connecting state
  if (isConnecting) {
    return (
      <Badge variant="outline" className="bg-primary/10 text-primary px-3 py-1">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        <span>Connecting...</span>
      </Badge>
    );
  }
  
  // Handle connected state - this requires both isSessionActive AND streamController
  if (isSessionActive && streamController) {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 px-3 py-1">
        <Globe className="h-3 w-3 mr-1" />
        <span>Connected (HTTP)</span>
      </Badge>
    );
  }
  
  // Disconnected state - default fallback
  return (
    <Badge variant="outline" className="bg-secondary/50 px-3 py-1">
      <WifiOff className="h-3 w-3 mr-1" />
      <span>Disconnected</span>
    </Badge>
  );
};

export default ConnectionStatus;
