/**
 * Track.js - Base Track class for the Binaural Beats PWA
 * 
 * This class serves as the foundation for all audio tracks in the application.
 * It provides common functionality and structure for different track types.
 */

export default class Track {
  /**
   * Create a new Track
   * @param {AudioContext} audioContext - The Web Audio API context
   * @param {Object} options - Configuration options for the track
   * @param {string} options.id - Unique identifier for the track
   * @param {number} options.volume - Initial volume (0-1)
   * @param {number} options.fadeInDuration - Fade-in duration in seconds (default: 2)
   * @param {number} options.fadeOutDuration - Fade-out duration in seconds (default: 1)
   * @param {string} options.type - Track type (set by subclasses)
   */
  constructor(audioContext, options = {}) {
    if (!audioContext) {
      throw new Error('AudioContext is required to create a Track');
    }
    
    this.audioContext = audioContext;
    this.id = options.id || `track-${Date.now()}`;
    this.isPlaying = false;
    
    // Track type (will be set by subclasses)
    this.type = options.type || 'base';
    
    // Create the track's gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = typeof options.volume === 'number' ?
      Math.max(0, Math.min(1, options.volume)) : 0.7;
    
    // Connect the gain node to the destination (output)
    this.gainNode.connect(this.audioContext.destination);
    
    // Fade durations in seconds (with defaults)
    this.fadeInDuration = typeof options.fadeInDuration === 'number' && options.fadeInDuration >= 0 ?
      options.fadeInDuration : 2;
    this.fadeOutDuration = typeof options.fadeOutDuration === 'number' && options.fadeOutDuration >= 0 ?
      options.fadeOutDuration : 1;
  }
  
  /**
   * Get the current volume
   * @return {number} Current volume (0-1)
   */
  getVolume() {
    return this.gainNode.gain.value;
  }
  
  /**
   * Set the track volume
   * @param {number} volume - Volume level (0-1)
   */
  setVolume(volume) {
    const safeVolume = Math.max(0, Math.min(1, volume));
    
    // If currently playing, apply a smooth transition
    if (this.isPlaying) {
      const now = this.audioContext.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(safeVolume, now + 0.1);
    } else {
      this.gainNode.gain.value = safeVolume;
    }
    
    return safeVolume;
  }
  
  /**
   * Apply fade-in effect
   * @private
   */
  _applyFadeIn() {
    const now = this.audioContext.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    
    // Start from zero and ramp up to the target volume
    const targetVolume = this.gainNode.gain.value;
    this.gainNode.gain.setValueAtTime(0, now);
    this.gainNode.gain.linearRampToValueAtTime(targetVolume, now + this.fadeInDuration);
  }
  
  /**
   * Apply fade-out effect
   * @private
   * @return {Promise} Resolves when fade-out is complete
   */
  _applyFadeOut() {
    return new Promise(resolve => {
      const now = this.audioContext.currentTime;
      const currentVolume = this.gainNode.gain.value;
      
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(currentVolume, now);
      this.gainNode.gain.linearRampToValueAtTime(0, now + this.fadeOutDuration);
      
      // Resolve the promise after the fade-out duration
      setTimeout(resolve, this.fadeOutDuration * 1000);
    });
  }
  
  /**
   * Start the track with fade-in
   * This method should be overridden by subclasses
   */
  start() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this._applyFadeIn();
  }
  
  /**
   * Stop the track with fade-out
   * @return {Promise} Resolves when the track has stopped
   */
  async stop() {
    if (!this.isPlaying) return Promise.resolve();
    
    // Apply fade-out effect
    await this._applyFadeOut();
    
    this.isPlaying = false;
    return Promise.resolve();
  }
  
  /**
   * Get the current fade-in duration
   * @return {number} Current fade-in duration in seconds
   */
  getFadeInDuration() {
    return this.fadeInDuration;
  }
  
  /**
   * Set the fade-in duration
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
   * Get the current fade-out duration
   * @return {number} Current fade-out duration in seconds
   */
  getFadeOutDuration() {
    return this.fadeOutDuration;
  }
  
  /**
   * Set the fade-out duration
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
   * Update track parameters
   * This method should be overridden by subclasses
   * @param {Object} params - Parameters to update
   * @param {number} params.volume - New volume level (0-1)
   * @param {number} params.fadeInDuration - New fade-in duration in seconds
   * @param {number} params.fadeOutDuration - New fade-out duration in seconds
   */
  update(params = {}) {
    if (typeof params.volume === 'number') {
      this.setVolume(params.volume);
    }
    
    if (typeof params.fadeInDuration === 'number') {
      this.setFadeInDuration(params.fadeInDuration);
    }
    
    if (typeof params.fadeOutDuration === 'number') {
      this.setFadeOutDuration(params.fadeOutDuration);
    }
  }
  
  /**
   * Clean up resources used by this track
   */
  dispose() {
    if (this.isPlaying) {
      this.stop();
    }
    
    // Disconnect from the audio graph
    this.gainNode.disconnect();
  }
}