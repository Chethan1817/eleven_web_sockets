
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import StatusIndicator from "@/components/StatusIndicator";
import AudioRecorder from "@/components/AudioRecorder";
import TranscriptDisplay from "@/components/TranscriptDisplay";
import ResponsePlayer from "@/components/ResponsePlayer";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  
  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="bg-card/50 backdrop-blur-sm border border-primary/10 mb-6">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-medium">Audio Streaming Demo</h2>
            <StatusIndicator />
          </div>
          
          <div className="mt-2 text-sm text-muted-foreground">
            WebSocket-based real-time audio communication with the Django backend
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="bg-card/50 backdrop-blur-sm border border-primary/10">
            <CardContent className="p-4">
              <AudioRecorder />
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card className="h-64 bg-card/50 backdrop-blur-sm border border-primary/10">
            <CardContent className="p-4 h-full">
              <TranscriptDisplay />
            </CardContent>
          </Card>
          
          <Card className="h-64 bg-card/50 backdrop-blur-sm border border-primary/10">
            <CardContent className="p-4 h-full">
              <ResponsePlayer />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
