/**
 * Binaural Beats PWA - Main JavaScript
 * Main application entry point that integrates with the audio engine
 */

// Import the audio engine components
import AudioController from './audioEngine/AudioController.js';
import { BinauralTrack, IsochronicTrack, NoiseTrack } from './audioEngine/index.js';
import PresetManager from './presetManager.js';
import UIController from './uiController.js';

// Application state
const APP_STATE = {
  audioController: null,
  presetManager: null,
  uiController: null,
  activeTrackIds: [],
  deferredPrompt: null
};

// DOM Elements
const DOM = {
  playButton: null,
  masterVolumeSlider: null,
  volumeDisplay: null,
  timerDurationSelect: null,
  timerDisplay: null,
  addTrackButton: null,
  savePresetButton: null,
  loadPresetButton: null,
  tracksContainer: null,
  addTrackModal: null,
  presetModal: null,
  presetForm: null,
  presetList: null
};

// Initialize the application
document.addEventListener('DOMContentLoaded', initApp);

// Application initialization
function initApp() {
  // Initialize the application
  cacheDOM();
  checkAudioContextSupport();
  initPresetManager();
  initUIController();
  setupEventListeners();
}

// Initialize the UI controller
function initUIController() {
  try {
    // Create UI controller with references to audio controller, preset manager, and DOM elements
    APP_STATE.uiController = new UIController({
      audioController: APP_STATE.audioController,
      presetManager: APP_STATE.presetManager,
      domElements: DOM
    });
    
    // Set track created callback
    APP_STATE.uiController.setTrackCreatedCallback((trackId, trackType) => {
      APP_STATE.uiController.createTrackUI(trackId, trackType);
    });
    
    // UIController successfully initialized
  } catch (error) {
    console.error('Failed to initialize UIController:', error);
    showError('Failed to initialize UI controller. Some features may not work properly.');
  }
}

// Initialize the preset manager
async function initPresetManager() {
  try {
    APP_STATE.presetManager = new PresetManager();
    // PresetManager successfully initialized
    await loadPresetsFromStorage();
  } catch (error) {
    console.error('Failed to initialize PresetManager:', error);
    showError('Failed to initialize preset system. Some features may not work properly.');
  }
}

// Cache DOM elements
function cacheDOM() {
  DOM.playButton = document.getElementById('play-button');
  DOM.masterVolumeSlider = document.getElementById('master-volume');
  DOM.volumeDisplay = document.getElementById('volume-display');
  DOM.timerDurationSelect = document.getElementById('timer-duration');
  DOM.timerDisplay = document.getElementById('timer-display');
  DOM.addTrackButton = document.getElementById('add-track-button');
  DOM.savePresetButton = document.getElementById('save-preset-button');
  DOM.loadPresetButton = document.getElementById('load-preset-button');
  DOM.tracksContainer = document.getElementById('tracks-container');
  DOM.addTrackModal = document.getElementById('add-track-modal');
  DOM.presetModal = document.getElementById('preset-modal');
  DOM.presetForm = document.getElementById('preset-form');
  DOM.presetList = document.getElementById('preset-list');
}

