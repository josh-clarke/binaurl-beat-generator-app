/**
 * AudioController.js - Main audio controller for the Binaural Beats PWA
 *
 * This class manages all audio tracks, master volume, timer functionality,
 * and audio export capabilities. It serves as the main interface for the audio engine.
 */

import BinauralTrack from './BinauralTrack.js';
import IsochronicTrack from './IsochronicTrack.js';
import NoiseTrack from './NoiseTrack.js';
import AudioExporter from '../audioExporter.js';

export default class AudioController {
  /**
   * Create a new AudioController
   * @param {Object} options - Configuration options
   * @param {number} options.masterVolume - Initial master volume (0-1)
   * @param {number} options.fadeInDuration - Default fade-in duration in seconds (default: 2)
   * @param {number} options.fadeOutDuration - Default fade-out duration in seconds (default: 1)
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
    
    // Default fade durations in seconds
    this.fadeInDuration = typeof options.fadeInDuration === 'number' && options.fadeInDuration >= 0 ?
      options.fadeInDuration : 2;
    this.fadeOutDuration = typeof options.fadeOutDuration === 'number' && options.fadeOutDuration >= 0 ?
      options.fadeOutDuration : 1;
    
    // Timer functionality
    this.timerDuration = 0; // Duration in milliseconds
    this.timerStartTime = 0; // Start time in milliseconds
    this.timerInterval = null; // Timer interval reference
    this.timerCallback = null; // Callback for timer completion
    
    // Audio export functionality
    this.audioExporter = null;
    this.isExporting = false;
    
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
      
      // Initialize audio exporter
      this._initializeAudioExporter();
      
      this.isInitialized = true;
      console.log('AudioController initialized at sample rate:', this.audioContext.sampleRate);
      return true;
    } catch (error) {
      console.error('Failed to initialize AudioController:', error);
      return false;
    }
  }
  
  /**
   * Get the default fade-in duration
   * @return {number} Current default fade-in duration in seconds
   */
  getFadeInDuration() {
    return this.fadeInDuration;
  }
  
  /**
   * Set the default fade-in duration
   * @param {number} duration - Fade-in duration in seconds (must be >= 0)
   * @return {number} The actual duration set
   */
  setFadeInDuration(duration) {
    if (typeof duration === 'number' && duration >= 0) {
      this.fadeInDuration = duration;
    }
    return this.fadeInDuration;
  }
  
  /**
   * Get the default fade-out duration
   * @return {number} Current default fade-out duration in seconds
   */
  getFadeOutDuration() {
    return this.fadeOutDuration;
  }
  
  /**
   * Set the default fade-out duration
   * @param {number} duration - Fade-out duration in seconds (must be >= 0)
   * @return {number} The actual duration set
   */
  setFadeOutDuration(duration) {
    if (typeof duration === 'number' && duration >= 0) {
      this.fadeOutDuration = duration;
    }
    return this.fadeOutDuration;
  }

  /**
   * Create a new track
   * @param {string} type - Track type: 'binaural', 'isochronic', or 'noise'
   * @param {Object} options - Track configuration options
   * @param {number} options.fadeInDuration - Custom fade-in duration for this track
   * @param {number} options.fadeOutDuration - Custom fade-out duration for this track
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
    
    // Apply default fade durations if not specified in options
    if (typeof options.fadeInDuration !== 'number') {
      options.fadeInDuration = this.fadeInDuration;
    }
    
    if (typeof options.fadeOutDuration !== 'number') {
      options.fadeOutDuration = this.fadeOutDuration;
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
   * @param {number} fadeInTime - Fade-in time in seconds (default: use instance default)
   */
  startAll(fadeInTime = null) {
    if (!this.isInitialized) {
      if (!this.initialize()) {
        return;
      }
    }
    
    // Use provided fadeInTime or default to instance fadeInDuration
    const actualFadeInTime = fadeInTime !== null ? fadeInTime : this.fadeInDuration;
    
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
    this.masterGain.gain.linearRampToValueAtTime(targetVolume, now + actualFadeInTime);
    
    this.isPlaying = true;
    console.log(`Started playback with ${actualFadeInTime}-second fade-in`);
  }
  
