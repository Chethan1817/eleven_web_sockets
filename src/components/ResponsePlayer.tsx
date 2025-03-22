
import React, { useState, useRef, useEffect } from "react";
import { useSession } from "@/context/SessionContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ResponsePlayer: React.FC = () => {
  const { responses, isSessionActive } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  
  // Auto-scroll to bottom when new responses are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    
    // Auto-play the latest response if there's an audio URL and not muted
    const latestResponse = responses[responses.length - 1];
    if (
      latestResponse?.audio_url && 
      !muted && 
      !currentPlayingId &&
      audioRef.current
    ) {
      audioRef.current.src = latestResponse.audio_url;
      audioRef.current.play()
        .then(() => {
          setCurrentPlayingId(latestResponse.id);
        })
        .catch(console.error);
    }
  }, [responses, muted, currentPlayingId]);
  
  // Handle audio playback end
  useEffect(() => {
    const handleEnded = () => {
      setCurrentPlayingId(null);
    };
    
    if (audioRef.current) {
      audioRef.current.addEventListener('ended', handleEnded);
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleEnded);
      }
    };
  }, []);
  
  const playAudio = (response: typeof responses[0]) => {
    if (!response.audio_url || !audioRef.current) return;
    
    // If already playing this response, toggle pause/play
    if (currentPlayingId === response.id) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
        setCurrentPlayingId(null);
      }
    } else {
      // Play a different response
      audioRef.current.src = response.audio_url;
      audioRef.current.play()
        .then(() => {
          setCurrentPlayingId(response.id);
        })
        .catch(console.error);
    }
  };
  
  const toggleMute = () => {
    setMuted(!muted);
    if (audioRef.current) {
      audioRef.current.muted = !muted;
    }
  };
  
  if (!isSessionActive) {
    return (
      <div className="h-full flex items-center justify-center glass-card rounded-lg p-6">
        <p className="text-muted-foreground text-center">
          Start a session to see responses
        </p>
      </div>
    );
  }
  
  if (responses.length === 0) {
    return (
      <div className="h-full flex items-center justify-center glass-card rounded-lg p-6">
        <p className="text-muted-foreground text-center">
          No responses yet. Responses will appear here after processing your audio.
        </p>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 glass-card rounded-lg p-6" ref={scrollRef}>
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-2 mb-4">
            <h3 className="text-lg font-medium">Responses</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2"
              onClick={toggleMute}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </Button>
          </div>
          
          {responses.map((response) => (
            <div
              key={response.id}
              className={cn(
                "p-4 rounded-lg mb-3 animate-fade-in",
                response.type === "quick" 
                  ? "bg-primary/10 backdrop-blur-sm" 
                  : "bg-secondary/70 backdrop-blur-sm"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <span 
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    response.type === "quick"
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary/50 text-secondary-foreground"
                  )}
                >
                  {response.type === "quick" ? "Quick Response" : "Main Response"}
                </span>
                {response.audio_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0 rounded-full",
                      currentPlayingId === response.id && "text-primary"
                    )}
                    onClick={() => playAudio(response)}
                  >
                    <PlayCircle size={18} />
                  </Button>
                )}
              </div>
              
              <p className="text-sm">{response.text}</p>
              
              <div className="flex justify-end mt-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(response.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <audio ref={audioRef} className="hidden" />
    </div>
  );
};

export default ResponsePlayer;
