/**
 * AudioExporter.js - Audio export functionality for the Binaural Beats PWA
 *
 * This class handles exporting audio from the binaural beat generator.
 * It supports WAV and MP3 formats and provides progress tracking and error handling.
 * Uses OfflineAudioContext for fast, non-realtime rendering.
 */

export default class AudioExporter {
  /**
   * Create a new AudioExporter
   * @param {Object} options - Configuration options
   * @param {AudioContext} options.audioContext - The Web Audio API context
   * @param {number} options.maxDuration - Maximum recording duration in seconds (default: 3600)
   * @param {number} options.bufferSize - Size of audio buffer chunks in bytes (default: 4096)
   * @param {number} options.sampleRate - Sample rate for exported audio (default: audioContext.sampleRate)
   * @param {Object} options.mp3Options - MP3 encoding options
   * @param {number} options.mp3Options.bitRate - MP3 bitrate in kbps (default: 192)
   * @param {string} options.mp3Options.quality - MP3 quality: 'low', 'medium', 'high' (default: 'medium')
   */
  constructor(options = {}) {
    // Required parameters
    if (!options.audioContext) {
      throw new Error('AudioContext is required to create an AudioExporter');
    }
    
    this.audioContext = options.audioContext;
    
    // Optional parameters with defaults
    this.maxDuration = options.maxDuration || 3600; // Default max duration: 1 hour
    this.bufferSize = options.bufferSize || 4096;
    this.sampleRate = options.sampleRate || this.audioContext.sampleRate;
    
    // MP3 encoding options
    this.mp3Options = {
      bitRate: options.mp3Options?.bitRate || 192, // Default: 192 kbps
      quality: options.mp3Options?.quality || 'medium' // Default: medium quality
    };
    
    // Internal state
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.recordingStartTime = 0;
    this.recordingDuration = 0;
    this.exportFormat = 'wav'; // Default format
    this.exportProgress = 0;
    this.exportCancelled = false;
    this.exportFilename = ''; // Custom filename
    
    // Source and destination nodes
    this.sourceNode = null;
    this.destinationNode = null;
    
    // Callbacks
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
    
    // Check for MediaRecorder support (for legacy fallback)
    this.isSupported = typeof MediaRecorder !== 'undefined' || typeof OfflineAudioContext !== 'undefined';
    
    // Memory management
    this.maxChunkCount = 1000; // Prevent memory issues with very long recordings
    this.throttleInterval = null;
    
    // Offline rendering state
    this.offlineContext = null;
    this.isOfflineRendering = false;
    this.renderStartTime = 0;
  }
  
  /**
   * Check if audio export is supported in the current browser
   * @return {boolean} Whether export is supported
   */
  static isSupported() {
    return typeof MediaRecorder !== 'undefined' || typeof OfflineAudioContext !== 'undefined';
  }
  
  /**
   * Check if fast export using OfflineAudioContext is supported
   * @return {boolean} Whether fast export is supported
   */
  static isFastExportSupported() {
    return typeof OfflineAudioContext !== 'undefined' || typeof webkitOfflineAudioContext !== 'undefined';
  }
  
