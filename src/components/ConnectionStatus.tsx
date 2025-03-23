
import React, { useState, useEffect } from "react";
import { useSession } from "@/context/SessionContext";
import { Badge } from "@/components/ui/badge";
import { Loader2, WifiOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const ConnectionStatus: React.FC = () => {
  const { 
    isSessionActive, 
    isConnecting,
    streamController,
    useHttpStreaming,
    startSession
  } = useSession();
  
  const { toast } = useToast();
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [showRetry, setShowRetry] = useState(false);
  
  // Track connection attempts and show retry button if needed
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isConnecting) {
      setConnectionAttempts(prev => prev + 1);
      
      // After 10 seconds of connecting, offer a retry button
      timeoutId = setTimeout(() => {
        if (isConnecting) {
          console.log("Connection attempt taking too long, showing retry option");
          setShowRetry(true);
        }
      }, 10000);
    } else {
      setShowRetry(false);
      // Reset counter when not connecting
      if (!isSessionActive) {
        setConnectionAttempts(0);
      }
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isConnecting, isSessionActive]);
  
  // Log details for debugging
  console.log("ConnectionStatus rendering with state:", { 
    isSessionActive, 
    isConnecting, 
    hasStreamController: !!streamController,
    useHttpStreaming,
    connectionAttempts,
    showRetry,
    renderTime: new Date().toISOString()
  });
  
  const handleRetryConnection = () => {
    console.log("Manually retrying connection");
    setShowRetry(false);
    
    toast({
      title: "Retrying Connection",
      description: "Attempting to reconnect to the server...",
    });
    
    // Retry connection by starting a new session
    startSession();
  };
  
  // Handle connecting state with retry option
  if (isConnecting) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Badge variant="outline" className="bg-primary/10 text-primary px-3 py-1">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          <span>
            Connecting{connectionAttempts > 1 ? ` (Attempt ${connectionAttempts})` : "..."}
          </span>
        </Badge>
        
        {showRetry && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-6 px-2 text-primary"
            onClick={handleRetryConnection}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }
  
  // Handle connected state
  if (isSessionActive && (useHttpStreaming ? streamController : true)) {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 px-3 py-1">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        <span>Connected {useHttpStreaming ? "(HTTP)" : "(WebSocket)"}</span>
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
