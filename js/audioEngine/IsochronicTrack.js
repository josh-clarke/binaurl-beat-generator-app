/**
 * IsochronicTrack.js - Isochronic beat track implementation
 * 
 * This class extends the base Track class to create isochronic beats,
 * which are rapid pulses of a single tone that create a rhythmic,
 * evenly-spaced sound pattern.
 */

import Track from './Track.js';

export default class IsochronicTrack extends Track {
  /**
   * Create a new IsochronicTrack
   * @param {AudioContext} audioContext - The Web Audio API context
   * @param {Object} options - Configuration options
   * @param {number} options.carrierFrequency - Tone frequency in Hz (default: 200)
   * @param {number} options.beatFrequency - Beat frequency in Hz (default: 7)
   * @param {number} options.volume - Initial volume (0-1)
   */
  constructor(audioContext, options = {}) {
    // Set track type for offline rendering
    options.type = 'isochronic';
    
    super(audioContext, options);
    
    // Set default values if not provided
    this.carrierFrequency = options.carrierFrequency || 200;
    this.beatFrequency = options.beatFrequency || 7;
    
    // Create oscillator
    this.oscillator = null;
    
    // Create a gain node for the amplitude modulation (pulsing effect)
    this.modulationGain = this.audioContext.createGain();
    this.modulationGain.connect(this.gainNode);
    
    // LFO (Low Frequency Oscillator) for the pulsing effect
    this.lfo = null;
  }
  
  /**
   * Create and configure oscillator and LFO
   * @private
   */
  _createOscillator() {
    // Create carrier oscillator
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.value = this.carrierFrequency;
    this.oscillator.connect(this.modulationGain);
    
    // Create LFO for amplitude modulation
    this.lfo = this.audioContext.createOscillator();
    this.lfo.type = 'square'; // Square wave for sharp on/off pulsing
    this.lfo.frequency.value = this.beatFrequency;
    
    // Create gain node for LFO
    this.lfoGain = this.audioContext.createGain();
    this.lfoGain.gain.value = 1; // Full modulation depth
    
    // Connect LFO to its gain node
    this.lfo.connect(this.lfoGain);
    
    // Connect LFO gain to modulation gain
    this.lfoGain.connect(this.modulationGain.gain);
    
    // Set the modulation gain to 0 initially
    this.modulationGain.gain.value = 0;
    
    // Schedule the modulation to oscillate between 0 and 1
    const now = this.audioContext.currentTime;
    this.modulationGain.gain.setValueAtTime(0, now);
    
    // The LFO will automatically modulate between 0 and 1
    // due to the square wave and the connection to the gain parameter
  }
  
  /**
   * Start the isochronic beat with fade-in
   */
  start() {
    if (this.isPlaying) return;
    
    // Create new oscillator and LFO
    this._createOscillator();
    
    // Start oscillator and LFO
    const now = this.audioContext.currentTime;
    this.oscillator.start(now);
    this.lfo.start(now);
    
    // Call the parent class start method for fade-in
    super.start();
  }
  
  /**
   * Stop the isochronic beat with fade-out
   * @return {Promise} Resolves when the track has stopped
   */
  async stop() {
    if (!this.isPlaying) return Promise.resolve();
    
    // Apply fade-out using parent method
    await super.stop();
    
    // Stop and clean up oscillator and LFO
    const now = this.audioContext.currentTime;
    
    if (this.oscillator) {
      this.oscillator.stop(now);
      this.oscillator.disconnect();
      this.oscillator = null;
    }
    
    if (this.lfo) {
      this.lfo.stop(now);
      this.lfo.disconnect();
      this.lfo = null;
    }
    
    if (this.lfoGain) {
      this.lfoGain.disconnect();
      this.lfoGain = null;
    }
    
    return Promise.resolve();
  }
  
  /**
   * Update isochronic track parameters
   * @param {Object} params - Parameters to update
   * @param {number} params.carrierFrequency - New carrier frequency in Hz
   * @param {number} params.beatFrequency - New beat frequency in Hz
   * @param {number} params.volume - New volume level (0-1)
   */
  update(params = {}) {
    // Update carrier frequency if provided
    if (typeof params.carrierFrequency === 'number' && this.oscillator) {
      this.carrierFrequency = params.carrierFrequency;
      
      if (this.isPlaying) {
        // Apply smooth transition to new frequency
        const now = this.audioContext.currentTime;
        this.oscillator.frequency.setValueAtTime(this.oscillator.frequency.value, now);
        this.oscillator.frequency.linearRampToValueAtTime(this.carrierFrequency, now + 0.1);
      }
    }
    
    // Update beat frequency if provided
    if (typeof params.beatFrequency === 'number' && this.lfo) {
      this.beatFrequency = params.beatFrequency;
      
      if (this.isPlaying) {
        // Apply smooth transition to new beat frequency
        const now = this.audioContext.currentTime;
        this.lfo.frequency.setValueAtTime(this.lfo.frequency.value, now);
        this.lfo.frequency.linearRampToValueAtTime(this.beatFrequency, now + 0.1);
      }
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
    
    // Disconnect modulation gain
    this.modulationGain.disconnect();
    
    // Call parent dispose
    super.dispose();
  }
}