  /**
   * Set up the audio nodes for export
   * @param {AudioNode} sourceNode - The audio node to export from (typically the master gain node)
   * @param {Array} [tracks] - Optional array of tracks for offline rendering
   * @return {boolean} Success status
   */
  setupRecording(sourceNode, tracks = []) {
    if (!this.isSupported) {
      this._handleError('Neither MediaRecorder nor OfflineAudioContext is supported in this browser');
      return false;
    }
    
    try {
      // Store the source node
      this.sourceNode = sourceNode;
      
      // Store connected tracks for offline rendering
      this.sourceNode._connectedTracks = tracks;
      
      // If MediaRecorder is supported, set up for real-time recording as fallback
      if (typeof MediaRecorder !== 'undefined') {
        // Create a destination node for recording
        this.destinationNode = this.audioContext.createMediaStreamDestination();
        
        // Connect the source to the destination
        this.sourceNode.connect(this.destinationNode);
      }
      
      return true;
    } catch (error) {
      this._handleError('Failed to set up export: ' + error.message);
      return false;
    }
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
   * @return {boolean} Success status
   */
  startRecording(options = {}) {
    // Set custom filename if provided
    if (options.filename) {
      this.exportFilename = options.filename;
    } else {
      this.exportFilename = ''; // Reset to default if not provided
    }
    
    // Update MP3 options if provided
    if (options.mp3Options) {
      if (options.mp3Options.bitRate) {
        this.mp3Options.bitRate = options.mp3Options.bitRate;
      }
      if (options.mp3Options.quality) {
        this.mp3Options.quality = options.mp3Options.quality;
      }
    }
    
    // Check if fast export is supported
    if (AudioExporter.isFastExportSupported()) {
      return this._startFastExport(options);
    } else if (typeof MediaRecorder !== 'undefined') {
      // Fall back to real-time recording if OfflineAudioContext is not supported
      return this._startRealTimeRecording(options);
    } else {
      this._handleError('Neither OfflineAudioContext nor MediaRecorder is supported in this browser');
      return false;
    }
  }
  
  /**
   * Start fast export using OfflineAudioContext
   * @private
   * @param {Object} options - Export options
   * @return {boolean} Success status
   */
  _startFastExport(options = {}) {
    if (this.isRecording || this.isOfflineRendering) {
      this._handleError('Export is already in progress');
      return false;
    }
    
    if (!this.sourceNode) {
      this._handleError('Export has not been set up. Call setupRecording() first.');
      return false;
    }
    
    // Set export options
    this.recordingDuration = Math.min(options.duration || 60, this.maxDuration);
    this.exportFormat = options.format || 'wav';
    this.onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    this.onComplete = typeof options.onComplete === 'function' ? options.onComplete : null;
    this.onError = typeof options.onError === 'function' ? options.onError : null;
    
    try {
      // Reset state
      this.exportProgress = 0;
      this.exportCancelled = false;
      this.isOfflineRendering = true;
      this.renderStartTime = Date.now();
      
      // Create offline audio context
      window.OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const numChannels = 2; // Stereo output
      const sampleRate = this.sampleRate;
      const totalSamples = Math.ceil(sampleRate * this.recordingDuration);
      
      this.offlineContext = new OfflineAudioContext(numChannels, totalSamples, sampleRate);
      
      // Clone the audio graph into the offline context
      this._setupOfflineGraph().then(() => {
        // Start rendering
        console.log(`Started offline rendering (format: ${this.exportFormat}, duration: ${this.recordingDuration}s)`);
        
        // Set up progress tracking
        this._setupProgressTracking();
        
        // Start the actual rendering process
        this.offlineContext.startRendering().then(renderedBuffer => {
          // Rendering complete
          this.isOfflineRendering = false;
          
          // Convert the rendered buffer to the requested format
          this._processRenderedBuffer(renderedBuffer);
        }).catch(error => {
          this.isOfflineRendering = false;
          this._handleError('Offline rendering failed: ' + error.message);
        });
      }).catch(error => {
        this.isOfflineRendering = false;
        this._handleError('Failed to set up offline audio graph: ' + error.message);
      });
      
      return true;
    } catch (error) {
      this.isOfflineRendering = false;
      this._handleError('Failed to start offline rendering: ' + error.message);
      return false;
    }
  }
  
  /**
   * Set up the offline audio graph by cloning the current audio graph
   * @private
   * @return {Promise} Promise that resolves when the graph is set up
   */
  async _setupOfflineGraph() {
    // This method will be implemented to clone the audio graph from the live context
    // to the offline context, preserving all connections and parameters
    return new Promise((resolve, reject) => {
      try {
        // We'll need to recreate the entire audio graph in the offline context
        // This will be done by examining the tracks in the AudioController
        
        // For now, we'll use a simple approach where the sourceNode is expected to be
        // the master gain node from AudioController
        if (!this.sourceNode || !this.sourceNode.context) {
          return reject(new Error('Invalid source node'));
        }
        
        // Create a gain node in the offline context to serve as our output
        const offlineGain = this.offlineContext.createGain();
        offlineGain.gain.value = this.sourceNode.gain.value;
        offlineGain.connect(this.offlineContext.destination);
        
        // We'll need to get all tracks from the AudioController
        // This will be passed in from the AudioController when it calls startExport
        const tracks = this.sourceNode._connectedTracks || [];
        
        if (tracks.length === 0) {
          // If no tracks are provided, we'll create a simple oscillator for testing
          console.warn('No tracks provided for offline rendering, using test tone');
          const oscillator = this.offlineContext.createOscillator();
          oscillator.frequency.value = 440; // A4 note
          oscillator.connect(offlineGain);
          oscillator.start();
          oscillator.stop(this.recordingDuration);
          return resolve();
        }
        
        // Clone each track into the offline context
        const trackPromises = tracks.map(track => this._cloneTrackToOfflineContext(track, offlineGain));
        
        // Wait for all tracks to be cloned
        Promise.all(trackPromises)
          .then(() => resolve())
          .catch(error => reject(error));
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Clone a track to the offline context
   * @private
   * @param {Track} track - The track to clone
   * @param {GainNode} outputNode - The node to connect the cloned track to
   * @return {Promise} Promise that resolves when the track is cloned
   */
  _cloneTrackToOfflineContext(track, outputNode) {
    return new Promise((resolve, reject) => {
      try {
        // Different track types need different handling
        if (track.type === 'binaural') {
          this._cloneBinauralTrack(track, outputNode).then(resolve).catch(reject);
        } else if (track.type === 'isochronic') {
          this._cloneIsochronicTrack(track, outputNode).then(resolve).catch(reject);
        } else if (track.type === 'noise') {
          this._cloneNoiseTrack(track, outputNode).then(resolve).catch(reject);
        } else {
          reject(new Error(`Unknown track type: ${track.type}`));
        }
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Clone a binaural track to the offline context
   * @private
   * @param {BinauralTrack} track - The binaural track to clone
   * @param {GainNode} outputNode - The node to connect the cloned track to
   * @return {Promise} Promise that resolves when the track is cloned
   */
  _cloneBinauralTrack(track, outputNode) {
    return new Promise((resolve) => {
      // Create oscillators for left and right channels
      const leftOsc = this.offlineContext.createOscillator();
      const rightOsc = this.offlineContext.createOscillator();
      
      // Set frequencies
      leftOsc.frequency.value = track.leftFrequency;
      rightOsc.frequency.value = track.rightFrequency;
      
      // Set oscillator types (sine wave is best for binaural beats)
      leftOsc.type = 'sine';
      rightOsc.type = 'sine';
      
      // Create stereo panners
      const leftPanner = this.offlineContext.createStereoPanner();
      const rightPanner = this.offlineContext.createStereoPanner();
      
      // Set panning
      leftPanner.pan.value = -1;  // Full left
      rightPanner.pan.value = 1;  // Full right
      
      // Create gain node for track volume
      const trackGain = this.offlineContext.createGain();
      trackGain.gain.value = track.getVolume();
      
      // Connect everything
      leftOsc.connect(leftPanner);
      rightOsc.connect(rightPanner);
      leftPanner.connect(trackGain);
      rightPanner.connect(trackGain);
      trackGain.connect(outputNode);
      
      // Apply fade-in and fade-out
      const now = 0;
      const duration = this.recordingDuration;
      const fadeInDuration = track.fadeInDuration || 2;
      const fadeOutDuration = track.fadeOutDuration || 1;
      
      // Start with zero gain and ramp up for fade-in
      trackGain.gain.setValueAtTime(0, now);
      trackGain.gain.linearRampToValueAtTime(track.getVolume(), now + fadeInDuration);
      
      // Ramp down to zero at the end for fade-out
      if (duration > fadeOutDuration) {
        trackGain.gain.setValueAtTime(track.getVolume(), duration - fadeOutDuration);
        trackGain.gain.linearRampToValueAtTime(0, duration);
      }
      
      // Start oscillators
      leftOsc.start(now);
      rightOsc.start(now);
      
      // Stop oscillators at the end
      leftOsc.stop(duration);
      rightOsc.stop(duration);
      
      resolve();
    });
  }
  
  /**
   * Clone an isochronic track to the offline context
   * @private
   * @param {IsochronicTrack} track - The isochronic track to clone
   * @param {GainNode} outputNode - The node to connect the cloned track to
   * @return {Promise} Promise that resolves when the track is cloned
   */
  _cloneIsochronicTrack(track, outputNode) {
    return new Promise((resolve) => {
      // Create carrier oscillator
      const carrierOsc = this.offlineContext.createOscillator();
      carrierOsc.frequency.value = track.carrierFrequency;
      carrierOsc.type = 'sine';
      
      // Create LFO for amplitude modulation
      const lfo = this.offlineContext.createOscillator();
      lfo.frequency.value = track.beatFrequency;
      lfo.type = 'sine';
      
      // Create gain nodes
      const trackGain = this.offlineContext.createGain();
      trackGain.gain.value = track.getVolume();
      
      const modulationGain = this.offlineContext.createGain();
      modulationGain.gain.value = 0; // Will be controlled by LFO
      
      // Create wave shaper for LFO to create sharper on/off effect
      const waveShaper = this.offlineContext.createWaveShaper();
      waveShaper.curve = this._createPulseWaveShaper();
      
      // Connect LFO through wave shaper to modulation gain
      lfo.connect(waveShaper);
      waveShaper.connect(modulationGain.gain);
      
      // Connect carrier through modulation gain to track gain
      carrierOsc.connect(modulationGain);
      modulationGain.connect(trackGain);
      trackGain.connect(outputNode);
      
      // Apply fade-in and fade-out
      const now = 0;
      const duration = this.recordingDuration;
      const fadeInDuration = track.fadeInDuration || 2;
      const fadeOutDuration = track.fadeOutDuration || 1;
      
      // Start with zero gain and ramp up for fade-in
      trackGain.gain.setValueAtTime(0, now);
      trackGain.gain.linearRampToValueAtTime(track.getVolume(), now + fadeInDuration);
      
      // Ramp down to zero at the end for fade-out
      if (duration > fadeOutDuration) {
        trackGain.gain.setValueAtTime(track.getVolume(), duration - fadeOutDuration);
        trackGain.gain.linearRampToValueAtTime(0, duration);
      }
      
      // Start oscillators
      carrierOsc.start(now);
      lfo.start(now);
      
      // Stop oscillators at the end
      carrierOsc.stop(duration);
      lfo.stop(duration);
      
      resolve();
    });
  }
  
  /**
   * Create a wave shaper curve for pulse wave generation
   * @private
   * @return {Float32Array} Wave shaper curve
   */
  _createPulseWaveShaper() {
    const curve = new Float32Array(256);
    for (let i = 0; i < 128; i++) {
      curve[i] = 0;
    }
    for (let i = 128; i < 256; i++) {
      curve[i] = 1;
    }
    return curve;
  }
  
  /**
   * Clone a noise track to the offline context
   * @private
   * @param {NoiseTrack} track - The noise track to clone
   * @param {GainNode} outputNode - The node to connect the cloned track to
   * @return {Promise} Promise that resolves when the track is cloned
   */
  _cloneNoiseTrack(track, outputNode) {
    return new Promise((resolve) => {
      // Create buffer source for noise
      const bufferSize = 2 * this.offlineContext.sampleRate;
      const noiseBuffer = this.offlineContext.createBuffer(2, bufferSize, this.offlineContext.sampleRate);
      
      // Generate noise based on type
      const generateNoise = (channelData) => {
        if (track.noiseType === 'white') {
          // White noise: random values between -1 and 1
          for (let i = 0; i < bufferSize; i++) {
            channelData[i] = Math.random() * 2 - 1;
          }
        } else if (track.noiseType === 'pink') {
          // Pink noise: filtered white noise
          let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            channelData[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            channelData[i] *= 0.11; // Scale to keep in range [-1, 1]
            b6 = white * 0.115926;
          }
        } else if (track.noiseType === 'brown') {
          // Brown noise: integrated white noise
          let lastOut = 0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + (0.02 * white)) / 1.02;
            channelData[i] = lastOut * 3.5; // Scale to keep in range [-1, 1]
          }
        }
      };
      
      // Fill both channels with noise
      generateNoise(noiseBuffer.getChannelData(0));
      generateNoise(noiseBuffer.getChannelData(1));
      
      // Create buffer source
      const noiseSource = this.offlineContext.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      
      // Create gain node for track volume
      const trackGain = this.offlineContext.createGain();
      trackGain.gain.value = track.getVolume();
      
      // Connect noise source to track gain
      noiseSource.connect(trackGain);
      trackGain.connect(outputNode);
      
      // Apply fade-in and fade-out
      const now = 0;
      const duration = this.recordingDuration;
      const fadeInDuration = track.fadeInDuration || 2;
      const fadeOutDuration = track.fadeOutDuration || 1;
      
      // Start with zero gain and ramp up for fade-in
      trackGain.gain.setValueAtTime(0, now);
      trackGain.gain.linearRampToValueAtTime(track.getVolume(), now + fadeInDuration);
      
      // Ramp down to zero at the end for fade-out
      if (duration > fadeOutDuration) {
        trackGain.gain.setValueAtTime(track.getVolume(), duration - fadeOutDuration);
        trackGain.gain.linearRampToValueAtTime(0, duration);
      }
      
      // Start noise source
      noiseSource.start(now);
      noiseSource.stop(duration);
      
      resolve();
    });
  }
  
  /**
   * Process the rendered audio buffer and convert to the requested format
   * @private
   * @param {AudioBuffer} renderedBuffer - The rendered audio buffer
   */
  _processRenderedBuffer(renderedBuffer) {
    try {
      // Update progress to 90% (format conversion still needed)
      this.exportProgress = 90;
      if (this.onProgress) {
        this.onProgress(90);
      }
      
      // Convert to the requested format
      if (this.exportFormat === 'wav') {
        const wavBlob = this._audioBufferToWav(renderedBuffer);
        
        // Update progress to 100%
        this.exportProgress = 100;
        if (this.onProgress) {
          this.onProgress(100);
        }
        
        // Call completion callback
        if (this.onComplete) {
          this.onComplete(wavBlob);
        }
      } else if (this.exportFormat === 'mp3') {
        this._audioBufferToMp3(renderedBuffer)
          .then(mp3Blob => {
            // Update progress to 100%
            this.exportProgress = 100;
            if (this.onProgress) {
              this.onProgress(100);
            }
            
            // Call completion callback
            if (this.onComplete) {
              this.onComplete(mp3Blob);
            }
          })
          .catch(error => {
            this._handleError('Failed to convert to MP3: ' + error.message);
          });
      } else {
        this._handleError(`Unsupported export format: ${this.exportFormat}`);
      }
    } catch (error) {
      this._handleError('Failed to process rendered buffer: ' + error.message);
    }
  }
  
  /**
   * Start real-time recording (legacy fallback method)
   * @private
   * @param {Object} options - Recording options
   * @return {boolean} Success status
   */
  _startRealTimeRecording(options = {}) {
    if (!this.isSupported) {
      this._handleError('MediaRecorder is not supported in this browser');
      return false;
    }
    
    if (this.isRecording) {
      this._handleError('Recording is already in progress');
      return false;
    }
    
    if (!this.destinationNode) {
      this._handleError('Recording has not been set up. Call setupRecording() first.');
      return false;
    }
    
    // Set recording options
    this.recordingDuration = Math.min(options.duration || 60, this.maxDuration);
    this.exportFormat = options.format || 'wav';
    this.onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    this.onComplete = typeof options.onComplete === 'function' ? options.onComplete : null;
    this.onError = typeof options.onError === 'function' ? options.onError : null;
    
    try {
      // Reset state
      this.recordedChunks = [];
      this.exportProgress = 0;
      this.exportCancelled = false;
      
      // Create MediaRecorder
      const stream = this.destinationNode.stream;
      const mimeType = this._getSupportedMimeType();
      
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000 // 128 kbps
      });
      
      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
          
          // Memory management: if we have too many chunks, combine them
          if (this.recordedChunks.length > this.maxChunkCount) {
            this._consolidateChunks();
          }
        }
      };
      
      this.mediaRecorder.onstop = () => {
        this._finalizeRecording();
      };
      
      this.mediaRecorder.onerror = (event) => {
        this._handleError('MediaRecorder error: ' + event.error);
      };
      
      // Start recording
      this.mediaRecorder.start(1000); // Capture in 1-second chunks
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      
      // Set up progress tracking
      this._setupProgressTracking();
      
      // Set up automatic stop after duration
      setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
        }
      }, this.recordingDuration * 1000);
      
      console.log(`Started real-time recording (format: ${this.exportFormat}, duration: ${this.recordingDuration}s)`);
      return true;
    } catch (error) {
      this._handleError('Failed to start recording: ' + error.message);
      return false;
    }
  }
  
