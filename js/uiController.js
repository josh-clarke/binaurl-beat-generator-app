/**
 * UIController.js - UI state manager for the Binaural Beats PWA
 *
 * This class manages the UI state and provides methods for updating the UI
 * based on the audio engine state. It handles the master controls, including
 * play/stop button, volume control, timer, preset selection, and track management.
 */

export default class UIController {
  /**
   * Create a new UIController
   * @param {Object} options - Configuration options
   * @param {AudioController} options.audioController - The audio controller instance
   * @param {PresetManager} options.presetManager - The preset manager instance
   * @param {Object} options.domElements - DOM elements to control
   */
  constructor(options = {}) {
    // Store references to controllers
    this.audioController = options.audioController || null;
    this.presetManager = options.presetManager || null;
    
    // Store DOM elements
    this.dom = options.domElements || {};
    
    // UI state
    this.isPlaying = false;
    this.masterVolume = this.loadVolumeFromStorage() || 0.7;
    this.timerDuration = 0; // in minutes
    this.timerEndTime = null;
    this.timerInterval = null;
    
    // Fade settings
    this.fadeInDuration = this.loadFadeInDurationFromStorage() || 2;
    this.fadeOutDuration = this.loadFadeOutDurationFromStorage() || 1;
    
    // Initialize UI
    this.initUI();
  }
  
  /**
   * Initialize the UI
   */
  initUI() {
    // Set initial volume from storage
    this.updateVolumeUI(this.masterVolume);
    
    // Apply volume to audio controller if available
    if (this.audioController) {
      this.audioController.setMasterVolume(this.masterVolume);
    }
    
    // Initialize fade settings
    this.updateFadeSettingsUI();
    
    // Apply fade settings to audio controller if available
    if (this.audioController) {
      this.audioController.setFadeInDuration(this.fadeInDuration);
      this.audioController.setFadeOutDuration(this.fadeOutDuration);
    }
    
    // Update play button state
    this.updatePlayButtonState();
    
    // Update timer display
    this.updateTimerDisplay();
  }
  
  /**
   * Toggle playback state
   */
  togglePlayback() {
    if (!this.isPlaying) {
      this.startPlayback();
    } else {
      this.stopPlayback();
    }
  }
  
  /**
   * Start audio playback with fade-in
   */
  startPlayback() {
    if (!this.audioController) return;
    
    // Initialize audio controller if needed
    if (!this.audioController.isInitialized) {
      this.audioController.initialize();
    }
    
    // Start all tracks (AudioController handles the fade-in)
    this.audioController.startAll();
    
    // Start timer if set
    if (this.timerDuration > 0) {
      this.startTimer(this.timerDuration);
    }
    
    // Update UI state
    this.isPlaying = true;
    this.updatePlayButtonState();
    
    console.log('Playback started with 5-second fade-in');
  }
  
  /**
   * Stop audio playback with fade-out
   */
  stopPlayback() {
    if (!this.audioController) return;
    
    // Stop all tracks (AudioController handles the fade-out)
    this.audioController.stopAll().then(() => {
      console.log('All tracks stopped with 2-second fade-out');
    });
    
    // Stop timer
    this.stopTimer();
    
    // Update UI state
    this.isPlaying = false;
    this.updatePlayButtonState();
  }
  
  /**
   * Update play button visual state
   */
  updatePlayButtonState() {
    if (!this.dom.playButton) return;
    
    const iconSpan = this.dom.playButton.querySelector('.button-icon');
    const textSpan = this.dom.playButton.querySelector('.button-text');
    
    if (this.isPlaying) {
      // Change to stop state
      iconSpan.textContent = '■';
      textSpan.textContent = 'Stop';
      this.dom.playButton.style.backgroundColor = 'var(--error)';
    } else {
      // Change to play state
      iconSpan.textContent = '▶';
      textSpan.textContent = 'Play';
      this.dom.playButton.style.backgroundColor = 'var(--accent-primary)';
    }
  }
  
  /**
   * Set master volume
   * @param {number} volume - Volume level (0-1)
   */
  setMasterVolume(volume) {
    if (!this.audioController) return;
    
    // Set volume in audio controller
    const actualVolume = this.audioController.setMasterVolume(volume);
    
    // Update UI
    this.masterVolume = actualVolume;
    this.updateVolumeUI(actualVolume);
    
    // Save to local storage
    this.saveVolumeToStorage(actualVolume);
    
    return actualVolume;
  }
  
