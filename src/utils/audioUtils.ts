
/**
 * Utility functions for audio processing with focus on PCM format
 */

/**
 * Plays PCM audio data using Web Audio API
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
 * Plays audio assumed to be PCM format
 * @param blob Audio data as Blob
 * @param id Identifier for logging
 * @returns Promise resolving to true if playback started successfully
 */
export async function playAudio(
  blob: Blob, 
  id: string, 
  options: { 
    sampleRate?: number,
    channels?: number
  } = {}
): Promise<boolean> {
  try {
    console.log(`Playing ${id} as PCM audio`);
    const pcmPlayer = await playPCMAudio(
      blob, 
      options.sampleRate || 16000, 
      options.channels || 1
    );
    pcmPlayer.start();
    return true;
  } catch (err) {
    console.error(`Error in playAudio for ${id}:`, err);
    return false;
  }
}
