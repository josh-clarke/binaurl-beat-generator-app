/**
 * AudioController.js - Main audio controller for the Binaural Beats PWA
 * 
 * This class manages all audio tracks, master volume, and timer functionality.
 * It serves as the main interface for the audio engine.
 */

import BinauralTrack from './BinauralTrack.js';
import IsochronicTrack from './IsochronicTrack.js';
import NoiseTrack from './NoiseTrack.js';

export default class AudioController {
  /**
   * Create a new AudioController
   * @param {Object} options - Configuration options
   * @param {number} options.masterVolume - Initial master volume (0-1)
   */
  constructor(options = {}) {
    // Initialize audio context when needed (not immediately)
    this.audioContext = null;
    
    // Track management
    this.tracks = new Map();
    
    // Master volume (default: 0.7)
    this.masterVolume = typeof options.masterVolume === 'number' ? 
      Math.max(0, Math.min(1, options.masterVolume)) : 0.7;
    
    // Master gain node (created when audio context is initialized)
    this.masterGain = null;
    
    // Timer functionality
    this.timerDuration = 0; // Duration in milliseconds
    this.timerStartTime = 0; // Start time in milliseconds
    this.timerInterval = null; // Timer interval reference
    this.timerCallback = null; // Callback for timer completion
    
    // State
    this.isInitialized = false;
    this.isPlaying = false;
  }
  
