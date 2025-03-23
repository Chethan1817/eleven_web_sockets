
import React, { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import Header from "@/components/Header";
import AudioRecorder from "@/components/AudioRecorder";
import TranscriptDisplay from "@/components/TranscriptDisplay";
import ResponsePlayer from "@/components/ResponsePlayer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Code } from "lucide-react";

const Index: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { clearSession, responses } = useSession();
  const [showDebug, setShowDebug] = React.useState(false);
  const initialLoadRef = useRef(true);
  
  // Clear session data when page loads, but only once
  useEffect(() => {
    // Only clear the session once when the component mounts
    if (initialLoadRef.current) {
      console.log("Initial page load - clearing session");
      clearSession();
      initialLoadRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
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
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-medium">Audio Testing Interface</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDebug(!showDebug)}
                  className="flex items-center gap-1"
                >
                  <Code size={16} />
                  {showDebug ? "Hide Debug" : "Show Debug"}
                </Button>
              </div>
              
              <p className="text-muted-foreground mb-6">
                Use this interface to test the audio pipeline from recording to transcript generation and response.
              </p>
              
              <AudioRecorder />
              
              {showDebug && (
                <Accordion type="single" collapsible className="mt-4">
                  <AccordionItem value="debug-info">
                    <AccordionTrigger>Debug Information</AccordionTrigger>
                    <AccordionContent>
                      <div className="bg-background/80 p-3 rounded text-xs font-mono overflow-x-auto">
                        <h4 className="font-semibold mb-2">Response Data ({responses.length} responses):</h4>
                        <pre className="overflow-x-auto max-h-60">
                          {JSON.stringify(responses, null, 2)}
                        </pre>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
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
