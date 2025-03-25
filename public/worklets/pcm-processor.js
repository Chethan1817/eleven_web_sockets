
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._chunkSize = 2048; // Smaller chunks for faster processing
    this._buffer = new Float32Array(this._chunkSize);
    this._bytesWritten = 0;
  }
  
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const channelData = input[0];
      
      // Copy input data to our buffer
      for (let i = 0; i < channelData.length; i++) {
        this._buffer[this._bytesWritten++] = channelData[i];
        
        // When buffer is full, send it and reset
        if (this._bytesWritten >= this._chunkSize) {
          this.port.postMessage(this._buffer.slice(0)); // Copy buffer to avoid racing conditions
          this._bytesWritten = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
