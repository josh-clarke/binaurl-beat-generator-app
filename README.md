# Binaural Beat Generator PWA

A Progressive Web Application for generating binaural beats, isochronic beats, and noise for meditation, focus, and relaxation purposes.

## Features

- Binaural beat generation (different frequencies in left and right ears)
- Isochronic beat generation (pulsing single frequency)
- Noise generation (white, pink, brown)
- Multiple simultaneous tracks with individual controls
- Adjustable fade timing controls (2s fade-in / 1s fade-out by default)
- Fast audio export functionality with WAV and MP3 support
- Real-time parameter adjustment with direct numerical input
- Timer functionality with automatic stop
- Preset management (save/load configurations)
- Offline functionality
- Home screen installation
- Responsive design for all device sizes

## Project Structure

```
binaural-pwa/
├── index.html          # Main HTML file
├── manifest.json       # PWA manifest
├── service-worker.js   # Service worker for offline functionality
├── css/
│   ├── normalize.css   # CSS reset
│   └── styles.css      # Custom styles
├── js/
│   └── main.js         # Main JavaScript
└── images/
    └── icons/          # App icons (to be added)
```

## Getting Started

1. Clone this repository
2. Serve the application using a local web server (e.g., `python -m http.server 8080`)
3. Open the application in your browser (e.g., http://localhost:8080)
4. For the best experience, use a modern browser that supports PWAs and wear headphones
## Usage Instructions

1. **Adding Tracks**: Click the "Add Track" button to create a new audio track
   - Choose from Binaural Beat, Isochronic Beat, or Noise
   - Each track has its own controls for frequency and volume

2. **Adjusting Parameters**:
   - Use sliders to adjust frequencies and volume
   - Click directly on frequency values to enter precise numbers
   - For binaural beats, adjust the carrier frequency and beat frequency
   - For isochronic beats, adjust the carrier frequency and pulse rate
   - For noise tracks, select between white, pink, and brown noise
   - All parameters support direct numerical input for precise control

3. **Playback Controls**:
   - Click the "Play" button to start all tracks with a fade-in
   - Click "Stop" to stop all tracks with a fade-out
   - Use the master volume slider to control overall volume

4. **Fade Timing Settings**:
   - Access fade settings in the master controls panel
   - Adjust fade-in duration (default: 2 seconds)
   - Adjust fade-out duration (default: 1 second)
   - Changes apply to all tracks unless custom fade settings are specified per track
   - Fade settings are saved with presets

5. **Audio Export**:
   - Click the "Export" button to open the export panel
   - Choose between WAV (higher quality, larger files) and MP3 (smaller files) formats
   - Set the export duration (from a few seconds to several hours)
   - Optionally specify a custom filename
   - For MP3 exports, select bitrate and quality options
   - Progress indicator shows export status
   - Exported files are automatically downloaded when complete

6. **Timer**:
   - Set a timer to automatically stop playback after a specified duration
   - Choose from preset durations or set to infinite

7. **Presets**:
   - Save your favorite configurations using the "Save Preset" button
   - Load previously saved presets using the "Load Preset" button
   - Presets include all track parameters, fade settings, and volume levels

## PWA Installation

The application can be installed on supported devices:
- On desktop: Click the install button in the address bar
- On mobile: Use "Add to Home Screen" option in the browser menu
- Once installed, the app works offline

## Technical Details

- Uses the Web Audio API for audio generation
- Fast audio export using OfflineAudioContext for non-realtime rendering
- MP3 encoding via the lamejs JavaScript library
- Service worker for offline functionality
- IndexedDB for storing user presets
- Responsive design for all device sizes
- Customizable fade timing for smoother transitions

## Browser Compatibility

The application has been tested and works well in the following browsers:
- Google Chrome (desktop and mobile)
- Mozilla Firefox (desktop and mobile)
- Safari (desktop and iOS)
- Microsoft Edge

Export functionality compatibility notes:
- Fast export (OfflineAudioContext) works in all modern browsers
- MP3 export requires more processing power than WAV export
- Safari on iOS may have limitations with very long exports
- Some older browsers may fall back to real-time recording instead of fast export

## Performance Considerations

- The Web Audio API is resource-intensive, especially with multiple tracks
- On mobile devices, limit the number of simultaneous tracks for better performance
- Close other applications when using the app for extended periods
- Battery usage may be higher when running audio processing

### Export Performance

- Audio export can be resource-intensive, especially for longer durations
- MP3 encoding requires more CPU resources than WAV export
- Estimated file sizes are shown before export to help manage expectations:
  * WAV files are approximately 10MB per minute of stereo audio
  * MP3 files vary based on bitrate (1-2MB per minute at 192kbps)
- For very long exports (>30 minutes):
  * Consider using WAV format for faster processing
  * Keep the application tab in the foreground during export
  * Ensure your device has sufficient storage space
  * Avoid running other CPU-intensive applications during export

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

This means you are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, subject to the conditions in the LICENSE file.

## Changelog

### Version 1.1.0 (Current)
- Added adjustable fade timing controls (2s in / 1s out by default)
- Implemented fast audio export functionality with WAV and MP3 support
- Enhanced parameter controls with direct numerical input
- Improved preset system to include fade settings
- Added comprehensive export options with file format selection
- Optimized audio processing for better performance

### Version 1.0.0 (Initial Release)
- Binaural beat generation
- Isochronic beat generation
- Noise generation (white, pink, brown)
- Multiple simultaneous tracks
- Timer functionality
- Basic preset management
- Offline functionality
- PWA support

## Third-Party Libraries

This project uses the following third-party libraries:
- [lamejs](https://github.com/zhuker/lamejs) - MP3 encoder implemented in JavaScript (used for MP3 export functionality)