// Check if Web Audio API is supported
function checkAudioContextSupport() {
  try {
    // Feature detection
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    if (typeof AudioContext !== 'undefined') {
      console.log('Web Audio API is supported');
      // Initialize the audio controller (but don't start it yet)
      APP_STATE.audioController = new AudioController({
        masterVolume: APP_STATE.masterVolume
      });
    } else {
      showError('Your browser does not support the Web Audio API. Please use a modern browser.');
    }
  } catch (e) {
    showError('Error initializing audio system: ' + e.message);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Master controls
  if (DOM.playButton) {
    DOM.playButton.addEventListener('click', () => {
      if (APP_STATE.uiController) {
        APP_STATE.uiController.togglePlayback();
      }
    });
  }
  
  // Help button
  const helpButton = document.getElementById('help-button');
  const helpModal = document.getElementById('help-modal');
  
  if (helpButton && helpModal) {
    // Open help modal
    helpButton.addEventListener('click', () => {
      helpModal.classList.add('active');
    });
    
    // Close help modal
    const closeButtons = helpModal.querySelectorAll('.close-button');
    closeButtons.forEach(button => {
      button.addEventListener('click', () => {
        helpModal.classList.remove('active');
      });
    });
    
    // Close when clicking outside
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        helpModal.classList.remove('active');
      }
    });
  }
  
  if (DOM.masterVolumeSlider) {
    DOM.masterVolumeSlider.addEventListener('input', (e) => {
      if (APP_STATE.uiController) {
        const volume = parseFloat(e.target.value);
        APP_STATE.uiController.setMasterVolume(volume);
      }
    });
  }
  
  if (DOM.timerDurationSelect) {
    DOM.timerDurationSelect.addEventListener('change', (e) => {
      if (APP_STATE.uiController) {
        const durationMinutes = parseInt(e.target.value, 10);
        APP_STATE.uiController.setTimerDuration(durationMinutes);
      }
    });
  }
  
  if (DOM.addTrackButton) {
    DOM.addTrackButton.addEventListener('click', () => {
      if (APP_STATE.uiController) {
        APP_STATE.uiController.showAddTrackModal();
      }
    });
  }
  
  if (DOM.savePresetButton) {
    DOM.savePresetButton.addEventListener('click', () => showPresetModal('save'));
  }
  
  if (DOM.loadPresetButton) {
    DOM.loadPresetButton.addEventListener('click', () => showPresetModal('load'));
  }
  
  // Add track modal
  if (DOM.addTrackModal) {
    // Close button
    const closeButtons = DOM.addTrackModal.querySelectorAll('.close-button');
    closeButtons.forEach(button => {
      button.addEventListener('click', () => {
        if (APP_STATE.uiController) {
          APP_STATE.uiController.hideAddTrackModal();
        }
      });
    });
    
    // Track type buttons
    const trackTypeButtons = DOM.addTrackModal.querySelectorAll('.track-type-button');
    trackTypeButtons.forEach(button => {
      button.addEventListener('click', () => {
        if (APP_STATE.uiController) {
          const trackType = button.getAttribute('data-track-type');
          APP_STATE.uiController.createTrack(trackType);
          APP_STATE.uiController.hideAddTrackModal();
        }
      });
    });
    
    // Close when clicking outside the modal content
    DOM.addTrackModal.addEventListener('click', (e) => {
      if (e.target === DOM.addTrackModal && APP_STATE.uiController) {
        APP_STATE.uiController.hideAddTrackModal();
      }
    });
  }
  
  // Preset modal
  if (DOM.presetModal) {
    // Close button
    const closeButtons = DOM.presetModal.querySelectorAll('.close-button, .preset-cancel-button');
    closeButtons.forEach(button => {
      button.addEventListener('click', hidePresetModal);
    });
    
    // Action button
    const actionButton = document.getElementById('preset-action-button');
    if (actionButton) {
      actionButton.addEventListener('click', handlePresetAction);
    }
    
    // Close when clicking outside the modal content
    DOM.presetModal.addEventListener('click', (e) => {
      if (e.target === DOM.presetModal) {
        hidePresetModal();
      }
    });
  }

  // Handle visibility change to pause audio when tab is not visible
  document.addEventListener('visibilitychange', () => {
    if (!APP_STATE.audioController) return;
    
    if (document.hidden && APP_STATE.audioController.isPlaying) {
      // Pause audio when tab is hidden
      pauseAudioEngine();
    } else if (!document.hidden && APP_STATE.audioController.isPlaying) {
      // Resume audio when tab becomes visible again
      resumeAudioEngine();
    }
  });
}