  /**
   * Stop all tracks with a fade-out
   * @param {number} fadeOutTime - Fade-out time in seconds (default: use instance default)
   * @return {Promise} Resolves when all tracks have stopped
   */
  async stopAll(fadeOutTime = null) {
    if (!this.isInitialized || this.tracks.size === 0) {
      this.isPlaying = false;
      return Promise.resolve();
    }
    
    // Use provided fadeOutTime or default to instance fadeOutDuration
    const actualFadeOutTime = fadeOutTime !== null ? fadeOutTime : this.fadeOutDuration;
    
    // Fade out the master volume
    const now = this.audioContext.currentTime;
    const currentVolume = this.masterGain.gain.value;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(currentVolume, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + actualFadeOutTime);
    
    // Wait for fade-out to complete before stopping tracks
    await new Promise(resolve => setTimeout(resolve, actualFadeOutTime * 1000));
    
    // Stop all tracks
    const stopPromises = Array.from(this.tracks.values()).map(track => track.stop());
    
    // Wait for all tracks to stop
    await Promise.all(stopPromises);
    
    // Reset master gain to original volume for next playback
    this.masterGain.gain.cancelScheduledValues(now + actualFadeOutTime);
    this.masterGain.gain.setValueAtTime(this.masterVolume, now + actualFadeOutTime);
    
    this.isPlaying = false;
    console.log(`Stopped playback with ${actualFadeOutTime}-second fade-out`);
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
    
    // Stop any ongoing export
    if (this.isExporting && this.audioExporter) {
      this.cancelExport();
    }
    
    // Clean up all tracks
    for (const track of this.tracks.values()) {
      track.dispose();
    }
    
    // Clear tracks map
    this.tracks.clear();
    
    // Clean up audio exporter
    if (this.audioExporter) {
      this.audioExporter.dispose();
      this.audioExporter = null;
    }
    
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
    this.isExporting = false;
  }
  
  /**
   * Initialize the audio exporter
   * @private
   */
  _initializeAudioExporter() {
    if (!this.audioContext) {
      console.error('Cannot initialize AudioExporter: AudioContext not available');
      return;
    }
    
    try {
      // Create audio exporter with MP3 options
      this.audioExporter = new AudioExporter({
        audioContext: this.audioContext,
        mp3Options: {
          bitRate: 192, // Default bitrate: 192 kbps
          quality: 'medium' // Default quality: medium
        }
      });
      
      // Set up recording
      if (this.audioExporter.isSupported && this.masterGain) {
        // Pass the master gain node and all tracks for offline rendering
        const tracks = Array.from(this.tracks.values());
        this.audioExporter.setupRecording(this.masterGain, tracks);
      }
    } catch (error) {
      console.error('Failed to initialize AudioExporter:', error);
      this.audioExporter = null;
    }
  }
  
  /**
   * Check if audio export is supported in the current browser
   * @return {boolean} Whether export is supported
   */
  isExportSupported() {
    return AudioExporter.isSupported();
  }
  
