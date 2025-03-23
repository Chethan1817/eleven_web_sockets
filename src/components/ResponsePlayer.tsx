
import React, { useState, useRef, useEffect } from "react";
import { useSession } from "@/context/SessionContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, PlayCircle, Code, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { detectBrowserAudioSupport, playAudio } from "@/utils/audioUtils";

const ResponsePlayer: React.FC = () => {
  const { responses, isSessionActive } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  
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
  
  const playResponseAudio = async (response: typeof responses[0]) => {
    if (!response.audio_url) return;
    
    try {
      // Reset error state before playing
      setAudioPlaybackError(null);
      
      // If already playing this response, stop it
      if (currentPlayingId === response.id) {
        setCurrentPlayingId(null);
        return;
      }
      
      // Fetch the audio blob
      const audioResponse = await fetch(response.audio_url);
      const audioBlob = await audioResponse.blob();
      
      // Play audio as PCM
      console.log(`Playing response ${response.id} as PCM audio`);
      const success = await playAudio(audioBlob, response.id, {
        sampleRate: 16000,  // Adjust based on your actual PCM format
        channels: 1
      });
      
      if (success) {
        setCurrentPlayingId(response.id);
        
        // Auto-reset playing state after a timeout (PCM playback doesn't have events)
        setTimeout(() => {
          setCurrentPlayingId(null);
        }, (audioBlob.size / 32) + 1000); // Rough estimate: 16-bit PCM at 16kHz is 32 bytes per ms
      } else {
        setAudioPlaybackError("Failed to play audio. The format may not be supported.");
      }
    } catch (err) {
      console.error("Exception during audio playback setup:", err);
      setAudioPlaybackError(err instanceof Error ? err.message : String(err));
    }
  };
  
  const toggleMute = () => {
    setMuted(!muted);
    // In the PCM-only scenario, we would need to implement volume control
    // directly in the audioUtils.playPCMAudio function
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
                {audioPlaybackError}. The application is configured to play PCM audio only.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Browser supported formats info */}
          <Alert variant="default" className="mb-4 bg-primary/10">
            <Info className="h-4 w-4" />
            <AlertTitle>Audio Information</AlertTitle>
            <AlertDescription className="text-xs">
              Using Web Audio API for PCM playback. Sample rate: 16kHz, 16-bit.
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
                    onClick={() => playResponseAudio(response)}
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
    </div>
  );
};

export default ResponsePlayer;
