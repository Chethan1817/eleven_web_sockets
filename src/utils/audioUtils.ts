/**
 * Utility functions for audio processing and format detection
 */

/**
 * Detects the audio format from binary data by examining file signatures
 */
export function detectAudioFormat(data: Blob): Promise<string> {
  return new Promise<string>((resolve) => {
    // Convert blob to ArrayBuffer to check headers
    const fileReader = new FileReader();
    
    fileReader.onloadend = () => {
      if (!fileReader.result) {
        resolve('audio/mpeg'); // Default if we can't read the file
        return;
      }
      
      const array = new Uint8Array(fileReader.result as ArrayBuffer).slice(0, 16);
      
      // Check for MP3 (ID3 header or MPEG frame sync)
      if ((array[0] === 0x49 && array[1] === 0x44 && array[2] === 0x33) || // ID3
          (array[0] === 0xFF && (array[1] & 0xE0) === 0xE0)) { // MPEG frame sync
        resolve('audio/mpeg');
        return;
      }
      
      // Check for WAV (RIFF....WAVE)
      if (array[0] === 0x52 && array[1] === 0x49 && array[2] === 0x46 && array[3] === 0x46 &&
          array[8] === 0x57 && array[9] === 0x41 && array[10] === 0x56 && array[11] === 0x45) {
        resolve('audio/wav');
        return;
      }
      
      // Check for OGG (OggS)
      if (array[0] === 0x4F && array[1] === 0x67 && array[2] === 0x67 && array[3] === 0x53) {
        resolve('audio/ogg');
        return;
      }
      
      // Check for WebM/EBML (magic number 0x1A45DFA3)
      if (array[0] === 0x1A && array[1] === 0x45 && array[2] === 0xDF && array[3] === 0xA3) {
        resolve('audio/webm');
        return;
      }
      
      // Check for potential PCM data (no standard header, so we do a probabilistic analysis)
      // Simple heuristic: PCM data often has many values close to zero
      let zeroCount = 0;
      const sampleSize = Math.min(array.length, 100);
      for (let i = 0; i < sampleSize; i++) {
        if (array[i] === 0 || array[i] === 128) { // Check for common PCM baseline values
          zeroCount++;
        }
      }
      
      // If more than 20% of values are potential PCM baseline, consider it PCM
      if (zeroCount > sampleSize * 0.2) {
        resolve('audio/pcm');
        return;
      }
      
      // Default to mp3 if signature not recognized
      resolve('audio/mpeg');
    };
    
    fileReader.onerror = () => {
      console.error('Error reading file for format detection');
      resolve('audio/mpeg'); // Default on error
    };
    
    fileReader.readAsArrayBuffer(data.slice(0, 100)); // Read more bytes for PCM detection
  });
}

/**
 * Creates multiple blob variants for audio playback fallbacks
 * @param originalBlob The original audio blob
 * @returns Object with different audio format variants
 */
export function createAudioVariants(originalBlob: Blob): {
  original: { blob: Blob, type: string },
  variants: Array<{ blob: Blob, type: string }>
} {
  const original = { blob: originalBlob, type: originalBlob.type || 'audio/mpeg' };
  
  // Create variants with different MIME types for fallback
  const variants = [
    { blob: new Blob([originalBlob], { type: 'audio/mpeg' }), type: 'audio/mpeg' },
    { blob: new Blob([originalBlob], { type: 'audio/wav' }), type: 'audio/wav' },
    { blob: new Blob([originalBlob], { type: 'audio/webm' }), type: 'audio/webm' },
    { blob: new Blob([originalBlob], { type: 'audio/ogg' }), type: 'audio/ogg' },
    { blob: new Blob([originalBlob], { type: 'audio/aac' }), type: 'audio/aac' }
  ];
  
  // Remove any variant that matches the original type to avoid duplication
  return {
    original,
    variants: variants.filter(v => v.type !== original.type)
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
 * Plays PCM audio data using Web Audio API
 * @param pcmData Raw PCM audio data
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
  const pcmData = new Uint8Array(arrayBuffer);
  
  // Create audio context
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContext();
  
  // Determine if data is 16-bit or 32-bit PCM and create the appropriate view
  const bytesPerSample = pcmData.length / (sampleRate * channels * (audioContext.destination.channelCount / 8));
  const isPCM16 = bytesPerSample <= 2;
  
  // Create the audio buffer
  const audioBuffer = audioContext.createBuffer(
    channels,
    pcmData.length / (isPCM16 ? 2 : 4) / channels,
    sampleRate
  );
  
  // Fill the buffer with PCM data
  for (let channel = 0; channel < channels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    const dataView = new DataView(arrayBuffer);
    
    for (let i = 0; i < channelData.length; i++) {
      const byteOffset = (i * channels + channel) * (isPCM16 ? 2 : 4);
      
      if (isPCM16) {
        // 16-bit PCM (convert to float in the range [-1, 1])
        channelData[i] = dataView.getInt16(byteOffset, true) / 32768.0;
      } else {
        // 32-bit PCM (convert to float in the range [-1, 1])
        channelData[i] = dataView.getInt32(byteOffset, true) / 2147483648.0;
      }
    }
  }
  
  // Create buffer source for playback
  const bufferSource = audioContext.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(audioContext.destination);
  
  console.log(`PCM audio prepared: ${sampleRate}Hz, ${channels} channels, ${isPCM16 ? '16-bit' : '32-bit'}`);
  
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
 * Attempts to play audio using the appropriate method based on format detection
 * @param blob Audio data as Blob
 * @param id Identifier for logging
 * @returns Promise resolving to true if playback started successfully
 */
export async function playAudioWithFormatDetection(
  blob: Blob, 
  id: string, 
  options: { 
    sampleRate?: number,
    channels?: number
  } = {}
): Promise<boolean> {
  try {
    // First detect the format
    const detectedFormat = await detectAudioFormat(blob);
    console.log(`Detected format for audio ${id}: ${detectedFormat}`);
    
    // If detected as PCM, use Web Audio API approach
    if (detectedFormat === 'audio/pcm') {
      console.log(`Playing ${id} as PCM audio`);
      const pcmPlayer = await playPCMAudio(
        blob, 
        options.sampleRate || 16000, 
        options.channels || 1
      );
      pcmPlayer.start();
      return true;
    }
    
    // Otherwise create an audio element for standard formats
    const audioUrl = URL.createObjectURL(new Blob([blob], { type: detectedFormat }));
    const audio = new Audio(audioUrl);
    
    // Set up cleanup
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
    };
    
    // Try to play with the detected format
    try {
      console.log(`Playing ${id} with standard audio element, format: ${detectedFormat}`);
      await audio.play();
      return true;
    } catch (error) {
      console.error(`Failed to play audio ${id} with format ${detectedFormat}:`, error);
      URL.revokeObjectURL(audioUrl);
      
      // If standard playback fails, try with PCM as a fallback
      try {
        console.log(`Attempting PCM fallback for ${id}`);
        const pcmPlayer = await playPCMAudio(
          blob, 
          options.sampleRate || 16000, 
          options.channels || 1
        );
        pcmPlayer.start();
        return true;
      } catch (pcmError) {
        console.error(`PCM fallback also failed for ${id}:`, pcmError);
        return false;
      }
    }
  } catch (err) {
    console.error(`Error in playAudioWithFormatDetection for ${id}:`, err);
    return false;
  }
}
