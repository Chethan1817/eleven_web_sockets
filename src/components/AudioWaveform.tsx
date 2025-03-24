
import React, { useEffect, useRef } from "react";

interface AudioWaveformProps {
  audioData?: Uint8Array;
  isRecording: boolean;
  isPlaying: boolean;
}

const AudioWaveform: React.FC<AudioWaveformProps> = ({ 
  audioData = new Uint8Array(50).fill(0), 
  isRecording, 
  isPlaying 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const width = canvas.width;
    const height = canvas.height;
    const bufferLength = audioData.length;
    const barWidth = width / bufferLength * 2.5;
    
    let x = 0;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, width, height);
    
    // Get dynamic color based on state
    let gradient;
    if (isPlaying) {
      gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(0, 112, 243, 0.7)'); // primary color
      gradient.addColorStop(1, 'rgba(0, 112, 243, 0.3)'); // primary with lower opacity
    } else if (isRecording) {
      gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.5)'); // destructive color
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)'); // destructive with lower opacity
    } else {
      gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(113, 113, 122, 0.4)'); // muted foreground color
      gradient.addColorStop(1, 'rgba(113, 113, 122, 0.2)'); // muted foreground with lower opacity
    }
    
    ctx.fillStyle = gradient;
    
    for (let i = 0; i < bufferLength; i++) {
      let barHeight = (audioData[i] / 255) * height;
      
      // If not recording or playing, show a minimal idle animation
      if (!isRecording && !isPlaying) {
        barHeight = Math.max(5, Math.sin(i / 2 + Date.now() / 1000) * 5 + 8);
      } else if (barHeight < 5) {
        barHeight = 5; // Minimum bar height
      }
      
      const y = height / 2 - barHeight / 2;
      
      ctx.fillRect(x, y, barWidth - 1, barHeight);
      x += barWidth;
    }
  }, [audioData, isRecording, isPlaying]);
  
  return (
    <div className="w-full h-24 relative my-4">
      <canvas 
        ref={canvasRef}
        width={500}
        height={100}
        className="w-full h-full rounded-md"
      />
    </div>
  );
};

export default AudioWaveform;
