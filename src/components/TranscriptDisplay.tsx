
import React, { useEffect, useRef } from "react";
import { useSession } from "@/context/SessionContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const TranscriptDisplay: React.FC = () => {
  const { transcripts, isSessionActive } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new transcripts are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);
  
  if (!isSessionActive) {
    return (
      <div className="h-full flex items-center justify-center glass-card rounded-lg p-6">
        <p className="text-muted-foreground text-center">
          Start a session to see transcripts
        </p>
      </div>
    );
  }
  
  if (transcripts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center glass-card rounded-lg p-6">
        <p className="text-muted-foreground text-center">
          No transcripts yet. Start speaking to generate transcripts.
        </p>
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-full glass-card rounded-lg p-6" ref={scrollRef}>
      <div className="space-y-4">
        <h3 className="text-lg font-medium border-b pb-2 mb-4">Real-time Transcripts</h3>
        
        {transcripts.map((transcript) => (
          <div
            key={transcript.id}
            className={cn(
              "p-3 rounded-lg mb-3 animate-fade-in",
              transcript.is_final 
                ? "bg-secondary/70 backdrop-blur-sm" 
                : "bg-secondary/30 border border-dashed border-primary/20"
            )}
          >
            <p className="text-sm mb-1">{transcript.text}</p>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-muted-foreground">
                {new Date(transcript.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {transcript.is_final ? "Final" : "Processing..."}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default TranscriptDisplay;