  /**
   * Stop recording/rendering
   * @return {Promise<Blob>} Promise that resolves with the exported audio blob
   */
  stopRecording() {
    if (!this.isRecording && !this.isOfflineRendering) {
      return Promise.reject(new Error('No export in progress'));
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Update completion callback to resolve the promise
        const originalOnComplete = this.onComplete;
        this.onComplete = (blob) => {
          if (originalOnComplete) {
            originalOnComplete(blob);
          }
          resolve(blob);
        };
        
        // Update error callback to reject the promise
        const originalOnError = this.onError;
        this.onError = (error) => {
          if (originalOnError) {
            originalOnError(error);
          }
          reject(new Error(error));
        };
        
        // Handle based on export type
        if (this.isRecording) {
          // Stop the media recorder for real-time recording
          this.mediaRecorder.stop();
          this.isRecording = false;
        } else if (this.isOfflineRendering) {
          // For offline rendering, we can't actually stop it once started
          // We'll just update the state and let it complete
          console.log('Offline rendering in progress, waiting for completion...');
          // The rendering will complete on its own and call the completion callback
        }
        
        // Clear progress tracking
        if (this.throttleInterval) {
          clearInterval(this.throttleInterval);
          this.throttleInterval = null;
        }
        
        console.log('Stopped export');
      } catch (error) {
        const errorMessage = 'Failed to stop export: ' + error.message;
        this._handleError(errorMessage);
        reject(new Error(errorMessage));
      }
    });
  }
  
  /**
   * Cancel the current export
   * @return {boolean} Success status
   */
  cancelRecording() {
    if (!this.isRecording && !this.isOfflineRendering) {
      return false;
    }
    
    try {
      this.exportCancelled = true;
      
      // Handle based on export type
      if (this.isRecording) {
        // Stop the media recorder for real-time recording
        this.mediaRecorder.stop();
        this.isRecording = false;
        
        // Clear recorded chunks
        this.recordedChunks = [];
      } else if (this.isOfflineRendering) {
        // For offline rendering, we can't actually cancel it once started
        // We'll just update the state and ignore the result when it completes
        console.log('Offline rendering in progress, marking as cancelled...');
        this.isOfflineRendering = false;
      }
      
      // Clear progress tracking
      if (this.throttleInterval) {
        clearInterval(this.throttleInterval);
        this.throttleInterval = null;
      }
      
      console.log('Export cancelled');
      return true;
    } catch (error) {
      this._handleError('Failed to cancel export: ' + error.message);
      return false;
    }
  }
  
  /**
   * Set the export format
   * @param {string} format - Export format: 'wav' or 'mp3'
   * @return {string} The actual format set
   */
  setExportFormat(format) {
    if (format === 'wav' || format === 'mp3') {
      this.exportFormat = format;
    }
    return this.exportFormat;
  }
  
  /**
   * Get the current recording progress
   * @return {number} Progress percentage (0-100)
   */
  getProgress() {
    return this.exportProgress;
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    // Cancel any ongoing recording
    if (this.isRecording) {
      this.cancelRecording();
    }
    
    // Disconnect nodes
    if (this.sourceNode && this.destinationNode) {
      try {
        this.sourceNode.disconnect(this.destinationNode);
      } catch (e) {
        // Ignore disconnection errors
      }
    }
    
    // Clear recorded chunks
    this.recordedChunks = [];
    
    // Clear callbacks
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
  }
  
  /**
   * Get a supported MIME type for MediaRecorder
   * @private
   * @return {string} Supported MIME type
   */
  _getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
      ''  // Empty string is a valid fallback
    ];
    
    for (const type of types) {
      if (type === '' || MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return '';
  }
  
  /**
   * Set up progress tracking
   * @private
   */
  _setupProgressTracking() {
    if (this.throttleInterval) {
      clearInterval(this.throttleInterval);
    }
    
    this.throttleInterval = setInterval(() => {
      if (!this.isRecording && !this.isOfflineRendering) {
        clearInterval(this.throttleInterval);
        this.throttleInterval = null;
        return;
      }
      
      let progress = 0;
      
      if (this.isRecording) {
        // For real-time recording, progress is based on elapsed time
        const elapsed = (Date.now() - this.recordingStartTime) / 1000;
        progress = Math.min(100, Math.round((elapsed / this.recordingDuration) * 100));
      } else if (this.isOfflineRendering) {
        // For offline rendering, progress is estimated based on elapsed time
        // but we cap it at 90% since the actual rendering might be faster than real-time
        // The remaining 10% is for format conversion
        const elapsed = (Date.now() - this.renderStartTime) / 1000;
        const estimatedProgress = Math.round((elapsed / this.recordingDuration) * 90);
        progress = Math.min(90, estimatedProgress);
      }
      
      this.exportProgress = progress;
      
      if (this.onProgress) {
        this.onProgress(progress);
      }
    }, 100); // Update more frequently for smoother progress
  }
  
  /**
   * Consolidate recorded chunks to save memory
   * @private
   */
  _consolidateChunks() {
    if (this.recordedChunks.length <= 1) {
      return;
    }
    
    // Create a new blob from all chunks
    const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType });
    
    // Reset chunks array with just this one blob
    this.recordedChunks = [blob];
    
    console.log('Consolidated recorded chunks to save memory');
  }
  
  /**
   * Finalize the recording and create the output file
   * @private
   */
  _finalizeRecording() {
    if (this.exportCancelled) {
      console.log('Recording was cancelled, skipping finalization');
      return;
    }
    
    if (this.recordedChunks.length === 0) {
      this._handleError('No audio data captured');
      return;
    }
    
    try {
      // Set progress to 100%
      this.exportProgress = 100;
      if (this.onProgress) {
        this.onProgress(100);
      }
      
      // Create a blob from the recorded chunks
      const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
      const recordedBlob = new Blob(this.recordedChunks, { type: mimeType });
      
      // Convert to the requested format
      if (this.exportFormat === 'wav') {
        this._convertToWav(recordedBlob)
          .then(wavBlob => {
            if (this.onComplete) {
              this.onComplete(wavBlob);
            }
          })
          .catch(error => {
            this._handleError('Failed to convert to WAV: ' + error.message);
          });
      } else if (this.exportFormat === 'mp3') {
        this._convertToMp3(recordedBlob)
          .then(mp3Blob => {
            if (this.onComplete) {
              this.onComplete(mp3Blob);
            }
          })
          .catch(error => {
            this._handleError('Failed to convert to MP3: ' + error.message);
          });
      } else {
        // Unsupported format, just return the original blob
        if (this.onComplete) {
          this.onComplete(recordedBlob);
        }
      }
    } catch (error) {
      this._handleError('Failed to finalize recording: ' + error.message);
    }
  }
  
  /**
   * Convert recorded audio to WAV format
   * @private
   * @param {Blob} blob - The recorded audio blob
   * @return {Promise<Blob>} Promise that resolves with the WAV blob
   */
  _convertToWav(blob) {
    return new Promise((resolve, reject) => {
      // Create a file reader to read the blob
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const arrayBuffer = reader.result;
          
          // Convert to audio buffer
          this.audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
            // Convert audio buffer to WAV
            const wavBlob = this._audioBufferToWav(audioBuffer);
            resolve(wavBlob);
          }, (error) => {
            reject(new Error('Failed to decode audio data: ' + error));
          });
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read audio data'));
      };
      
      reader.readAsArrayBuffer(blob);
    });
  }
  
  /**
   * Convert AudioBuffer to WAV format
   * @private
   * @param {AudioBuffer} audioBuffer - The audio buffer to convert
   * @return {Blob} WAV blob
   */
  _audioBufferToWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    // Extract the audio data
    const channelData = [];
    for (let channel = 0; channel < numChannels; channel++) {
      channelData.push(audioBuffer.getChannelData(channel));
    }
    
    // Interleave the channels
    const interleaved = this._interleaveChannels(channelData);
    
    // Convert to 16-bit PCM
    const pcmData = this._floatTo16BitPCM(interleaved);
    
    // Create the WAV header
    const headerView = this._createWavHeader(pcmData.length, numChannels, sampleRate, bitDepth);
    
    // Combine header and data
    const wavFile = new Uint8Array(headerView.byteLength + pcmData.byteLength);
    wavFile.set(new Uint8Array(headerView), 0);
    wavFile.set(new Uint8Array(pcmData), headerView.byteLength);
    
    // Create and return the WAV blob
    return new Blob([wavFile], { type: 'audio/wav' });
  }
  
  /**
   * Interleave multiple audio channels
   * @private
   * @param {Array<Float32Array>} channelData - Array of channel data
   * @return {Float32Array} Interleaved audio data
   */
  _interleaveChannels(channelData) {
    const numChannels = channelData.length;
    const length = channelData[0].length;
    const result = new Float32Array(length * numChannels);
    
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        result[i * numChannels + channel] = channelData[channel][i];
      }
    }
    
    return result;
  }
  
  /**
   * Convert Float32Array to 16-bit PCM
   * @private
   * @param {Float32Array} float32Array - Float32 audio data
   * @return {ArrayBuffer} 16-bit PCM data
   */
  _floatTo16BitPCM(float32Array) {
    const length = float32Array.length;
    const buffer = new ArrayBuffer(length * 2);
    const view = new DataView(buffer);
    
    for (let i = 0; i < length; i++) {
      // Convert float to int16
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(i * 2, value, true); // true for little-endian
    }
    
    return buffer;
  }
  
  /**
   * Create a WAV header
   * @private
   * @param {number} dataLength - Length of the audio data in bytes
   * @param {number} numChannels - Number of audio channels
   * @param {number} sampleRate - Sample rate in Hz
   * @param {number} bitDepth - Bit depth (8, 16, 24, or 32)
   * @return {ArrayBuffer} WAV header
   */
  _createWavHeader(dataLength, numChannels, sampleRate, bitDepth) {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const totalLength = dataLength + 36;
    
    // RIFF identifier
    this._writeString(view, 0, 'RIFF');
    // File length
    view.setUint32(4, totalLength, true);
    // RIFF type
    this._writeString(view, 8, 'WAVE');
    // Format chunk identifier
    this._writeString(view, 12, 'fmt ');
    // Format chunk length
    view.setUint32(16, 16, true);
    // Sample format (PCM)
    view.setUint16(20, 1, true);
    // Channel count
    view.setUint16(22, numChannels, true);
    // Sample rate
    view.setUint32(24, sampleRate, true);
    // Byte rate (sample rate * block align)
    view.setUint32(28, byteRate, true);
    // Block align (channel count * bytes per sample)
    view.setUint16(32, blockAlign, true);
    // Bits per sample
    view.setUint16(34, bitDepth, true);
    // Data chunk identifier
    this._writeString(view, 36, 'data');
    // Data chunk length
    view.setUint32(40, dataLength, true);
    
    return buffer;
  }
  
  /**
   * Write a string to a DataView
   * @private
   * @param {DataView} view - The DataView to write to
   * @param {number} offset - The offset to write at
   * @param {string} string - The string to write
   */
  _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
  
  /**
   * Convert recorded audio to MP3 format
   * @private
   * @param {Blob} blob - The recorded audio blob
   * @return {Promise<Blob>} Promise that resolves with the MP3 blob
   */
  _convertToMp3(blob) {
    return new Promise((resolve, reject) => {
      // Check if we need to load the MP3 encoder
      if (typeof lamejs === 'undefined') {
        // We need to dynamically load the lamejs library
        this._loadLameJsLibrary()
          .then(() => {
            this._convertBlobToMp3(blob)
              .then(resolve)
              .catch(reject);
          })
          .catch(error => {
            reject(new Error('Failed to load MP3 encoder: ' + error.message));
          });
      } else {
        // Library already loaded, proceed with conversion
        this._convertBlobToMp3(blob)
          .then(resolve)
          .catch(reject);
      }
    });
  }
  
  /**
   * Load the lamejs library dynamically
   * @private
   * @return {Promise} Promise that resolves when the library is loaded
   */
  _loadLameJsLibrary() {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (typeof lamejs !== 'undefined') {
        resolve();
        return;
      }
      
      // Create script element
      const script = document.createElement('script');
      script.src = 'js/lib/lame.min.js'; // Use local library
      script.async = true;
      
      script.onload = () => {
        if (typeof lamejs !== 'undefined') {
          resolve();
        } else {
          reject(new Error('Failed to initialize lamejs'));
        }
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load lamejs library'));
      };
      
      // Add to document
      document.head.appendChild(script);
    });
  }
  
  /**
   * Convert blob to MP3 using lamejs
   * @private
   * @param {Blob} blob - The recorded audio blob
   * @return {Promise<Blob>} Promise that resolves with the MP3 blob
   */
  _convertBlobToMp3(blob) {
    return new Promise((resolve, reject) => {
      // Create a file reader to read the blob
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const arrayBuffer = reader.result;
          
          // Convert to audio buffer
          this.audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
            try {
              // Convert audio buffer to MP3 using lamejs
              const mp3Data = this._audioBufferToMp3(audioBuffer);
              const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
              resolve(mp3Blob);
            } catch (error) {
              reject(new Error('MP3 encoding failed: ' + error.message));
            }
          }, (error) => {
            reject(new Error('Failed to decode audio data: ' + error));
          });
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read audio data'));
      };
      
      reader.readAsArrayBuffer(blob);
    });
  }
  
  /**
   * Convert AudioBuffer to MP3 format using lamejs
   * @private
   * @param {AudioBuffer} audioBuffer - The audio buffer to convert
   * @return {Array<Uint8Array>} Array of MP3 data chunks
   */
  _audioBufferToMp3(audioBuffer) {
    // Get audio data
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const samples = audioBuffer.getChannelData(0); // Get first channel
    
    // MP3 encoding parameters
    const bitRate = this.mp3Options.bitRate; // Use configured bitrate
    
    // Quality settings
    let mp3Quality = 3; // Default medium quality (V3)
    switch (this.mp3Options.quality) {
      case 'low':
        mp3Quality = 5; // Lower quality, smaller file
        break;
      case 'medium':
        mp3Quality = 3; // Medium quality
        break;
      case 'high':
        mp3Quality = 0; // Highest quality, larger file
        break;
    }
    
    console.log(`Encoding MP3 at ${bitRate}kbps with quality level ${mp3Quality}`);
    
    // Create MP3 encoder
    const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitRate);
    
    // Process in chunks to avoid memory issues
    const chunkSize = 1152; // Must be divisible by 576 for lamejs
    const mp3Data = [];
    
    // Convert and encode
    for (let i = 0; i < samples.length; i += chunkSize) {
      // Get chunk of samples
      const sampleChunk = samples.subarray(i, i + chunkSize);
      
      // Convert float32 to int16
      const int16Chunk = new Int16Array(sampleChunk.length);
      for (let j = 0; j < sampleChunk.length; j++) {
        // Scale to int16 range and clip
        int16Chunk[j] = Math.max(-32768, Math.min(32767, sampleChunk[j] * 32768));
      }
      
      // Encode chunk
      let mp3Chunk;
      if (numChannels === 1) {
        mp3Chunk = mp3encoder.encodeBuffer(int16Chunk);
      } else {
        // If stereo, get the second channel
        const rightChunk = audioBuffer.getChannelData(1).subarray(i, i + chunkSize);
        const int16RightChunk = new Int16Array(rightChunk.length);
        
        for (let j = 0; j < rightChunk.length; j++) {
          int16RightChunk[j] = Math.max(-32768, Math.min(32767, rightChunk[j] * 32768));
        }
        
        mp3Chunk = mp3encoder.encodeBuffer(int16Chunk, int16RightChunk);
      }
      
      // Add chunk to data array if it contains data
      if (mp3Chunk.length > 0) {
        mp3Data.push(mp3Chunk);
      }
    }
    
    // Finalize encoding
    const finalChunk = mp3encoder.flush();
    if (finalChunk.length > 0) {
      mp3Data.push(finalChunk);
    }
    
    return mp3Data;
  }
  
  /**
   * Generate a filename for the exported audio
   * @private
   * @param {string} format - File format ('wav' or 'mp3')
   * @return {string} Generated filename
   */
  _generateFilename(format) {
    // Use custom filename if provided
    if (this.exportFilename) {
      return `${this.exportFilename}.${format}`;
    }
    
    // Otherwise generate a timestamp-based filename
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    return `binaural_beat_${timestamp}.${format}`;
  }
  
  /**
   * Calculate estimated file size based on duration and format/bitrate
   * @param {number} durationSeconds - Duration in seconds
   * @param {string} format - File format ('wav' or 'mp3')
   * @param {number} [bitRate] - Bitrate for MP3 format in kbps
   * @return {Object} Estimated file size in bytes and formatted string
   */
  calculateEstimatedFileSize(durationSeconds, format, bitRate = null) {
    let estimatedBytes = 0;
    const sampleRate = this.sampleRate;
    const numChannels = 2; // Stereo
    
    if (format === 'wav') {
      // WAV file size calculation: duration * sample rate * channels * bytes per sample + header
      const bytesPerSample = 2; // 16-bit
      estimatedBytes = Math.ceil(durationSeconds * sampleRate * numChannels * bytesPerSample) + 44;
    } else if (format === 'mp3') {
      // MP3 file size calculation: duration * bitrate / 8 * 1000
      const actualBitRate = bitRate || this.mp3Options.bitRate;
      estimatedBytes = Math.ceil(durationSeconds * actualBitRate * 1000 / 8);
    }
    
    // Format file size
    let formattedSize;
    if (estimatedBytes < 1024) {
      formattedSize = `${estimatedBytes} B`;
    } else if (estimatedBytes < 1024 * 1024) {
      formattedSize = `${(estimatedBytes / 1024).toFixed(1)} KB`;
    } else {
      formattedSize = `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    
    return {
      bytes: estimatedBytes,
      formatted: formattedSize
    };
  }
  
  /**
   * Handle errors
   * @private
   * @param {string} message - Error message
   */
  _handleError(message) {
    console.error('AudioExporter error:', message);
    
    if (this.onError) {
      this.onError(message);
    }
  }
}