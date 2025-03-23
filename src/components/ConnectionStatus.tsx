
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
  
  console.log("ConnectionStatus rendering with:", { 
    isSessionActive, 
    isConnecting, 
    hasStreamController: !!streamController 
  });
  
  if (isConnecting) {
    return (
      <Badge variant="outline" className="bg-primary/10 text-primary px-3 py-1">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        <span>Connecting...</span>
      </Badge>
    );
  }
  
  if (isSessionActive && streamController) {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 px-3 py-1">
        <Globe className="h-3 w-3 mr-1" />
        <span>Connected (HTTP)</span>
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="bg-secondary/50 px-3 py-1">
      <WifiOff className="h-3 w-3 mr-1" />
      <span>Disconnected</span>
    </Badge>
  );
};

export default ConnectionStatus;