  /**
   * Update volume UI elements
   * @param {number} volume - Volume level (0-1)
   */
  updateVolumeUI(volume) {
    // Update slider if it exists
    if (this.dom.masterVolumeSlider) {
      this.dom.masterVolumeSlider.value = volume;
    }
    
    // Update volume display if it exists
    if (this.dom.volumeDisplay) {
      const percentage = Math.round(volume * 100);
      this.dom.volumeDisplay.textContent = `${percentage}%`;
    }
  }
  
  /**
   * Save volume setting to local storage
   * @param {number} volume - Volume level (0-1)
   */
  saveVolumeToStorage(volume) {
    try {
      localStorage.setItem('binauralBeats_masterVolume', volume.toString());
    } catch (error) {
      console.error('Failed to save volume to local storage:', error);
    }
  }
  
  /**
   * Load volume setting from local storage
   * @return {number|null} Volume level or null if not found
   */
  loadVolumeFromStorage() {
    try {
      const storedVolume = localStorage.getItem('binauralBeats_masterVolume');
      if (storedVolume !== null) {
        return parseFloat(storedVolume);
      }
    } catch (error) {
      console.error('Failed to load volume from local storage:', error);
    }
    return null;
  }
  
  /**
   * Set timer duration
   * @param {number} durationMinutes - Duration in minutes
   */
  setTimerDuration(durationMinutes) {
    this.timerDuration = durationMinutes;
    
    if (this.isPlaying && durationMinutes > 0) {
      // Restart timer with new duration
      this.startTimer(durationMinutes);
    } else if (this.isPlaying && durationMinutes === 0) {
      // Stop timer if set to infinite
      this.stopTimer();
    }
    
    this.updateTimerDisplay();
  }
  
  /**
   * Start timer
   * @param {number} durationMinutes - Duration in minutes
   */
  startTimer(durationMinutes) {
    // Clear existing timer
    this.stopTimer();
    
    if (durationMinutes <= 0) {
      return;
    }
    
    // Set end time
    const now = new Date();
    this.timerEndTime = new Date(now.getTime() + durationMinutes * 60 * 1000);
    
    // Start interval to update display
    this.timerInterval = setInterval(() => this.updateTimerDisplay(), 1000);
    
    // Start audio controller timer
    if (this.audioController) {
      this.audioController.startTimer(durationMinutes * 60 * 1000, () => {
        this.stopPlayback();
        this.updateTimerDisplay();
      });
    }
    
    console.log(`Timer started for ${durationMinutes} minutes`);
  }
  