// Toggle playback (play/stop)
function togglePlayback() {
  if (APP_STATE.uiController) {
    APP_STATE.uiController.togglePlayback();
  }
}

// Start playback
function startPlayback() {
  if (!APP_STATE.uiController) return;
  
  // Create default tracks if none exist
  if (APP_STATE.activeTrackIds.length === 0) {
    createDefaultTracks();
  }
  
  // Start playback with fade-in
  APP_STATE.uiController.startPlayback();
}

// Stop playback
function stopPlayback() {
  if (!APP_STATE.uiController) return;
  
  // Stop playback with fade-out
  APP_STATE.uiController.stopPlayback();
}

// Update play button state
function updatePlayButtonState() {
  if (!DOM.playButton) return;
  
  const iconSpan = DOM.playButton.querySelector('.button-icon');
  const textSpan = DOM.playButton.querySelector('.button-text');
  
  if (APP_STATE.isPlaying) {
    iconSpan.textContent = '■';
    textSpan.textContent = 'Stop';
    DOM.playButton.style.backgroundColor = 'var(--error)';
  } else {
    iconSpan.textContent = '▶';
    textSpan.textContent = 'Play';
    DOM.playButton.style.backgroundColor = 'var(--accent-primary)';
  }
}

// Handle master volume change
function handleMasterVolumeChange(e) {
  const volume = parseFloat(e.target.value);
  setMasterVolume(volume);
}

// Set master volume
function setMasterVolume(volume) {
  if (APP_STATE.uiController) {
    return APP_STATE.uiController.setMasterVolume(volume);
  }
  return volume;
}

// Handle timer duration change
function handleTimerDurationChange(e) {
  if (APP_STATE.uiController) {
    const durationMinutes = parseInt(e.target.value, 10);
    APP_STATE.uiController.setTimerDuration(durationMinutes);
  }
}

// Start timer
function startTimer(durationMinutes) {
  if (APP_STATE.uiController) {
    APP_STATE.uiController.startTimer(durationMinutes);
  }
}

// Stop timer
function stopTimer() {
  if (APP_STATE.uiController) {
    APP_STATE.uiController.stopTimer();
  }
}

// Update timer display
function updateTimerDisplay() {
  if (APP_STATE.uiController) {
    APP_STATE.uiController.updateTimerDisplay();
  }
}

// Pause the audio engine (when tab is hidden)
function pauseAudioEngine() {
  if (APP_STATE.audioController && APP_STATE.audioController.isInitialized) {
    // Just suspend the audio context without stopping tracks
    APP_STATE.audioController.audioContext.suspend();
    console.log('Audio engine paused (tab hidden)');
  }
}

// Resume the audio engine (when tab becomes visible)
function resumeAudioEngine() {
  if (APP_STATE.audioController && APP_STATE.audioController.isInitialized) {
    // Resume the audio context
    APP_STATE.audioController.audioContext.resume();
    console.log('Audio engine resumed (tab visible)');
    
    // Sync UI controller with audio controller state
    if (APP_STATE.uiController) {
      APP_STATE.uiController.syncWithAudioController();
    }
  }
}

// Show add track modal
function showAddTrackModal() {
  if (DOM.addTrackModal) {
    DOM.addTrackModal.classList.add('active');
  }
}

// Hide add track modal
function hideAddTrackModal() {
  if (DOM.addTrackModal) {
    DOM.addTrackModal.classList.remove('active');
  }
}

