
import React from "react";
import { useSession } from "@/context/SessionContext";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2, CheckCircle2, Clock, AlertTriangle, Wifi, WifiOff } from "lucide-react";

const StatusIndicator: React.FC = () => {
  const { 
    isSessionActive, 
    isRecording,
    isConnecting, 
    isProcessing,
    websocket
  } = useSession();
  
  // Check WebSocket connection state
  const wsState = websocket ? websocket.readyState : -1;
  const wsConnected = wsState === WebSocket.OPEN;
  const wsConnecting = wsState === WebSocket.CONNECTING;
  
  // Idle state
  if (!isSessionActive && !isConnecting) {
    return (
      <Badge variant="outline" className="bg-secondary/50 px-3 py-1">
        <Clock className="h-3 w-3 mr-1" />
        <span>Idle</span>
      </Badge>
    );
  }
  
  // Connecting state
  if (isConnecting || wsConnecting) {
    return (
      <Badge variant="outline" className="bg-primary/10 text-primary px-3 py-1">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        <span>Connecting...</span>
      </Badge>
    );
  }
  
  // WebSocket connection issue
  if (isSessionActive && !wsConnected) {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 px-3 py-1">
        <AlertTriangle className="h-3 w-3 mr-1" />
        <span>Connection Issue</span>
      </Badge>
    );
  }
  
  // Recording state
  if (isSessionActive && isRecording) {
    return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive px-3 py-1 animate-pulse">
        <Activity className="h-3 w-3 mr-1" />
        <span>Recording</span>
      </Badge>
    );
  }
  
  // Processing state
  if (isSessionActive && isProcessing) {
    return (
      <Badge variant="outline" className="bg-primary/20 text-primary px-3 py-1">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        <span>Processing</span>
      </Badge>
    );
  }
  
  // Connected state
  if (isSessionActive && wsConnected) {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 px-3 py-1">
        <Wifi className="h-3 w-3 mr-1" />
        <span>Connected</span>
      </Badge>
    );
  }
  
  // Disconnected state (fallback)
  return (
    <Badge variant="outline" className="bg-secondary/50 px-3 py-1">
      <WifiOff className="h-3 w-3 mr-1" />
      <span>Disconnected</span>
    </Badge>
  );
};

export default StatusIndicator;