  /**
   * Initialize the audio context and set up the audio graph
   * @return {boolean} Success status
   */
  initialize() {
    if (this.isInitialized) return true;
    
    try {
      // Create audio context
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      
      // Create master gain node
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.audioContext.destination);
      
      this.isInitialized = true;
      console.log('AudioController initialized at sample rate:', this.audioContext.sampleRate);
      return true;
    } catch (error) {
      console.error('Failed to initialize AudioController:', error);
      return false;
    }
  }
  
  /**
   * Create a new track
   * @param {string} type - Track type: 'binaural', 'isochronic', or 'noise'
   * @param {Object} options - Track configuration options
   * @return {string|null} Track ID if successful, null otherwise
   */
  createTrack(type, options = {}) {
    if (!this.isInitialized) {
      if (!this.initialize()) {
        return null;
      }
    }
    
    // Resume audio context if suspended (needed for autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    let track;
    
    // Create track based on type
    switch (type.toLowerCase()) {
      case 'binaural':
        track = new BinauralTrack(this.audioContext, options);
        break;
      case 'isochronic':
        track = new IsochronicTrack(this.audioContext, options);
        break;
      case 'noise':
        track = new NoiseTrack(this.audioContext, options);
        break;
      default:
        console.error('Invalid track type:', type);
        return null;
    }
    
    // Store track
    this.tracks.set(track.id, track);
    
    return track.id;
  }
  
  /**
   * Get a track by ID
   * @param {string} trackId - Track ID
   * @return {Track|null} Track object if found, null otherwise
   */
  getTrack(trackId) {
    return this.tracks.get(trackId) || null;
  }
  
  /**
   * Remove a track
   * @param {string} trackId - Track ID
   * @return {boolean} Success status
   */
  removeTrack(trackId) {
    const track = this.tracks.get(trackId);
    
    if (!track) {
      return false;
    }
    
    // Stop track if playing
    if (track.isPlaying) {
      track.stop();
    }
    
    // Clean up resources
    track.dispose();
    
    // Remove from tracks map
    this.tracks.delete(trackId);
    
    return true;
  }
  
  /**
   * Start a specific track
   * @param {string} trackId - Track ID
   * @return {boolean} Success status
   */
  startTrack(trackId) {
    const track = this.tracks.get(trackId);
    
    if (!track) {
      return false;
    }
    
    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Start track
    track.start();
    
    return true;
  }
  
  /**
   * Stop a specific track
   * @param {string} trackId - Track ID
   * @return {Promise<boolean>} Resolves to success status
   */
  async stopTrack(trackId) {
    const track = this.tracks.get(trackId);
    
    if (!track) {
      return false;
    }
    
    // Stop track
    await track.stop();
    
    return true;
  }
  
  /**
   * Update track parameters
   * @param {string} trackId - Track ID
   * @param {Object} params - Parameters to update
   * @return {boolean} Success status
   */
  updateTrack(trackId, params) {
    const track = this.tracks.get(trackId);
    
    if (!track) {
      return false;
    }
    
    // Update track parameters
    track.update(params);
    
    return true;
  }
  
  /**
   * Start all tracks with a fade-in
   * @param {number} fadeInTime - Fade-in time in seconds (default: 5)
   */
  startAll(fadeInTime = 5) {
    if (!this.isInitialized) {
      if (!this.initialize()) {
        return;
      }
    }
    
    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Store current master volume
    const targetVolume = this.masterVolume;
    
    // Set initial volume to 0 for fade-in
    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0, now);
    
    // Start all tracks
    for (const track of this.tracks.values()) {
      track.start();
    }
    
    // Fade in the master volume
    this.masterGain.gain.linearRampToValueAtTime(targetVolume, now + fadeInTime);
    
    this.isPlaying = true;
    console.log(`Started playback with ${fadeInTime}-second fade-in`);
  }
  
  /**
   * Stop all tracks with a fade-out
   * @param {number} fadeOutTime - Fade-out time in seconds (default: 2)
   * @return {Promise} Resolves when all tracks have stopped
   */
  async stopAll(fadeOutTime = 2) {
    if (!this.isInitialized || this.tracks.size === 0) {
      this.isPlaying = false;
      return Promise.resolve();
    }
    
    // Fade out the master volume
    const now = this.audioContext.currentTime;
    const currentVolume = this.masterGain.gain.value;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(currentVolume, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + fadeOutTime);
    
    // Wait for fade-out to complete before stopping tracks
    await new Promise(resolve => setTimeout(resolve, fadeOutTime * 1000));
    
    // Stop all tracks
    const stopPromises = Array.from(this.tracks.values()).map(track => track.stop());
    
    // Wait for all tracks to stop
    await Promise.all(stopPromises);
    
    // Reset master gain to original volume for next playback
    this.masterGain.gain.cancelScheduledValues(now + fadeOutTime);
    this.masterGain.gain.setValueAtTime(this.masterVolume, now + fadeOutTime);
    
    this.isPlaying = false;
    console.log(`Stopped playback with ${fadeOutTime}-second fade-out`);
    return Promise.resolve();
  }
  
  /**
   * Set master volume
   * @param {number} volume - Volume level (0-1)
   * @return {number} The actual volume set
   */
  setMasterVolume(volume) {
    if (!this.isInitialized) {
      if (!this.initialize()) {
        return this.masterVolume;
      }
    }
    
    const safeVolume = Math.max(0, Math.min(1, volume));
    this.masterVolume = safeVolume;
    
    // Apply volume to master gain node
    if (this.masterGain) {
      const now = this.audioContext.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(safeVolume, now + 0.1);
    }
    
    return safeVolume;
  }
  
  /**
   * Get master volume
   * @return {number} Current master volume
   */
  getMasterVolume() {
    return this.masterVolume;
  }
  
  /**
   * Start timer
   * @param {number} duration - Duration in milliseconds
   * @param {Function} callback - Callback function to call when timer completes
   */
  startTimer(duration, callback) {
    // Clear existing timer if any
    this.stopTimer();
    
    if (duration <= 0) {
      return;
    }
    
    this.timerDuration = duration;
    this.timerStartTime = Date.now();
    this.timerCallback = callback;
    
    // Set interval to check timer progress
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.timerStartTime;
      
      if (elapsed >= this.timerDuration) {
        // Timer completed
        this.stopTimer();
        
        // Stop all tracks
        this.stopAll();
        
        // Call callback
        if (typeof this.timerCallback === 'function') {
          this.timerCallback();
        }
      }
    }, 1000); // Check every second
  }
  
  /**
   * Stop timer
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    this.timerDuration = 0;
    this.timerStartTime = 0;
    this.timerCallback = null;
  }
  
  /**
   * Get remaining timer duration
   * @return {number} Remaining duration in milliseconds
   */
  getRemainingTime() {
    if (!this.timerStartTime || !this.timerDuration) {
      return 0;
    }
    
    const elapsed = Date.now() - this.timerStartTime;
    const remaining = Math.max(0, this.timerDuration - elapsed);
    
    return remaining;
  }
  
  /**
   * Clean up all resources
   */
  dispose() {
    // Stop timer
    this.stopTimer();
    
    // Stop all tracks
    this.stopAll();
    
    // Clean up all tracks
    for (const track of this.tracks.values()) {
      track.dispose();
    }
    
    // Clear tracks map
    this.tracks.clear();
    
    // Disconnect master gain
    if (this.masterGain) {
      this.masterGain.disconnect();
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.isInitialized = false;
    this.isPlaying = false;
  }
}