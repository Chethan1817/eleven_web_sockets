
import React from "react";
import { useSession } from "@/context/SessionContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Activity, Loader2, CheckCircle2, Clock } from "lucide-react";

const StatusIndicator: React.FC = () => {
  const { 
    isSessionActive, 
    isRecording,
    isConnecting, 
    isProcessing 
  } = useSession();
  
  if (!isSessionActive && !isConnecting) {
    return (
      <Badge variant="outline" className="bg-secondary/50 px-3 py-1">
        <Clock className="h-3 w-3 mr-1" />
        <span>Idle</span>
      </Badge>
    );
  }
  
  if (isConnecting) {
    return (
      <Badge variant="outline" className="bg-primary/10 text-primary px-3 py-1">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        <span>Connecting</span>
      </Badge>
    );
  }
  
  if (isSessionActive && isRecording) {
    return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive px-3 py-1 animate-pulse">
        <Activity className="h-3 w-3 mr-1" />
        <span>Recording</span>
      </Badge>
    );
  }
  
  if (isSessionActive && isProcessing) {
    return (
      <Badge variant="outline" className="bg-primary/20 text-primary px-3 py-1">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        <span>Processing</span>
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="bg-green-500/10 text-green-600 px-3 py-1">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      <span>Ready</span>
    </Badge>
  );
};

export default StatusIndicator;
