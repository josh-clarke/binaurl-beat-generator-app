/**
 * PresetManager.js - Preset management system for the Binaural Beats PWA
 * 
 * This class provides persistent storage of user presets using IndexedDB.
 * It allows saving, loading, and managing presets for the audio engine.
 */

/**
 * Class representing a preset manager for storing and retrieving audio configurations
 */
export default class PresetManager {
  /**
   * Create a new PresetManager
   * @param {Object} options - Configuration options
   * @param {string} options.dbName - IndexedDB database name (default: 'binauralBeatsDB')
   * @param {string} options.storeName - IndexedDB object store name (default: 'presets')
   * @param {number} options.dbVersion - IndexedDB database version (default: 1)
   */
  constructor(options = {}) {
    // Database configuration
    this.dbName = options.dbName || 'binauralBeatsDB';
    this.storeName = options.storeName || 'presets';
    this.dbVersion = options.dbVersion || 1;
    
    // Database connection
    this.db = null;
    
    // Initialize database
    this._initDatabase();
  }
  
  /**
   * Initialize the IndexedDB database
   * @private
   * @return {Promise} Resolves when database is initialized
   */
  _initDatabase() {
    return new Promise((resolve, reject) => {
      // Open database connection
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      // Handle database upgrade (called when database is created or version changes)
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store for presets if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          // Create object store with auto-incrementing key
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          
          // Create indexes for searching
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        console.log(`IndexedDB store '${this.storeName}' created or upgraded`);
      };
      
      // Handle successful database open
      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log(`IndexedDB '${this.dbName}' opened successfully`);
        resolve(this.db);
      };
      
      // Handle database open error
      request.onerror = (event) => {
        const error = new Error(`Failed to open IndexedDB: ${event.target.error}`);
        console.error(error);
        reject(error);
      };
    });
  }
  
  /**
   * Get database connection, initializing if necessary
   * @private
   * @return {Promise<IDBDatabase>} Resolves with database connection
   */
  async _getDB() {
    if (this.db) {
      return this.db;
    }
    
    return this._initDatabase();
  }
  
  /**
   * Perform a database transaction
   * @private
   * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
   * @param {Function} callback - Callback function that receives the object store
   * @return {Promise} Resolves with the result of the callback
   */
  async _transaction(mode, callback) {
    try {
      const db = await this._getDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, mode);
        const store = transaction.objectStore(this.storeName);
        
        // Handle transaction errors
        transaction.onerror = (event) => {
          reject(new Error(`Transaction error: ${event.target.error}`));
        };
        
        // Execute callback with store object
        callback(store, resolve, reject);
      });
    } catch (error) {
      console.error('Database transaction error:', error);
      throw error;
    }
  }
  
  /**
   * Save a preset to the database
   * @param {string} name - Preset name
   * @param {Object} configuration - Audio configuration to save
   * @return {Promise<Object>} Resolves with the saved preset object
   * @throws {Error} If a preset with the same name already exists or if saving fails
   */
  async savePreset(name, configuration) {
    // Validate inputs
    if (!name || typeof name !== 'string') {
      throw new Error('Preset name is required and must be a string');
    }
    
    if (!configuration || typeof configuration !== 'object') {
      throw new Error('Configuration is required and must be an object');
    }
    
    // Check for duplicate name
    try {
      const existingPreset = await this.findPresetByName(name);
      if (existingPreset) {
        throw new Error(`A preset with the name "${name}" already exists`);
      }
    } catch (error) {
      // If error is not about duplicate, rethrow
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
    
    // Create preset object
    const preset = {
      id: Date.now().toString(), // Unique ID based on timestamp
      name: name.trim(),
      createdAt: new Date().toISOString(),
      configuration
    };
    
    // Save to database
    return this._transaction('readwrite', (store, resolve, reject) => {
      const request = store.add(preset);
      
      request.onsuccess = () => {
        console.log(`Preset "${name}" saved successfully`);
        resolve(preset);
      };
      
      request.onerror = (event) => {
        reject(new Error(`Failed to save preset: ${event.target.error}`));
      };
    });
  }
  
  /**
   * Load a preset by name
   * @param {string} name - Name of the preset to load
   * @return {Promise<Object>} Resolves with the preset object
   * @throws {Error} If preset is not found or if loading fails
   */
  async loadPreset(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Preset name is required and must be a string');
    }
    
    const preset = await this.findPresetByName(name);
    
    if (!preset) {
      throw new Error(`Preset "${name}" not found`);
    }
    
    return preset;
  }
  
  /**
   * Find a preset by name
   * @private
   * @param {string} name - Name of the preset to find
   * @return {Promise<Object|null>} Resolves with the preset object or null if not found
   */
  async findPresetByName(name) {
    return this._transaction('readonly', (store, resolve) => {
      const index = store.index('name');
      const request = index.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (cursor) {
          // Case-insensitive comparison
          if (cursor.value.name.toLowerCase() === name.toLowerCase().trim()) {
            resolve(cursor.value);
            return;
          }
          cursor.continue();
        } else {
          // No matching preset found
          resolve(null);
        }
      };
    });
  }
  
  /**
   * Delete a preset by name
   * @param {string} name - Name of the preset to delete
   * @return {Promise<boolean>} Resolves with true if deleted, false if not found
   * @throws {Error} If deletion fails
   */
  async deletePreset(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Preset name is required and must be a string');
    }
    
    // Find the preset first to get its ID
    const preset = await this.findPresetByName(name);
    
    if (!preset) {
      return false; // Preset not found
    }
    
    // Delete the preset by ID
    return this._transaction('readwrite', (store, resolve, reject) => {
      const request = store.delete(preset.id);
      
      request.onsuccess = () => {
        console.log(`Preset "${name}" deleted successfully`);
        resolve(true);
      };
      
      request.onerror = (event) => {
        reject(new Error(`Failed to delete preset: ${event.target.error}`));
      };
    });
  }
  
  /**
   * List all available presets
   * @param {Object} options - Listing options
   * @param {string} options.sortBy - Field to sort by ('name', 'createdAt')
   * @param {boolean} options.ascending - Sort in ascending order
   * @return {Promise<Array>} Resolves with array of preset objects
   */
  async listPresets(options = {}) {
    const sortBy = options.sortBy || 'createdAt';
    const ascending = options.ascending !== false; // Default to ascending
    
    return this._transaction('readonly', (store, resolve) => {
      const presets = [];
      
      // Use appropriate index for sorting
      let request;
      if (sortBy === 'name') {
        const index = store.index('name');
        request = index.openCursor(null, ascending ? 'next' : 'prev');
      } else {
        // Default to sorting by createdAt
        const index = store.index('createdAt');
        request = index.openCursor(null, ascending ? 'next' : 'prev');
      }
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (cursor) {
          presets.push(cursor.value);
          cursor.continue();
        } else {
          resolve(presets);
        }
      };
    });
  }
  
  /**
   * Convert AudioController state to a saveable preset configuration
   * @param {AudioController} audioController - The audio controller instance
   * @return {Object} Configuration object ready to be saved
   */
  createConfigurationFromAudioController(audioController) {
    if (!audioController) {
      throw new Error('AudioController instance is required');
    }
    
    // Create configuration object
    const configuration = {
      masterVolume: audioController.getMasterVolume(),
      timerDuration: audioController.getRemainingTime(),
      fadeInDuration: audioController.getFadeInDuration(),
      fadeOutDuration: audioController.getFadeOutDuration(),
      tracks: []
    };
    
    // Add track configurations
    for (const track of audioController.tracks.values()) {
      // Determine track type
      let trackType;
      let trackConfig = {
        volume: track.getVolume()
      };
      
      if (track.constructor.name === 'BinauralTrack') {
        trackType = 'binaural';
        trackConfig.carrierFrequency = track.carrierFrequency;
        trackConfig.beatFrequency = track.beatFrequency;
      } else if (track.constructor.name === 'IsochronicTrack') {
        trackType = 'isochronic';
        trackConfig.carrierFrequency = track.carrierFrequency;
        trackConfig.beatFrequency = track.beatFrequency;
      } else if (track.constructor.name === 'NoiseTrack') {
        trackType = 'noise';
        trackConfig.noiseType = track.noiseType;
      } else {
        // Skip unknown track types
        continue;
      }
      
      // Add track type to config
      trackConfig.type = trackType;
      
      // Add to tracks array
      configuration.tracks.push(trackConfig);
    }
    
    return configuration;
  }
  
  /**
   * Apply a preset configuration to an AudioController
   * @param {Object} configuration - The preset configuration
   * @param {AudioController} audioController - The audio controller instance
   * @param {Function} trackCreatedCallback - Optional callback when a track is created
   * @return {Promise<void>} Resolves when configuration is applied
   */
  async applyConfigurationToAudioController(configuration, audioController, trackCreatedCallback) {
    if (!configuration || !audioController) {
      throw new Error('Configuration and AudioController are required');
    }
    
    // Store current playback state
    const wasPlaying = audioController.isPlaying;
    
    // Stop playback if playing
    if (wasPlaying) {
      await audioController.stopAll();
    }
    
    // Clear existing tracks
    for (const trackId of [...audioController.tracks.keys()]) {
      audioController.removeTrack(trackId);
    }
    
    // Set master volume
    if (typeof configuration.masterVolume === 'number') {
      audioController.setMasterVolume(configuration.masterVolume);
    }
    
    // Set fade durations (with backward compatibility)
    if (typeof configuration.fadeInDuration === 'number') {
      audioController.setFadeInDuration(configuration.fadeInDuration);
    }
    
    if (typeof configuration.fadeOutDuration === 'number') {
      audioController.setFadeOutDuration(configuration.fadeOutDuration);
    }
    
    // Create tracks from configuration
    for (const trackConfig of configuration.tracks) {
      const trackId = audioController.createTrack(trackConfig.type, trackConfig);
      
      // Call callback if provided
      if (trackCreatedCallback && typeof trackCreatedCallback === 'function') {
        trackCreatedCallback(trackId, trackConfig.type);
      }
    }
    
    // Set timer if specified
    if (configuration.timerDuration > 0) {
      audioController.startTimer(configuration.timerDuration);
    }
    
    // Restart playback if it was playing
    if (wasPlaying) {
      audioController.startAll();
    }
  }
  
  /**
   * Close the database connection
   * @return {Promise<void>} Resolves when connection is closed
   */
  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log(`IndexedDB '${this.dbName}' connection closed`);
    }
  }
}