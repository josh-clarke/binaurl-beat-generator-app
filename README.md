# Binaural Beat Generator PWA

A Progressive Web Application for generating binaural beats, isochronic beats, and noise for meditation, focus, and relaxation purposes.

## Features

- Binaural beat generation (different frequencies in left and right ears)
- Isochronic beat generation (pulsing single frequency)
- Noise generation (white, pink, brown)
- Multiple simultaneous tracks with individual controls
- 5-second fade-in when starting audio
- 2-second fade-out when stopping audio
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

3. **Playback Controls**:
   - Click the "Play" button to start all tracks with a 5-second fade-in
   - Click "Stop" to stop all tracks with a 2-second fade-out
   - Use the master volume slider to control overall volume

4. **Timer**:
   - Set a timer to automatically stop playback after a specified duration
   - Choose from preset durations or set to infinite

5. **Presets**:
   - Save your favorite configurations using the "Save Preset" button
   - Load previously saved presets using the "Load Preset" button

## PWA Installation

The application can be installed on supported devices:
- On desktop: Click the install button in the address bar
- On mobile: Use "Add to Home Screen" option in the browser menu
- Once installed, the app works offline

## Technical Details

- Uses the Web Audio API for audio generation
- Service worker for offline functionality
- IndexedDB for storing user presets
- Responsive design for all device sizes

## Browser Compatibility

The application has been tested and works well in the following browsers:
- Google Chrome (desktop and mobile)
- Mozilla Firefox (desktop and mobile)
- Safari (desktop and iOS)
- Microsoft Edge

## Performance Considerations

- The Web Audio API is resource-intensive, especially with multiple tracks
- On mobile devices, limit the number of simultaneous tracks for better performance
- Close other applications when using the app for extended periods
- Battery usage may be higher when running audio processing

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

This means you are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, subject to the conditions in the LICENSE file.