// Show preset modal
function showPresetModal(mode) {
  if (!DOM.presetModal) return;
  
  const modalTitle = document.getElementById('preset-modal-title');
  const actionButton = document.getElementById('preset-action-button');
  
  // Set modal mode
  DOM.presetModal.setAttribute('data-mode', mode);
  
  if (mode === 'save') {
    // Setup for save mode
    if (modalTitle) modalTitle.textContent = 'Save Preset';
    if (actionButton) actionButton.textContent = 'Save';
    
    // Show form, hide list
    if (DOM.presetForm) DOM.presetForm.style.display = 'block';
    if (DOM.presetList) DOM.presetList.style.display = 'none';
  } else {
    // Setup for load mode
    if (modalTitle) modalTitle.textContent = 'Load Preset';
    
    // Hide form, show list
    if (DOM.presetForm) DOM.presetForm.style.display = 'none';
    if (DOM.presetList) DOM.presetList.style.display = 'block';
    
    // Populate preset list
    populatePresetList();
  }
  
  // Show modal
  DOM.presetModal.classList.add('active');
}

// Hide preset modal
function hidePresetModal() {
  if (DOM.presetModal) {
    DOM.presetModal.classList.remove('active');
  }
}

// Handle preset action (save or delete)
function handlePresetAction() {
  const mode = DOM.presetModal.getAttribute('data-mode');
  
  if (mode === 'save') {
    savePreset();
  }
  
  hidePresetModal();
}

// Save current preset
async function savePreset() {
  if (!APP_STATE.presetManager || !APP_STATE.audioController) {
    showError('Preset system not initialized');
    return;
  }
  
  const presetNameInput = document.getElementById('preset-name');
  if (!presetNameInput) return;
  
  const presetName = presetNameInput.value.trim() || 'My Preset';
  
  try {
    // Create configuration from current audio controller state
    const configuration = APP_STATE.presetManager.createConfigurationFromAudioController(APP_STATE.audioController);
    
    // Save preset with configuration
    const savedPreset = await APP_STATE.presetManager.savePreset(presetName, configuration);
    
    console.log('Preset saved:', savedPreset);
    
    // Show success message
    showMessage(`Preset "${presetName}" saved successfully`);
    
    // Clear input field
    presetNameInput.value = '';
  } catch (error) {
    console.error('Failed to save preset:', error);
    
    // Show error message
    if (error.message.includes('already exists')) {
      showError(`A preset named "${presetName}" already exists. Please use a different name.`);
    } else {
      showError('Failed to save preset. Please try again.');
    }
  }
}

// Show a temporary message to the user
function showMessage(message, duration = 3000) {
  // Create message element if it doesn't exist
  let messageElement = document.getElementById('app-message');
  
  if (!messageElement) {
    messageElement = document.createElement('div');
    messageElement.id = 'app-message';
    messageElement.className = 'app-message';
    document.body.appendChild(messageElement);
  }
  
  // Set message text and show
  messageElement.textContent = message;
  messageElement.classList.add('active');
  
  // Hide after duration
  setTimeout(() => {
    messageElement.classList.remove('active');
  }, duration);
}

// Show an error message to the user
function showError(message, duration = 5000) {
  // Create error element if it doesn't exist
  let errorElement = document.getElementById('app-error');
  
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.id = 'app-error';
    errorElement.className = 'app-error';
    document.body.appendChild(errorElement);
  }
  
  // Set error text and show
  errorElement.textContent = message;
  errorElement.classList.add('active');
  
  // Hide after duration
  setTimeout(() => {
    errorElement.classList.remove('active');
  }, duration);
}

// Load preset
async function loadPreset(presetId) {
  if (!APP_STATE.uiController) {
    showError('UI controller not initialized');
    return;
  }
  
  try {
    // Load preset using UI controller
    const preset = await APP_STATE.uiController.loadPreset(presetId);
    
    // Update active track IDs
    if (APP_STATE.audioController) {
      APP_STATE.activeTrackIds = Array.from(APP_STATE.audioController.tracks.keys());
    }
    
    if (preset) {
      showMessage(`Preset "${preset.name}" loaded successfully`);
    }
  } catch (error) {
    console.error('Failed to load preset:', error);
    showError('Failed to load preset. Please try again.');
  }
}