  /**
   * Stop timer
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    this.timerEndTime = null;
    
    if (this.audioController) {
      this.audioController.stopTimer();
    }
  }
  
  /**
   * Update timer display
   */
  updateTimerDisplay() {
    if (!this.dom.timerDisplay) return;
    
    if (this.timerEndTime && this.isPlaying) {
      const now = new Date();
      const diff = this.timerEndTime - now;
      
      if (diff <= 0) {
        // Timer completed
        this.dom.timerDisplay.textContent = '00:00';
        return;
      }
      
      // Calculate minutes and seconds
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      // Format display
      this.dom.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else if (this.timerDuration > 0) {
      // Show set duration when not playing
      this.dom.timerDisplay.textContent = `${this.timerDuration.toString().padStart(2, '0')}:00`;
    } else {
      // Show infinite symbol when no timer
      this.dom.timerDisplay.textContent = '∞';
    }
  }
  
  /**
   * Load a preset
   * @param {string} presetId - Preset ID
   */
  async loadPreset(presetId) {
    if (!this.presetManager || !this.audioController) {
      console.error('Preset system not initialized');
      return;
    }
    
    try {
      // Get preset by ID
      const presets = await this.presetManager.listPresets();
      const preset = presets.find(p => p.id === presetId);
      
      if (!preset) {
        console.error('Preset not found');
        return;
      }
      
      // Store current playback state
      const wasPlaying = this.isPlaying;
      
      // Stop playback if playing
      if (wasPlaying) {
        this.stopPlayback();
      }
      
      // Apply preset configuration to audio controller
      await this.presetManager.applyConfigurationToAudioController(
        preset.configuration,
        this.audioController,
        this.trackCreatedCallback
      );
      
      // Update volume UI
      if (typeof preset.configuration.masterVolume === 'number') {
        this.masterVolume = preset.configuration.masterVolume;
        this.updateVolumeUI(this.masterVolume);
      }
      
      // Update timer display
      if (preset.configuration.timerDuration > 0) {
        this.timerDuration = Math.ceil(preset.configuration.timerDuration / 60000); // Convert ms to minutes
        if (this.dom.timerDurationSelect) {
          this.dom.timerDurationSelect.value = this.timerDuration.toString();
        }
        this.updateTimerDisplay();
      }
      
      // Update fade settings
      if (typeof preset.configuration.fadeInDuration === 'number') {
        this.fadeInDuration = preset.configuration.fadeInDuration;
      } else {
        // Backward compatibility: use default
        this.fadeInDuration = 2;
      }
      
      if (typeof preset.configuration.fadeOutDuration === 'number') {
        this.fadeOutDuration = preset.configuration.fadeOutDuration;
      } else {
        // Backward compatibility: use default
        this.fadeOutDuration = 1;
      }
      
      // Update fade settings UI
      this.updateFadeSettingsUI();
      
      // Restart playback if it was playing
      if (wasPlaying) {
        this.startPlayback();
      }
      
      console.log('Preset loaded:', preset.name);
      return preset;
    } catch (error) {
      console.error('Failed to load preset:', error);
      throw error;
    }
  }
  
  /**
   * Set track created callback
   * @param {Function} callback - Callback function
   */
  setTrackCreatedCallback(callback) {
    this.trackCreatedCallback = callback;
  }
  
  /**
   * Update UI based on audio controller state
   */
  syncWithAudioController() {
    if (!this.audioController) return;
    
    // Update playback state
    this.isPlaying = this.audioController.isPlaying;
    this.updatePlayButtonState();
    
    // Update volume
    this.masterVolume = this.audioController.getMasterVolume();
    this.updateVolumeUI(this.masterVolume);
    
    // Update fade settings
    this.fadeInDuration = this.audioController.getFadeInDuration();
    this.fadeOutDuration = this.audioController.getFadeOutDuration();
    this.updateFadeSettingsUI();
    
    // Update timer
    const remainingTime = this.audioController.getRemainingTime();
    if (remainingTime > 0) {
      this.timerDuration = Math.ceil(remainingTime / 60000); // Convert ms to minutes
      this.timerEndTime = new Date(Date.now() + remainingTime);
      this.updateTimerDisplay();
    }
  }
  
  /**
   * Set fade-in duration
   * @param {number} duration - Fade-in duration in seconds
   * @return {number} The actual duration set
   */
  setFadeInDuration(duration) {
    if (!this.audioController) return duration;
    
    // Validate input
    if (typeof duration !== 'number' || isNaN(duration) || duration < 0) {
      return this.fadeInDuration;
    }
    
    // Set fade-in duration in audio controller
    const actualDuration = this.audioController.setFadeInDuration(duration);
    
    // Update UI state
    this.fadeInDuration = actualDuration;
    this.updateFadeSettingsUI();
    
    // Save to local storage
    this.saveFadeInDurationToStorage(actualDuration);
    
    // Show feedback
    this.showFadeSettingsFeedback();
    
    return actualDuration;
  }
  
  /**
   * Set fade-out duration
   * @param {number} duration - Fade-out duration in seconds
   * @return {number} The actual duration set
   */
  setFadeOutDuration(duration) {
    if (!this.audioController) return duration;
    
    // Validate input
    if (typeof duration !== 'number' || isNaN(duration) || duration < 0) {
      return this.fadeOutDuration;
    }
    
    // Set fade-out duration in audio controller
    const actualDuration = this.audioController.setFadeOutDuration(duration);
    
    // Update UI state
    this.fadeOutDuration = actualDuration;
    this.updateFadeSettingsUI();
    
    // Save to local storage
    this.saveFadeOutDurationToStorage(actualDuration);
    
    // Show feedback
    this.showFadeSettingsFeedback();
    
    return actualDuration;
  }
  
  /**
   * Reset fade settings to defaults
   */
  resetFadeSettings() {
    if (!this.audioController) return;
    
    // Default values
    const defaultFadeIn = 2;
    const defaultFadeOut = 1;
    
    // Set in audio controller
    this.audioController.setFadeInDuration(defaultFadeIn);
    this.audioController.setFadeOutDuration(defaultFadeOut);
    
    // Update UI state
    this.fadeInDuration = defaultFadeIn;
    this.fadeOutDuration = defaultFadeOut;
    this.updateFadeSettingsUI();
    
    // Save to local storage
    this.saveFadeInDurationToStorage(defaultFadeIn);
    this.saveFadeOutDurationToStorage(defaultFadeOut);
    
    // Show feedback
    this.showFadeSettingsFeedback();
  }
  
  /**
   * Update fade settings UI elements
   */
  updateFadeSettingsUI() {
    // Update fade-in input if it exists
    if (this.dom.fadeInDurationInput) {
      this.dom.fadeInDurationInput.value = this.fadeInDuration;
    }
    
    // Update fade-out input if it exists
    if (this.dom.fadeOutDurationInput) {
      this.dom.fadeOutDurationInput.value = this.fadeOutDuration;
    }
  }
  
  /**
   * Show temporary feedback when fade settings are changed
   */
  showFadeSettingsFeedback() {
    // Find or create feedback element
    let feedbackElement = document.querySelector('.fade-settings-feedback');
    
    if (!feedbackElement) {
      feedbackElement = document.createElement('div');
      feedbackElement.className = 'fade-settings-feedback';
      feedbackElement.textContent = 'Settings updated';
      
      // Find fade settings control to append feedback
      const fadeSettingsControl = document.querySelector('.fade-settings-control');
      if (fadeSettingsControl) {
        fadeSettingsControl.appendChild(feedbackElement);
      }
    }
    
    // Show feedback
    feedbackElement.classList.add('visible');
    
    // Hide after delay
    setTimeout(() => {
      feedbackElement.classList.remove('visible');
    }, 1500);
  }
  
  /**
   * Save fade-in duration to local storage
   * @param {number} duration - Fade-in duration in seconds
   */
  saveFadeInDurationToStorage(duration) {
    try {
      localStorage.setItem('binauralBeats_fadeInDuration', duration.toString());
    } catch (error) {
      console.error('Failed to save fade-in duration to local storage:', error);
    }
  }
  
  /**
   * Load fade-in duration from local storage
   * @return {number|null} Fade-in duration or null if not found
   */
  loadFadeInDurationFromStorage() {
    try {
      const storedDuration = localStorage.getItem('binauralBeats_fadeInDuration');
      if (storedDuration !== null) {
        return parseFloat(storedDuration);
      }
    } catch (error) {
      console.error('Failed to load fade-in duration from local storage:', error);
    }
    return null;
  }
  
  /**
   * Save fade-out duration to local storage
   * @param {number} duration - Fade-out duration in seconds
   */
  saveFadeOutDurationToStorage(duration) {
    try {
      localStorage.setItem('binauralBeats_fadeOutDuration', duration.toString());
    } catch (error) {
      console.error('Failed to save fade-out duration to local storage:', error);
    }
  }
  
  /**
   * Load fade-out duration from local storage
   * @return {number|null} Fade-out duration or null if not found
   */
  loadFadeOutDurationFromStorage() {
    try {
      const storedDuration = localStorage.getItem('binauralBeats_fadeOutDuration');
      if (storedDuration !== null) {
        return parseFloat(storedDuration);
      }
    } catch (error) {
      console.error('Failed to load fade-out duration from local storage:', error);
    }
    return null;
  }

  /**
   * Show the add track modal
   */
  showAddTrackModal() {
    if (!this.dom.addTrackModal) return;
    
    this.dom.addTrackModal.classList.add('active');
  }
  
  /**
   * Hide the add track modal
   */
  hideAddTrackModal() {
    if (!this.dom.addTrackModal) return;
    
    this.dom.addTrackModal.classList.remove('active');
  }
  
  /**
   * Create a new track
   * @param {string} trackType - Track type: 'binaural', 'isochronic', or 'noise'
   * @return {string|null} Track ID if successful, null otherwise
   */
  createTrack(trackType) {
    if (!this.audioController) return null;
    
    // Default configuration for each track type
    let config = { volume: 0.5 };
    
    switch (trackType) {
      case 'binaural':
        config = {
          ...config,
          carrierFrequency: 200,
          beatFrequency: 10
        };
        break;
      case 'isochronic':
        config = {
          ...config,
          carrierFrequency: 200,
          beatFrequency: 7
        };
        break;
      case 'noise':
        config = {
          ...config,
          noiseType: 'pink'
        };
        break;
      default:
        console.error('Invalid track type:', trackType);
        return null;
    }
    
    // Create track in audio controller
    const trackId = this.audioController.createTrack(trackType, config);
    
    if (trackId) {
      // Create UI for track if callback is set
      if (this.trackCreatedCallback && typeof this.trackCreatedCallback === 'function') {
        this.trackCreatedCallback(trackId, trackType);
      }
      
      console.log(`Created ${trackType} track:`, trackId);
    }
    
    return trackId;
  }
  
  /**
   * Remove a track
   * @param {string} trackId - Track ID
   * @return {boolean} Success status
   */
  removeTrack(trackId) {
    if (!this.audioController) return false;
    
    // Remove track from audio controller
    const success = this.audioController.removeTrack(trackId);
    
    if (success) {
      // Remove track UI
      const trackPanel = document.querySelector(`.track-panel[data-track-id="${trackId}"]`);
      if (trackPanel && trackPanel.parentNode) {
        // Add fade-out animation
        trackPanel.classList.add('removing');
        
        // Remove after animation completes
        setTimeout(() => {
          if (trackPanel.parentNode) {
            trackPanel.parentNode.removeChild(trackPanel);
          }
        }, 300);
      }
      
      console.log('Removed track:', trackId);
    }
    
    return success;
  }
  
  /**
   * Update track parameters
   * @param {string} trackId - Track ID
   * @param {string} parameter - Parameter name
   * @param {any} value - Parameter value
   * @return {boolean} Success status
   */
  updateTrackParameter(trackId, parameter, value) {
    if (!this.audioController) return false;
    
    const params = {};
    params[parameter] = value;
    
    return this.audioController.updateTrack(trackId, params);
  }
  
  /**
   * Create UI for a track
   * @param {string} trackId - Track ID
   * @param {string} trackType - Track type
   * @return {HTMLElement|null} Created track panel element or null if failed
   */
  createTrackUI(trackId, trackType) {
    if (!this.dom.tracksContainer || !this.audioController) return null;
    
    const track = this.audioController.getTrack(trackId);
    if (!track) return null;
    
    // Create track panel element
    const trackPanel = document.createElement('div');
    trackPanel.className = `track-panel ${trackType}`;
    trackPanel.setAttribute('data-track-id', trackId);
    
    // Create track header
    const trackHeader = document.createElement('div');
    trackHeader.className = 'track-header';
    
    // Create track title
    const trackTitle = document.createElement('div');
    trackTitle.className = 'track-title';
    
    // Create track type indicator
    const trackTypeIndicator = document.createElement('div');
    trackTypeIndicator.className = 'track-type-indicator';
    
    let trackName = '';
    switch (trackType) {
      case 'binaural':
        trackName = 'Binaural Beat';
        trackTypeIndicator.textContent = 'Binaural';
        break;
      case 'isochronic':
        trackName = 'Isochronic Beat';
        trackTypeIndicator.textContent = 'Isochronic';
        break;
      case 'noise':
        trackName = 'Noise';
        trackTypeIndicator.textContent = 'Noise';
        break;
    }
    
    trackTitle.textContent = trackName;
    trackTitle.appendChild(trackTypeIndicator);
    trackHeader.appendChild(trackTitle);
    
    // Create collapse button
    const collapseButton = document.createElement('button');
    collapseButton.className = 'collapse-button';
    collapseButton.innerHTML = '▼';
    collapseButton.addEventListener('click', () => {
      trackPanel.classList.toggle('collapsed');
      collapseButton.innerHTML = trackPanel.classList.contains('collapsed') ? '▶' : '▼';
    });
    
    trackPanel.appendChild(collapseButton);
    trackPanel.appendChild(trackHeader);
    
    // Create track controls
    const trackControls = document.createElement('div');
    trackControls.className = 'track-controls';
    
    // Create track controls based on type
    if (trackType === 'binaural' || trackType === 'isochronic') {
      // Carrier frequency control
      const carrierGroup = document.createElement('div');
      carrierGroup.className = 'track-control-group';
      
      const carrierItem = document.createElement('div');
      carrierItem.className = 'track-control-item';
      
      const carrierLabel = document.createElement('label');
      carrierLabel.textContent = 'Carrier Frequency (Hz)';
      
      const carrierInput = document.createElement('input');
      carrierInput.type = 'range';
      carrierInput.min = '50';
      carrierInput.max = '500';
      carrierInput.step = '1';
      carrierInput.value = track.carrierFrequency.toString();
      
      const carrierValue = document.createElement('div');
      carrierValue.className = 'control-value';
      carrierValue.textContent = track.carrierFrequency.toFixed(2) + ' Hz';
      carrierValue.setAttribute('data-parameter', 'carrierFrequency');
      carrierValue.setAttribute('data-min', carrierInput.min);
      carrierValue.setAttribute('data-max', carrierInput.max);
      carrierValue.setAttribute('data-step', carrierInput.step);
      carrierValue.setAttribute('data-track-id', trackId);
      carrierValue.title = 'Click to edit value directly';
      
      // Make the value display clickable for direct input
      carrierValue.addEventListener('click', this._handleValueClick.bind(this));
      
      carrierInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        this.updateTrackParameter(trackId, 'carrierFrequency', value);
        carrierValue.textContent = value.toFixed(2) + ' Hz';
      });
      
      carrierItem.appendChild(carrierLabel);
      carrierItem.appendChild(carrierInput);
      carrierItem.appendChild(carrierValue);
      carrierGroup.appendChild(carrierItem);
      
      // Beat frequency control
      const beatItem = document.createElement('div');
      beatItem.className = 'track-control-item';
      
      const beatLabel = document.createElement('label');
      beatLabel.textContent = 'Beat Frequency (Hz)';
      
      const beatInput = document.createElement('input');
      beatInput.type = 'range';
      beatInput.min = '0.5';
      beatInput.max = '40';
      beatInput.step = '0.5';
      beatInput.value = track.beatFrequency.toString();
      
      const beatValue = document.createElement('div');
      beatValue.className = 'control-value';
      beatValue.textContent = track.beatFrequency.toFixed(2) + ' Hz';
      beatValue.setAttribute('data-parameter', 'beatFrequency');
      beatValue.setAttribute('data-min', beatInput.min);
      beatValue.setAttribute('data-max', beatInput.max);
      beatValue.setAttribute('data-step', beatInput.step);
      beatValue.setAttribute('data-track-id', trackId);
      beatValue.title = 'Click to edit value directly';
      
      // Make the value display clickable for direct input
      beatValue.addEventListener('click', this._handleValueClick.bind(this));
      
      beatInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        this.updateTrackParameter(trackId, 'beatFrequency', value);
        beatValue.textContent = value.toFixed(2) + ' Hz';
      });
      
      beatItem.appendChild(beatLabel);
      beatItem.appendChild(beatInput);
      beatItem.appendChild(beatValue);
      carrierGroup.appendChild(beatItem);
      
      trackControls.appendChild(carrierGroup);
    } else if (trackType === 'noise') {
      // Noise type control
      const noiseGroup = document.createElement('div');
      noiseGroup.className = 'track-control-group';
      
      const noiseItem = document.createElement('div');
      noiseItem.className = 'track-control-item';
      
      const noiseLabel = document.createElement('label');
      noiseLabel.textContent = 'Noise Type';
      
      const noiseSelect = document.createElement('select');
      
      const whiteOption = document.createElement('option');
      whiteOption.value = 'white';
      whiteOption.textContent = 'White Noise';
      
      const pinkOption = document.createElement('option');
      pinkOption.value = 'pink';
      pinkOption.textContent = 'Pink Noise';
      
      const brownOption = document.createElement('option');
      brownOption.value = 'brown';
      brownOption.textContent = 'Brown Noise';
      
      noiseSelect.appendChild(whiteOption);
      noiseSelect.appendChild(pinkOption);
      noiseSelect.appendChild(brownOption);
      
      noiseSelect.value = track.noiseType;
      
      noiseSelect.addEventListener('change', (e) => {
        this.updateTrackParameter(trackId, 'noiseType', e.target.value);
      });
      
      noiseItem.appendChild(noiseLabel);
      noiseItem.appendChild(noiseSelect);
      noiseGroup.appendChild(noiseItem);
      
      trackControls.appendChild(noiseGroup);
    }
    
    // Volume control (common to all track types)
    const volumeGroup = document.createElement('div');
    volumeGroup.className = 'track-control-group';
    
    const volumeItem = document.createElement('div');
    volumeItem.className = 'track-control-item';
    
    const volumeLabel = document.createElement('label');
    volumeLabel.textContent = 'Volume';
    
    const volumeInput = document.createElement('input');
    volumeInput.type = 'range';
    volumeInput.min = '0';
    volumeInput.max = '1';
    volumeInput.step = '0.01';
    volumeInput.value = track.getVolume().toString();
    
    const volumeValue = document.createElement('div');
    volumeValue.className = 'control-value';
    volumeValue.textContent = Math.round(track.getVolume() * 100) + '%';
    volumeValue.setAttribute('data-parameter', 'volume');
    volumeValue.setAttribute('data-min', '0');
    volumeValue.setAttribute('data-max', '1');
    volumeValue.setAttribute('data-step', '0.01');
    volumeValue.setAttribute('data-track-id', trackId);
    volumeValue.title = 'Click to edit value directly';
    
    // Make the value display clickable for direct input
    volumeValue.addEventListener('click', (event) => {
      const valueDisplay = event.currentTarget;
      const trackId = valueDisplay.getAttribute('data-track-id');
      const parameter = valueDisplay.getAttribute('data-parameter');
      const min = parseFloat(valueDisplay.getAttribute('data-min'));
      const max = parseFloat(valueDisplay.getAttribute('data-max'));
      
      // Get current value (remove the '%' suffix and convert to decimal)
      const currentValue = parseFloat(valueDisplay.textContent.replace('%', '')) / 100;
      
      // Create input element
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'control-value-input';
      input.value = Math.round(currentValue * 100);
      input.setAttribute('data-original-value', Math.round(currentValue * 100));
      
      // Add editing class to the display
      valueDisplay.classList.add('editing');
      
      // Clear the display text and append the input
      valueDisplay.textContent = '';
      valueDisplay.appendChild(input);
      
      // Focus the input and select all text
      input.focus();
      input.select();
      
      // Handle input validation and submission
      const handleInputChange = () => {
        let newPercentage = parseInt(input.value, 10);
        let isValid = !isNaN(newPercentage) && newPercentage >= 0 && newPercentage <= 100;
        
        if (isValid) {
          // Convert percentage to decimal
          const newValue = newPercentage / 100;
          
          // Update the track parameter
          this.updateTrackParameter(trackId, parameter, newValue);
          
          // Update the display
          valueDisplay.textContent = newPercentage + '%';
          valueDisplay.classList.remove('editing');
          valueDisplay.classList.remove('control-value-error');
          
          // Update the slider
          const slider = valueDisplay.parentNode.querySelector('input[type="range"]');
          if (slider) {
            slider.value = newValue;
          }
        } else {
          // Show error state
          valueDisplay.classList.add('control-value-error');
          
          // If completely invalid, revert to original value
          if (isNaN(newPercentage)) {
            const originalPercentage = parseInt(input.getAttribute('data-original-value'), 10);
            valueDisplay.textContent = originalPercentage + '%';
            valueDisplay.classList.remove('editing');
            valueDisplay.classList.remove('control-value-error');
          }
        }
      };
      
      // Handle Enter key
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleInputChange();
        } else if (e.key === 'Escape') {
          // Revert to original value on Escape
          const originalPercentage = parseInt(input.getAttribute('data-original-value'), 10);
          valueDisplay.textContent = originalPercentage + '%';
          valueDisplay.classList.remove('editing');
          valueDisplay.classList.remove('control-value-error');
        }
      });
      
      // Handle blur event (clicking outside)
      input.addEventListener('blur', handleInputChange);
    });
    
    volumeInput.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.updateTrackParameter(trackId, 'volume', value);
      volumeValue.textContent = Math.round(value * 100) + '%';
    });
    
    volumeItem.appendChild(volumeLabel);
    volumeItem.appendChild(volumeInput);
    volumeItem.appendChild(volumeValue);
    volumeGroup.appendChild(volumeItem);
    
    trackControls.appendChild(volumeGroup);
    trackPanel.appendChild(trackControls);
    
    // Create track actions
    const trackActions = document.createElement('div');
    trackActions.className = 'track-actions';
    
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-track-button';
    removeButton.textContent = 'Remove Track';
    removeButton.addEventListener('click', () => {
      this.removeTrack(trackId);
    });
    
    trackActions.appendChild(removeButton);
    trackPanel.appendChild(trackActions);
    
    // Add track panel to container with animation
    trackPanel.style.opacity = '0';
    trackPanel.style.transform = 'translateY(20px)';
    this.dom.tracksContainer.appendChild(trackPanel);
    
    // Trigger animation after a small delay (for the DOM to update)
    setTimeout(() => {
      trackPanel.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      trackPanel.style.opacity = '1';
      trackPanel.style.transform = 'translateY(0)';
    }, 10);
    
    return trackPanel;
  }
  
  /**
   * Clear all tracks
   */
  clearAllTracks() {
    if (!this.audioController || !this.dom.tracksContainer) return;
    
    // Copy array to avoid modification during iteration
    const trackIds = [...this.audioController.tracks.keys()];
    
    // Remove each track
    trackIds.forEach(trackId => {
      this.removeTrack(trackId);
    });
    
    // Clear tracks container
    this.dom.tracksContainer.innerHTML = '';
  }
  
  /**
   * Handle click on a frequency value display to make it editable
   * @param {Event} event - Click event
   * @private
   */
  _handleValueClick(event) {
    const valueDisplay = event.currentTarget;
    const trackId = valueDisplay.getAttribute('data-track-id');
    const parameter = valueDisplay.getAttribute('data-parameter');
    const min = parseFloat(valueDisplay.getAttribute('data-min'));
    const max = parseFloat(valueDisplay.getAttribute('data-max'));
    const step = parseFloat(valueDisplay.getAttribute('data-step'));
    
    // Get current value (remove the ' Hz' suffix)
    const currentValue = parseFloat(valueDisplay.textContent.replace(' Hz', ''));
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'control-value-input';
    input.value = currentValue.toFixed(2);
    input.setAttribute('data-original-value', currentValue.toFixed(2));
    
    // Add editing class to the display
    valueDisplay.classList.add('editing');
    
    // Clear the display text and append the input
    valueDisplay.textContent = '';
    valueDisplay.appendChild(input);
    
    // Focus the input and select all text
    input.focus();
    input.select();
    
    // Handle input validation and submission
    const handleInputChange = () => {
      let newValue = parseFloat(input.value);
      let isValid = !isNaN(newValue) && newValue >= min && newValue <= max;
      
      if (isValid) {
        // Round to 2 decimal places
        newValue = Math.round(newValue * 100) / 100;
        
        // Update the track parameter
        this.updateTrackParameter(trackId, parameter, newValue);
        
        // Update the display
        valueDisplay.textContent = newValue.toFixed(2) + ' Hz';
        valueDisplay.classList.remove('editing');
        valueDisplay.classList.remove('control-value-error');
        
        // Update the slider
        const slider = valueDisplay.parentNode.querySelector('input[type="range"]');
        if (slider) {
          slider.value = newValue;
        }
      } else {
        // Show error state
        valueDisplay.classList.add('control-value-error');
        
        // If completely invalid, revert to original value
        if (isNaN(newValue)) {
          const originalValue = parseFloat(input.getAttribute('data-original-value'));
          valueDisplay.textContent = originalValue.toFixed(2) + ' Hz';
          valueDisplay.classList.remove('editing');
          valueDisplay.classList.remove('control-value-error');
        }
      }
    };
    
    // Handle Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleInputChange();
      } else if (e.key === 'Escape') {
        // Revert to original value on Escape
        const originalValue = parseFloat(input.getAttribute('data-original-value'));
        valueDisplay.textContent = originalValue.toFixed(2) + ' Hz';
        valueDisplay.classList.remove('editing');
        valueDisplay.classList.remove('control-value-error');
      }
    });
    
    // Handle blur event (clicking outside)
    input.addEventListener('blur', handleInputChange);
  }
}