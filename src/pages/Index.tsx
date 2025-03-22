
import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import Header from "@/components/Header";
import AudioRecorder from "@/components/AudioRecorder";
import TranscriptDisplay from "@/components/TranscriptDisplay";
import ResponsePlayer from "@/components/ResponsePlayer";

const Index: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { clearSession } = useSession();
  
  // Clear session data when page loads
  useEffect(() => {
    clearSession();
  }, [clearSession]);
  
  // If loading, show a loading indicator
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }
  
  // If not authenticated, redirect to auth page
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background to-secondary/30">
      <Header />
      
      <main className="flex-1 container max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
          <div className="flex flex-col space-y-6">
            <div className="glass-card p-6 rounded-lg shadow-sm animate-slide-up">
              <h2 className="text-2xl font-medium mb-4">Audio Testing Interface</h2>
              <p className="text-muted-foreground mb-6">
                Use this interface to test the audio pipeline from recording to transcript generation and response.
              </p>
              
              <AudioRecorder />
            </div>
            
            <div className="flex-1 animate-slide-up" style={{ animationDelay: "100ms" }}>
              <ResponsePlayer />
            </div>
          </div>
          
          <div className="h-[calc(100vh-16rem)] animate-slide-up" style={{ animationDelay: "200ms" }}>
            <TranscriptDisplay />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
