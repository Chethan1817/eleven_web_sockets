
/**
 * Utility functions for audio processing and format detection
 */

/**
 * Detects the audio format from binary data by examining file signatures
 */
export function detectAudioFormat(data: Blob): string {
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
      
      // Default to mp3 if signature not recognized
      resolve('audio/mpeg');
    };
    
    fileReader.onerror = () => {
      console.error('Error reading file for format detection');
      resolve('audio/mpeg'); // Default on error
    };
    
    fileReader.readAsArrayBuffer(data.slice(0, 16)); // Only need first 16 bytes for detection
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
