import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader, Volume2 } from "lucide-react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import StatusIndicator from "@/components/StatusIndicator";
import AudioWaveform from "@/components/AudioWaveform";

const AudioRecorder: React.FC = () => {
  const { user } = useAuth();
  console.log("[AudioRecorder] User data:", user);
  const userId = user?.id ? String(user.id) : user?.phone_number || "";
  console.log("[AudioRecorder] Using userId:", userId);
  
  const { toast } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [audioVisualizationData, setAudioVisualizationData] = useState<Uint8Array>(new Uint8Array(50).fill(0));
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const { 
    sendAudioChunk, 
    isConnected, 
    isListening, 
    isPlaying,
    startListening, 
    stopListening,
    micLevel,
    logs
  } = useVoiceAssistant(userId);

  console.log("[AudioRecorder] Current state:", { isRecording, isConnected, isListening, isPlaying });

  // Helper function to resample audio to 16kHz Int16 PCM
  const resampleTo16kHz = async (
    float32Array: Float32Array,
    fromSampleRate: number
  ): Promise<Int16Array> => {
    console.log("[AudioRecorder] Resampling audio from", fromSampleRate, "Hz to 16kHz");
    
    const offlineCtx = new OfflineAudioContext(1, float32Array.length * (16000 / fromSampleRate), 16000);
    const buffer = offlineCtx.createBuffer(1, float32Array.length, fromSampleRate);
    buffer.copyToChannel(float32Array, 0);

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start();

    const rendered = await offlineCtx.startRendering();
    const resampled = rendered.getChannelData(0);
    console.log("[AudioRecorder] Resampled audio length:", resampled.length);

    // Convert Float32 to Int16
    const int16 = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
      let s = Math.max(-1, Math.min(1, resampled[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    console.log("[AudioRecorder] Converted to Int16 PCM, first few samples:", int16.slice(0, 5));
    return int16;
  };

  // Function to update audio visualization
  const updateAudioVisualization = () => {
    if (!isRecording || !analyzerRef.current) {
      return;
    }
    
    const analyzer = analyzerRef.current;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyzer.getByteFrequencyData(dataArray);
    
    // Use a smaller subset of the data for visualization
    const visualizationArray = new Uint8Array(50);
    const step = Math.floor(bufferLength / 50);
    
    for (let i = 0; i < 50; i++) {
      visualizationArray[i] = dataArray[i * step];
    }
    
    setAudioVisualizationData(visualizationArray);
    animationFrameRef.current = requestAnimationFrame(updateAudioVisualization);
  };

  const startRecording = async () => {
    console.log("[AudioRecorder] Starting recording process");
    try {
      console.log("[AudioRecorder] Requesting microphone access");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      console.log("[AudioRecorder] Microphone access granted:", stream);
      streamRef.current = stream;
      
      // Initialize AudioContext
      console.log("[AudioRecorder] Creating new AudioContext");
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      console.log("[AudioRecorder] AudioContext created with sample rate:", audioContext.sampleRate);
      
      // Create source from the microphone stream
      console.log("[AudioRecorder] Creating MediaStreamAudioSourceNode");
      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;
      
      // Create an analyzer for visualization
      console.log("[AudioRecorder] Creating AnalyserNode");
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      analyzer.smoothingTimeConstant = 0.8;
      analyzerRef.current = analyzer;
      sourceNode.connect(analyzer);
      
      // Start visualization
      animationFrameRef.current = requestAnimationFrame(updateAudioVisualization);
      
      // Create ScriptProcessorNode for direct audio processing
      const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processorNode;
      
      // Connect the processing chain
      analyzer.connect(processorNode);
      processorNode.connect(audioContext.destination);
      
      // Process audio data directly
      processorNode.onaudioprocess = async (event) => {
        if (!isRecording || !isConnected) return;
        
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Clone the data since it's from a live buffer
        const audioData = new Float32Array(inputData.length);
        audioData.set(inputData);
        
        try {
          if (audioContextRef.current) {
            const int16Data = await resampleTo16kHz(audioData, audioContextRef.current.sampleRate);
            console.log(`[AudioRecorder] Sending audio chunk: ${int16Data.buffer.byteLength} bytes`);
            sendAudioChunk(int16Data.buffer);
          }
        } catch (error) {
          console.error("[AudioRecorder] Error processing audio:", error);
        }
      };
      
      // Also keep MediaRecorder as backup
      console.log("[AudioRecorder] Creating MediaRecorder");
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);  // Collect data every second
      
      setIsRecording(true);
      startListening();
      
    } catch (error) {
      console.error("[AudioRecorder] Error starting recording:", error);
      toast({
        title: "Microphone Error",
        description: "Could not access your microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    console.log("[AudioRecorder] Stopping recording");
    
    // Cancel any ongoing animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Stop MediaRecorder if it exists
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
    
    // Stop and clean up audio processing
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    
    if (analyzerRef.current) {
      analyzerRef.current.disconnect();
      analyzerRef.current = null;
    }
    
    // Stop media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close()
        .then(() => console.log("[AudioRecorder] AudioContext closed successfully"))
        .catch(e => console.error("[AudioRecorder] Error closing AudioContext:", e));
      audioContextRef.current = null;
    }
    
    setIsRecording(false);
    stopListening();
  };

  // Clean up on component unmount
  useEffect(() => {
    console.log("[AudioRecorder] Component mounted");
    return () => {
      console.log("[AudioRecorder] Component unmounting, cleaning up resources");
      
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
          .catch(e => console.error("[AudioRecorder] Error closing AudioContext:", e));
      }
      
      if (isListening) {
        stopListening();
      }
    };
  }, [isListening, stopListening]);

  const toggleRecording = () => {
    console.log("[AudioRecorder] Toggle recording, current state:", isRecording);
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-lg mx-auto">
        {/* Audio Waveform Visualization */}
        <AudioWaveform 
          audioData={audioVisualizationData}
          isRecording={isRecording && !isPlaying}
          isPlaying={isPlaying}
        />
        
        <div className="relative mb-4 mt-4 flex justify-center">
          <Button
            onClick={toggleRecording}
            variant={isRecording ? "destructive" : "default"}
            size="lg"
            className={`rounded-full h-16 w-16 flex items-center justify-center ${isPlaying ? 'animate-pulse shadow-lg' : 'shadow-md'}`}
            disabled={isPlaying}
          >
            {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
          </Button>
          
          {isConnected && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
          )}
          
          {isListening && !isConnected && (
            <span className="absolute -top-1 -right-1">
              <Loader className="h-4 w-4 animate-spin text-primary" />
            </span>
          )}
        </div>
        
        {/* Status indicator */}
        <div className="text-center mb-4">
          <div className="text-sm font-medium">
            {isRecording ? (
              isConnected ? (
                isPlaying ? 
                <div className="flex items-center justify-center gap-2 text-primary animate-pulse">
                  <Volume2 className="h-4 w-4" />
                  <span>Assistant is speaking...</span>
                </div> : 
                <div className="text-green-500">Listening...</div>
              ) : (
                <div className="text-amber-500">Connecting...</div>
              )
            ) : (
              <div className="text-muted-foreground">Tap to speak</div>
            )}
          </div>
        </div>
        
        {/* Microphone level indicator */}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
          <div 
            className={`h-full transition-all duration-100 ${
              micLevel > 80 ? 'bg-red-500' : 
              micLevel > 40 ? 'bg-orange-500' : 
              'bg-green-500'
            }`}
            style={{ width: `${micLevel}%` }}
          />
        </div>
      </div>

      {/* Debug logs toggle button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setShowLogs(!showLogs)}
        className="mt-2"
      >
        {showLogs ? "Hide Logs" : "Show Logs"}
      </Button>

      {/* Debug logs */}
      {showLogs && logs.length > 0 && (
        <Card className="w-full mt-4 max-h-80 overflow-y-auto p-4 bg-black text-green-500 font-mono text-xs">
          {logs.map((log, i) => (
            <div key={i} className="whitespace-pre-wrap">{log}</div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default AudioRecorder;
