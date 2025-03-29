/**
 * audioEngine/index.js - Main export file for the audio engine
 *
 * This file exports all components of the audio engine for easy importing.
 */

import AudioController from './AudioController.js';
import Track from './Track.js';
import BinauralTrack from './BinauralTrack.js';
import IsochronicTrack from './IsochronicTrack.js';
import NoiseTrack from './NoiseTrack.js';
import AudioExporter from '../audioExporter.js';

// Export all components
export {
  AudioController,
  Track,
  BinauralTrack,
  IsochronicTrack,
  NoiseTrack,
  AudioExporter
};

// Default export for convenience
export default AudioController;