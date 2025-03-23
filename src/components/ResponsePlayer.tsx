
import React, { useState, useRef, useEffect } from "react";
import { useSession } from "@/context/SessionContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, PlayCircle, Code, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { detectBrowserAudioSupport } from "@/utils/audioUtils";

const ResponsePlayer: React.FC = () => {
  const { responses, isSessionActive } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [audioPlaybackError, setAudioPlaybackError] = useState<string | null>(null);
  const [audioFormats, setAudioFormats] = useState<Record<string, boolean>>({});
  
  // Auto-scroll to bottom when new responses are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [responses]);
  
  // Detect browser supported audio formats
  useEffect(() => {
    const supportedFormats = detectBrowserAudioSupport();
    console.log("Browser supported audio formats:", supportedFormats);
    setAudioFormats(supportedFormats);
  }, []);
  
  // Setup the audio element
  useEffect(() => {
    const audio = new Audio();
    
    audio.addEventListener('ended', () => {
      console.log("Audio playback ended in ResponsePlayer");
      setCurrentPlayingId(null);
    });
    
    audio.addEventListener('error', (e) => {
      // Use proper type casting for the event target
      const mediaElement = e.target as HTMLMediaElement;
      const error = mediaElement.error;
      let errorMsg = "Unknown audio error";
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMsg = "Audio playback aborted";
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMsg = "Network error during audio playback";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMsg = "Audio decoding error";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMsg = "Audio format not supported";
            break;
        }
      }
      
      console.error("Audio playback error in ResponsePlayer:", {
        error: errorMsg,
        mediaError: error,
        src: mediaElement.src,
        currentSrc: mediaElement.currentSrc
      });
      
      setAudioPlaybackError(`${errorMsg}. The audio format may not be supported by your browser.`);
      setCurrentPlayingId(null);
    });
    
    audioRef.current = audio;
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.removeEventListener('ended', () => {});
        audioRef.current.removeEventListener('error', () => {});
      }
    };
  }, []);
  
  // Update muted state on the audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
    }
  }, [muted]);
  
  const playAudio = (response: typeof responses[0]) => {
    if (!response.audio_url || !audioRef.current) return;
    
    try {
      // Reset error state before playing
      setAudioPlaybackError(null);
      
      // If already playing this response, toggle pause/play
      if (currentPlayingId === response.id) {
        if (audioRef.current.paused) {
          audioRef.current.play()
            .then(() => {
              console.log(`Resumed playback for response ${response.id}`);
            })
            .catch(error => {
              console.error(`Error resuming audio for response ${response.id}:`, error);
              setAudioPlaybackError(`Error resuming playback: ${error.message}`);
              setCurrentPlayingId(null);
            });
        } else {
          audioRef.current.pause();
          setCurrentPlayingId(null);
        }
      } else {
        // Stop any existing playback
        if (audioRef.current.src) {
          audioRef.current.pause();
        }
        
        // Play a different response
        console.log(`Starting playback for response ${response.id} with URL:`, response.audio_url);
        
        // Get the format from raw data if available
        const detectedFormat = response.raw_data?.detectedType || response.raw_data?.type || "unknown format";
        console.log(`Audio format from response: ${detectedFormat}`);
        
        audioRef.current.src = response.audio_url;
        
        audioRef.current.play()
          .then(() => {
            setCurrentPlayingId(response.id);
            console.log(`Successfully started playback for response ${response.id}`);
          })
          .catch(error => {
            console.error(`Error playing audio for response ${response.id}:`, error);
            setAudioPlaybackError(`Playback error: ${error.message}. Format: ${detectedFormat}`);
            setCurrentPlayingId(null);
            
            // Could try alternative formats here if needed
          });
      }
    } catch (err) {
      console.error("Exception during audio playback setup:", err);
      setAudioPlaybackError(err instanceof Error ? err.message : String(err));
    }
  };
  
  const toggleMute = () => {
    setMuted(!muted);
  };
  
  // Display empty state for inactive session
  if (!isSessionActive) {
    return (
      <div className="h-full flex items-center justify-center glass-card rounded-lg p-6">
        <p className="text-muted-foreground text-center">
          Start a session to see responses
        </p>
      </div>
    );
  }
  
  // Display empty state for no responses
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
            <div className="flex gap-2">
              {audioPlaybackError && (
                <div className="text-xs text-destructive mr-2">
                  Audio error: {audioPlaybackError}
                </div>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2"
                onClick={toggleMute}
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </Button>
            </div>
          </div>
          
          {audioPlaybackError && (
            <Alert variant="destructive" className="mb-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Audio Playback Issue</AlertTitle>
              <AlertDescription>
                {audioPlaybackError}. Try a different browser or check your audio settings.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Browser supported formats info */}
          <Alert variant="default" className="mb-4 bg-primary/10">
            <Info className="h-4 w-4" />
            <AlertTitle>Audio Format Support</AlertTitle>
            <AlertDescription className="text-xs">
              Your browser supports: {Object.entries(audioFormats)
                .filter(([_, supported]) => supported)
                .map(([format]) => format.toUpperCase())
                .join(', ')}
            </AlertDescription>
          </Alert>
          
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
              
              <div className="flex justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(response.timestamp).toLocaleTimeString()}
                </span>
                
                {/* Show raw data in an accordion if it exists */}
                {response.raw_data && (
                  <Accordion type="single" collapsible className="w-full max-w-sm">
                    <AccordionItem value="raw-data">
                      <AccordionTrigger className="text-xs">
                        <span className="flex items-center">
                          <Code size={12} className="mr-1" /> Raw Data
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <pre className="text-xs overflow-auto max-h-32 bg-background/50 p-2 rounded">
                          {JSON.stringify(response.raw_data, null, 2)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
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
