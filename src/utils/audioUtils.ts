
/**
 * Utility functions for audio processing with support for both PCM and MP3 formats
 */

/**
 * Plays audio in MP3 format using Web Audio API
 * @param audioBlob Audio data as Blob (MP3 format)
 * @returns A promise that resolves when audio playback is complete
 */
export async function playMP3Audio(
  audioBlob: Blob
): Promise<{ start: () => Promise<void>, stop: () => void }> {
  console.log(`Setting up MP3 audio playback: ${audioBlob.size} bytes`);
  
  // Create audio context
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContext();
  
  try {
    // Convert blob to ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // Decode the audio data (automatically handles MP3 format)
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log(`MP3 audio decoded: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz`);
    
    // Create buffer source for playback
    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(audioContext.destination);
    
    let isPlaying = false;
    let playbackCompleteResolver: (() => void) | null = null;
    
    // Return control functions
    return {
      start: () => {
        return new Promise<void>((resolve) => {
          try {
            console.log("Starting MP3 audio playback");
            bufferSource.start(0);
            isPlaying = true;
            
            // Set up onended callback to resolve the promise when playback completes
            bufferSource.onended = () => {
              console.log("MP3 audio playback complete");
              isPlaying = false;
              resolve();
              if (playbackCompleteResolver) {
                playbackCompleteResolver();
              }
            };
            
            // If there's no onended event for some reason, estimate duration
            if (audioBuffer.duration) {
              const durationMs = audioBuffer.duration * 1000;
              setTimeout(() => {
                if (isPlaying) {
                  console.log("MP3 audio playback timeout reached");
                  isPlaying = false;
                  resolve();
                  if (playbackCompleteResolver) {
                    playbackCompleteResolver();
                  }
                }
              }, durationMs + 500); // Add 500ms buffer
            }
          } catch (err) {
            console.error("Error starting MP3 playback:", err);
            isPlaying = false;
            resolve(); // Resolve anyway to prevent hanging promises
          }
        });
      },
      stop: () => {
        try {
          if (isPlaying) {
            bufferSource.stop();
            isPlaying = false;
            if (playbackCompleteResolver) {
              playbackCompleteResolver();
            }
          }
          audioContext.close();
        } catch (err) {
          console.error("Error stopping MP3 playback:", err);
        }
      }
    };
  } catch (error) {
    console.error("Error decoding MP3 audio:", error);
    throw error;
  }
}

/**
 * Plays PCM audio data using Web Audio API (legacy support)
 * @param pcmBlob Raw PCM audio data as Blob
 * @param sampleRate Sample rate of the audio (default: 16000)
 * @param channels Number of audio channels (default: 1)
 * @returns A promise that resolves when audio setup is complete
 */
export async function playPCMAudio(
  pcmBlob: Blob,
  sampleRate: number = 16000,
  channels: number = 1
): Promise<{ start: () => void, stop: () => void }> {
  console.log(`Setting up PCM audio playback: ${pcmBlob.size} bytes, ${sampleRate}Hz, ${channels} channels`);
  
  // Convert blob to ArrayBuffer
  const arrayBuffer = await pcmBlob.arrayBuffer();
  
  // Create audio context
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContext({
    sampleRate: sampleRate // Ensure the audio context uses the correct sample rate
  });
  
  // Get the byte length to determine format (16-bit vs 32-bit)
  const dataLength = arrayBuffer.byteLength;
  const samplesCount = dataLength / (channels * 2); // Assuming 16-bit (2 bytes per sample)
  
  // Create the audio buffer
  const audioBuffer = audioContext.createBuffer(
    channels,
    samplesCount,
    sampleRate
  );
  
  // Fill the buffer with PCM data - handle 16-bit PCM (most common format)
  const dataView = new DataView(arrayBuffer);
  
  // Process each channel
  for (let channel = 0; channel < channels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    
    for (let i = 0; i < samplesCount; i++) {
      const byteOffset = (i * channels + channel) * 2; // 2 bytes per sample for 16-bit PCM
      
      // Convert 16-bit PCM to float in the range [-1, 1]
      // Use little-endian (true) as most common encoding for PCM
      if (byteOffset < dataLength - 1) { // Ensure we're not reading past the buffer
        channelData[i] = dataView.getInt16(byteOffset, true) / 32768.0;
      }
    }
  }
  
  // Create buffer source for playback
  const bufferSource = audioContext.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(audioContext.destination);
  
  console.log(`PCM audio prepared: ${sampleRate}Hz, ${channels} channels, 16-bit`);
  
  // Return control functions
  return {
    start: () => {
      try {
        console.log("Starting PCM audio playback");
        bufferSource.start(0);
      } catch (err) {
        console.error("Error starting PCM playback:", err);
      }
    },
    stop: () => {
      try {
        bufferSource.stop();
        audioContext.close();
      } catch (err) {
        console.error("Error stopping PCM playback:", err);
      }
    }
  };
}

/**
 * Browser audio format support detection
 */
export function detectBrowserAudioSupport(): Record<string, boolean> {
  const audio = new Audio();
  return {
    mp3: audio.canPlayType('audio/mpeg') !== '',
    wav: audio.canPlayType('audio/wav') !== '',
    ogg: audio.canPlayType('audio/ogg') !== '',
    aac: audio.canPlayType('audio/aac') !== '',
    webm: audio.canPlayType('audio/webm') !== '',
  };
}

/**
 * Detects if audio blob is likely MP3 format by checking its signature
 * @param blob Audio data as Blob
 * @returns Promise resolving to boolean
 */
export async function isMP3Format(blob: Blob): Promise<boolean> {
  try {
    // Get the first few bytes to check the signature
    const buffer = await blob.slice(0, 4).arrayBuffer();
    const dataView = new DataView(buffer);
    
    // Check for MP3 signature (ID3 or sync bytes)
    const firstBytes = dataView.getUint32(0, false);
    const isID3 = (firstBytes & 0xFFFFFF00) === 0x49443300; // "ID3"
    const isSync = (firstBytes & 0xFFE00000) === 0xFFE00000; // Sync bytes 
    
    return isID3 || isSync;
  } catch (err) {
    console.warn("Error checking MP3 format:", err);
    return false;
  }
}

/**
 * Plays audio in appropriate format (auto-detects MP3 vs PCM)
 * @param blob Audio data as Blob
 * @param id Identifier for logging
 * @returns Promise resolving to true if playback started successfully
 */
export async function playAudio(
  blob: Blob, 
  id: string, 
  options: { 
    sampleRate?: number,
    channels?: number,
    format?: "mp3" | "pcm" | "auto"
  } = {}
): Promise<boolean> {
  try {
    // Determine format: specified, auto-detect, or default to PCM
    let format = options.format || "auto";
    
    if (format === "auto") {
      // Try to detect if it's MP3 by checking the first few bytes
      const isMp3 = await isMP3Format(blob);
      format = isMp3 ? "mp3" : "pcm";
    }
    
    if (format === "mp3") {
      console.log(`Playing ${id} as MP3 audio`);
      const mp3Player = await playMP3Audio(blob);
      await mp3Player.start();
      return true;
    } else {
      console.log(`Playing ${id} as PCM audio`);
      const pcmPlayer = await playPCMAudio(
        blob, 
        options.sampleRate || 16000, 
        options.channels || 1
      );
      pcmPlayer.start();
      return true;
    }
  } catch (err) {
    console.error(`Error in playAudio for ${id}:`, err);
    return false;
  }
}