  /**
   * Start exporting audio
   * @param {Object} options - Export options
   * @param {number} options.duration - Export duration in seconds (default: 60)
   * @param {string} options.format - Export format: 'wav' or 'mp3' (default: 'wav')
   * @param {string} options.filename - Custom filename for the exported file (without extension)
   * @param {Object} options.mp3Options - MP3 encoding options
   * @param {number} options.mp3Options.bitRate - MP3 bitrate in kbps (128, 192, 256, 320)
   * @param {string} options.mp3Options.quality - MP3 quality: 'low', 'medium', 'high'
   * @param {Function} options.onProgress - Progress callback (receives a value from 0-100)
   * @param {Function} options.onComplete - Completion callback (receives the exported audio blob)
   * @param {Function} options.onError - Error callback (receives the error message)
   * @return {Promise<boolean>} Promise that resolves with success status
   */
  startExport(options = {}) {
    if (!this.isInitialized) {
      if (!this.initialize()) {
        return Promise.resolve(false);
      }
    }
    
    if (this.isExporting) {
      console.error('Export already in progress');
      return Promise.resolve(false);
    }
    
    if (!this.audioExporter || !this.audioExporter.isSupported) {
      console.error('Audio export is not supported in this browser');
      return Promise.resolve(false);
    }
    
    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Check if we need to start playback for real-time recording
    const isFastExportSupported = AudioExporter.isFastExportSupported && AudioExporter.isFastExportSupported();
    const wasPlaying = this.isPlaying;
    
    // Only start playback if we're using real-time recording (not offline rendering)
    if (!isFastExportSupported && !wasPlaying) {
      this.startAll(0); // Start with no fade-in for clean export
    }
    
    // Set export options
    const exportOptions = {
      duration: options.duration || 60,
      format: options.format || 'wav',
      filename: options.filename || '',
      mp3Options: options.mp3Options || null,
      onProgress: options.onProgress || null,
      onComplete: (blob) => {
        this.isExporting = false;
        
        // Stop playback if it wasn't playing before and we started it for real-time recording
        if (!wasPlaying && !isFastExportSupported) {
          this.stopAll(0); // Stop with no fade-out
        }
        
        // Call user callback if provided
        if (typeof options.onComplete === 'function') {
          options.onComplete(blob);
        }
      },
      onError: (error) => {
        this.isExporting = false;
        
        // Stop playback if it wasn't playing before and we started it for real-time recording
        if (!wasPlaying && !isFastExportSupported) {
          this.stopAll(0); // Stop with no fade-out
        }
        
        // Call user callback if provided
        if (typeof options.onError === 'function') {
          options.onError(error);
        }
      }
    };
    
    try {
      // Make sure the exporter has the latest tracks
      if (isFastExportSupported) {
        // Re-initialize the exporter to ensure it has the latest tracks
        this._initializeAudioExporter();
        console.log('Using fast offline rendering for export');
      } else {
        console.log('Using real-time recording for export');
      }
      
      // Start recording/rendering
      const success = this.audioExporter.startRecording(exportOptions);
      this.isExporting = success;
      
      return Promise.resolve(success);
    } catch (error) {
      console.error('Failed to start export:', error);
      
      // Stop playback if it wasn't playing before and we started it for real-time recording
      if (!wasPlaying && !isFastExportSupported) {
        this.stopAll(0); // Stop with no fade-out
      }
      
      return Promise.resolve(false);
    }
  }
  
  /**
   * Stop exporting audio and finalize the export
   * @return {Promise<Blob>} Promise that resolves with the exported audio blob
   */
  stopExport() {
    if (!this.isExporting || !this.audioExporter) {
      return Promise.reject(new Error('No export in progress'));
    }
    
    try {
      this.isExporting = false;
      return this.audioExporter.stopRecording();
    } catch (error) {
      console.error('Failed to stop export:', error);
      return Promise.reject(error);
    }
  }
  
  /**
   * Cancel the current export
   * @return {boolean} Success status
   */
  cancelExport() {
    if (!this.isExporting || !this.audioExporter) {
      return false;
    }
    
    try {
      const success = this.audioExporter.cancelRecording();
      this.isExporting = !success;
      return success;
    } catch (error) {
      console.error('Failed to cancel export:', error);
      return false;
    }
  }
  
  /**
   * Set the export format
   * @param {string} format - Export format: 'wav' or 'mp3'
   * @return {string} The actual format set
   */
  setExportFormat(format) {
    if (!this.audioExporter) {
      return 'wav'; // Default format
    }
    
    return this.audioExporter.setExportFormat(format);
  }
  
  /**
   * Get the current export progress
   * @return {number} Progress percentage (0-100)
   */
  getExportProgress() {
    if (!this.isExporting || !this.audioExporter) {
      return 0;
    }
    
    return this.audioExporter.getProgress();
  }
  
  /**
   * Calculate estimated file size for export
   * @param {number} durationSeconds - Duration in seconds
   * @param {string} format - Export format: 'wav' or 'mp3'
   * @param {number} [bitRate] - Bitrate for MP3 format in kbps
   * @return {Object} Estimated file size information or null if exporter not available
   */
  calculateEstimatedFileSize(durationSeconds, format, bitRate = null) {
    if (!this.audioExporter) {
      return null;
    }
    
    return this.audioExporter.calculateEstimatedFileSize(durationSeconds, format, bitRate);
  }
}