// Delete preset
async function deletePreset(presetId) {
  if (!APP_STATE.presetManager) {
    showError('Preset system not initialized');
    return;
  }
  
  try {
    // Get preset by ID to get its name
    const presets = await APP_STATE.presetManager.listPresets();
    const preset = presets.find(p => p.id === presetId);
    
    if (!preset) {
      showError('Preset not found');
      return;
    }
    
    // Delete preset by ID
    await APP_STATE.presetManager.deletePreset(preset.name);
    
    // Update UI
    populatePresetList();
    
    console.log('Preset deleted:', preset.name);
    showMessage(`Preset "${preset.name}" deleted`);
  } catch (error) {
    console.error('Failed to delete preset:', error);
    showError('Failed to delete preset. Please try again.');
  }
}

// Populate preset list
async function populatePresetList() {
  if (!DOM.presetList || !APP_STATE.presetManager) return;
  
  // Clear existing items
  DOM.presetList.innerHTML = '';
  
  try {
    // Get presets from IndexedDB
    const presets = await APP_STATE.presetManager.listPresets({
      sortBy: 'createdAt',
      ascending: false
    });
    
    if (presets.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'preset-empty-message';
      emptyMessage.textContent = 'No saved presets';
      DOM.presetList.appendChild(emptyMessage);
      return;
    }
    
    // Add preset items
    presets.forEach(preset => {
      const presetItem = document.createElement('div');
      presetItem.className = 'preset-item';
      
      // Format creation date
      const createdDate = new Date(preset.createdAt);
      const dateString = createdDate.toLocaleDateString();
      
      presetItem.innerHTML = `
        <div class="preset-item-name">${preset.name}</div>
        <div class="preset-item-date">${dateString}</div>
        <div class="preset-item-actions">
          <button class="preset-item-button load" title="Load preset">Load</button>
          <button class="preset-item-button delete" title="Delete preset">×</button>
        </div>
      `;
      
      // Add event listeners
      const loadButton = presetItem.querySelector('.load');
      const deleteButton = presetItem.querySelector('.delete');
      
      if (loadButton) {
        loadButton.addEventListener('click', () => {
          loadPreset(preset.id);
          hidePresetModal();
        });
      }
      
      if (deleteButton) {
        deleteButton.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Delete preset "${preset.name}"?`)) {
            deletePreset(preset.id);
          }
        });
      }
      
      DOM.presetList.appendChild(presetItem);
    });
  } catch (error) {
    console.error('Failed to populate preset list:', error);
    
    const errorMessage = document.createElement('div');
    errorMessage.className = 'preset-error-message';
    errorMessage.textContent = 'Failed to load presets';
    DOM.presetList.appendChild(errorMessage);
  }
}

// This function is no longer needed as PresetManager handles storage automatically
// Kept as a no-op for backward compatibility
function savePresetsToStorage() {
  // No operation needed - IndexedDB storage is handled by PresetManager
}

// Load presets from IndexedDB storage
async function loadPresetsFromStorage() {
  if (!APP_STATE.presetManager) {
    console.error('PresetManager not initialized');
    return;
  }
  
  try {
    // List all presets sorted by creation date (newest first)
    const presets = await APP_STATE.presetManager.listPresets({
      sortBy: 'createdAt',
      ascending: false
    });
    
    console.log('Loaded presets from IndexedDB:', presets.length);
    
    // Update UI if preset list is visible
    if (DOM.presetModal && DOM.presetModal.classList.contains('active')) {
      populatePresetList();
    }
  } catch (error) {
    console.error('Failed to load presets from IndexedDB:', error);
    showError('Failed to load presets. Please try again later.');
  }
}

// Create default tracks
function createDefaultTracks() {
  if (!APP_STATE.uiController) return;
  
  // Create a binaural beat track
  APP_STATE.uiController.createTrack('binaural');
  
  // Create a noise track
  APP_STATE.uiController.createTrack('noise');
}

// Create a new track
function createNewTrack(trackType) {
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
  }
  
  createTrackFromConfig({ type: trackType, ...config });
}

// Create track from configuration
function createTrackFromConfig(config) {
  if (!APP_STATE.audioController) return;
  
  // Create track
  const trackId = APP_STATE.audioController.createTrack(config.type, config);
  
  if (trackId) {
    // Add to active tracks
    APP_STATE.activeTrackIds.push(trackId);
    
    // Create UI for track
    createTrackUI(trackId, config.type);
    
    console.log(`Created ${config.type} track:`, trackId);
  }
}

// Create UI for a track
function createTrackUI(trackId, trackType) {
  if (!DOM.tracksContainer) return;
  
  const track = APP_STATE.audioController.getTrack(trackId);
  if (!track) return;
  
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
    carrierValue.addEventListener('click', handleValueClick);
    
    carrierInput.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (APP_STATE.uiController) {
        APP_STATE.uiController.updateTrackParameter(trackId, 'carrierFrequency', value);
        carrierValue.textContent = value.toFixed(2) + ' Hz';
      }
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
    beatValue.addEventListener('click', handleValueClick);
    
    beatInput.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (APP_STATE.uiController) {
        APP_STATE.uiController.updateTrackParameter(trackId, 'beatFrequency', value);
        beatValue.textContent = value.toFixed(2) + ' Hz';
      }
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
      if (APP_STATE.uiController) {
        APP_STATE.uiController.updateTrackParameter(trackId, 'noiseType', e.target.value);
      }
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
  volumeValue.addEventListener('click', handleVolumeValueClick);
  
  volumeInput.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (APP_STATE.uiController) {
      APP_STATE.uiController.updateTrackParameter(trackId, 'volume', value);
      volumeValue.textContent = Math.round(value * 100) + '%';
    }
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
    if (APP_STATE.uiController) {
      APP_STATE.uiController.removeTrack(trackId);
    }
  });
  
  trackActions.appendChild(removeButton);
  trackPanel.appendChild(trackActions);
  
  // Add track panel to container
  DOM.tracksContainer.appendChild(trackPanel);
}

// Update track parameter
function updateTrackParameter(trackId, parameter, value) {
  if (!APP_STATE.audioController) return;
  
  const params = {};
  params[parameter] = value;
  
  APP_STATE.audioController.updateTrack(trackId, params);
}

// Remove track
function removeTrack(trackId) {
  if (!APP_STATE.audioController) return;
  
  // Remove from audio controller
  APP_STATE.audioController.removeTrack(trackId);
  
  // Remove from active tracks
  APP_STATE.activeTrackIds = APP_STATE.activeTrackIds.filter(id => id !== trackId);
  
  // Remove UI
  const trackPanel = document.querySelector(`.track-panel[data-track-id="${trackId}"]`);
  if (trackPanel && trackPanel.parentNode) {
    trackPanel.parentNode.removeChild(trackPanel);
  }
  
  console.log('Removed track:', trackId);
}

// Clear all tracks
function clearAllTracks() {
  if (!APP_STATE.audioController) return;
  
  // Copy array to avoid modification during iteration
  const trackIds = [...APP_STATE.activeTrackIds];
  
  // Remove each track
  trackIds.forEach(trackId => {
    removeTrack(trackId);
  });
  
  // Clear tracks container
  if (DOM.tracksContainer) {
    DOM.tracksContainer.innerHTML = '';
  }
}

/**
 * Handle click on a frequency value display to make it editable
 * @param {Event} event - Click event
 */
function handleValueClick(event) {
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
      if (APP_STATE.uiController) {
        APP_STATE.uiController.updateTrackParameter(trackId, parameter, newValue);
      }
      
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

/**
 * Handle click on a volume value display to make it editable
 * @param {Event} event - Click event
 */
function handleVolumeValueClick(event) {
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
      if (APP_STATE.uiController) {
        APP_STATE.uiController.updateTrackParameter(trackId, parameter, newValue);
      }
      
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
}
  
