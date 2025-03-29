/**
 * NoiseTrack.js - Noise generator track implementation
 * 
 * This class extends the base Track class to create different types of noise:
 * - White noise: Equal energy per frequency
 * - Pink noise: Energy decreases as frequency increases (1/f)
 * - Brown noise: Energy decreases more rapidly with frequency (1/f²)
 */

import Track from './Track.js';

export default class NoiseTrack extends Track {
  /**
   * Create a new NoiseTrack
   * @param {AudioContext} audioContext - The Web Audio API context
   * @param {Object} options - Configuration options
   * @param {string} options.noiseType - Type of noise: 'white', 'pink', or 'brown' (default: 'white')
   * @param {number} options.volume - Initial volume (0-1)
   */
  constructor(audioContext, options = {}) {
    // Set track type for offline rendering
    options.type = 'noise';
    
    super(audioContext, options);
    
    // Set default noise type if not provided
    this.noiseType = options.noiseType || 'white';
    
    // Create audio buffer source node
    this.noiseSource = null;
    
    // For pink and brown noise, we need filters
    this.filters = [];
    
    // Buffer size for noise generation (2 seconds of audio)
    this.bufferSize = 2 * this.audioContext.sampleRate;
  }
  
  /**
   * Generate white noise buffer
   * @private
   * @return {AudioBuffer} White noise buffer
   */
  _createWhiteNoiseBuffer() {
    const buffer = this.audioContext.createBuffer(
      2, // Stereo (2 channels)
      this.bufferSize,
      this.audioContext.sampleRate
    );
    
    // Fill both channels with random values between -1 and 1
    for (let channel = 0; channel < 2; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < this.bufferSize; i++) {
        // Random value between -1 and 1
        channelData[i] = Math.random() * 2 - 1;
      }
    }
    
    return buffer;
  }
  
  /**
   * Generate pink noise buffer
   * @private
   * @return {AudioBuffer} Pink noise buffer
   */
  _createPinkNoiseBuffer() {
    const buffer = this.audioContext.createBuffer(
      2, // Stereo (2 channels)
      this.bufferSize,
      this.audioContext.sampleRate
    );
    
    // Pink noise generation using the Voss algorithm
    for (let channel = 0; channel < 2; channel++) {
      const channelData = buffer.getChannelData(channel);
      
      // Pink noise parameters
      const octaves = 7; // Number of octaves
      const values = new Array(octaves).fill(0);
      let maxSum = 0;
      
      for (let i = 0; i < this.bufferSize; i++) {
        let sum = 0;
        
        // Update values and calculate sum
        for (let j = 0; j < octaves; j++) {
          if ((i % Math.pow(2, j)) === 0) {
            values[j] = Math.random() * 2 - 1;
          }
          sum += values[j];
        }
        
        // Track maximum sum for normalization
        maxSum = Math.max(maxSum, Math.abs(sum));
        channelData[i] = sum;
      }
      
      // Normalize to range [-1, 1]
      for (let i = 0; i < this.bufferSize; i++) {
        channelData[i] /= maxSum;
      }
    }
    
    return buffer;
  }
  
  /**
   * Generate brown noise buffer
   * @private
   * @return {AudioBuffer} Brown noise buffer
   */
  _createBrownNoiseBuffer() {
    const buffer = this.audioContext.createBuffer(
      2, // Stereo (2 channels)
      this.bufferSize,
      this.audioContext.sampleRate
    );
    
    // Brown noise generation using random walk
    for (let channel = 0; channel < 2; channel++) {
      const channelData = buffer.getChannelData(channel);
      let lastValue = 0;
      let maxValue = 0;
      
      for (let i = 0; i < this.bufferSize; i++) {
        // Random walk: add a small random value to the last value
        const randomValue = Math.random() * 0.2 - 0.1; // Small random change
        lastValue += randomValue;
        
        // Apply a simple low-pass filter to integrate the noise
        lastValue = 0.99 * lastValue;
        
        // Track maximum value for normalization
        maxValue = Math.max(maxValue, Math.abs(lastValue));
        channelData[i] = lastValue;
      }
      
      // Normalize to range [-1, 1]
      for (let i = 0; i < this.bufferSize; i++) {
        channelData[i] /= maxValue;
      }
    }
    
    return buffer;
  }
  
  /**
   * Create noise buffer based on the selected noise type
   * @private
   * @return {AudioBuffer} Noise buffer
   */
  _createNoiseBuffer() {
    switch (this.noiseType.toLowerCase()) {
      case 'pink':
        return this._createPinkNoiseBuffer();
      case 'brown':
        return this._createBrownNoiseBuffer();
      case 'white':
      default:
        return this._createWhiteNoiseBuffer();
    }
  }
  
  /**
   * Create and configure noise source
   * @private
   */
  _createNoiseSource() {
    // Create buffer source
    this.noiseSource = this.audioContext.createBufferSource();
    this.noiseSource.buffer = this._createNoiseBuffer();
    this.noiseSource.loop = true;
    
    // Connect to gain node
    this.noiseSource.connect(this.gainNode);
  }
  
  /**
   * Start the noise with fade-in
   */
  start() {
    if (this.isPlaying) return;
    
    // Create new noise source
    this._createNoiseSource();
    
    // Start noise source
    this.noiseSource.start(0);
    
    // Call the parent class start method for fade-in
    super.start();
  }
  
  /**
   * Stop the noise with fade-out
   * @return {Promise} Resolves when the track has stopped
   */
  async stop() {
    if (!this.isPlaying) return Promise.resolve();
    
    // Apply fade-out using parent method
    await super.stop();
    
    // Stop and clean up noise source
    if (this.noiseSource) {
      this.noiseSource.stop(0);
      this.noiseSource.disconnect();
      this.noiseSource = null;
    }
    
    return Promise.resolve();
  }
  
  /**
   * Update noise track parameters
   * @param {Object} params - Parameters to update
   * @param {string} params.noiseType - New noise type ('white', 'pink', or 'brown')
   * @param {number} params.volume - New volume level (0-1)
   */
  update(params = {}) {
    let noiseTypeChanged = false;
    
    // Update noise type if provided
    if (params.noiseType && ['white', 'pink', 'brown'].includes(params.noiseType.toLowerCase())) {
      if (this.noiseType !== params.noiseType.toLowerCase()) {
        this.noiseType = params.noiseType.toLowerCase();
        noiseTypeChanged = true;
      }
    }
    
    // If noise type changed and track is playing, restart with new noise type
    if (noiseTypeChanged && this.isPlaying) {
      const wasPlaying = this.isPlaying;
      const currentVolume = this.getVolume();
      
      // Stop current noise
      this.stop().then(() => {
        if (wasPlaying) {
          // Start with new noise type
          this.start();
          // Restore volume
          this.setVolume(currentVolume);
        }
      });
    }
    
    // Call parent update for common parameters like volume
    super.update(params);
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    if (this.isPlaying) {
      this.stop();
    }
    
    // Call parent dispose
    super.dispose();
  }
}