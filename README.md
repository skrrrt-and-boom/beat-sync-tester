# 🎵 Beat Sync Tester

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)

> Browser-based beat detection and music analysis tool. Upload audio, visualize beats on an interactive waveform, and export sync data.

<!-- Add a GIF/screenshot here for maximum impact -->
<!-- ![Demo](demo.gif) -->

I vibecoded this for my own purposes and it turned out way more useful than expected. Sharing in hope that somebody else finds it helpful too.

## ✨ Features

- 🎵 **Beat Detection** — Accurate BPM and beat timing via [essentia.js](https://essentia.upf.edu/essentiajs/) (WASM)
- 🌊 **Interactive Waveform** — Zoomable, scrollable visualization with [wavesurfer.js](https://wavesurfer.xyz/)
- 🥁 **Drum Analysis** — Detects kicks, snares, and hi-hats using FFT spectral analysis
- 🎼 **Section Detection** — Identifies intro, verse, chorus, drop, breakdown, outro
- ✏️ **Manual Corrections** — Shift+click to add markers, right-click to remove (persisted in localStorage)
- 📊 **JSON Export** — Copy analysis data for integration with video editors or other tools

## 🚀 Quick Start

```bash
git clone git@github.com:skrrrt-and-boom/beat-sync-tester.git
cd beat-sync-tester
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📖 Usage

1. **Load audio** — Drag & drop a file or paste a URL
2. **Analyze** — Click "Analyze Beats" to run detection
3. **Interact** — Click waveform to seek, Shift+click to add correction markers
4. **Export** — Copy the JSON from the analysis panel

## 🎨 Marker Colors

| Color | Meaning |
|-------|---------|
| ⚪ Gray | Regular beat |
| ⚪ White | Bar (every 4 beats) |
| 🔵 Cyan | Downbeat |
| 🟣 Purple | Phrase boundary |
| 🔴 Red | Kick drum |
| 🟡 Yellow | Snare |
| 🟢 Green | Hi-hat |
| 🟠 Orange | Manual correction |

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Build**: Vite
- **Audio**: [essentia.js](https://essentia.upf.edu/essentiajs/) (WASM), [wavesurfer.js](https://wavesurfer.xyz/)
- **Analysis**: Web Workers for non-blocking processing

## 📁 Project Structure

```
src/
├── components/          # UI components
│   ├── BeatVisualizerWaveform.tsx
│   ├── AnalysisPanel.tsx
│   ├── SectionTimeline.tsx
│   └── BeatMarkerLegend.tsx
├── services/            # Audio analysis
│   ├── BeatDetectionService.ts
│   ├── beat-detection.worker.ts
│   ├── DrumAnalyzer.ts
│   ├── EnergyAnalyzer.ts
│   └── SectionAnalyzer.ts
├── hooks/
│   └── useBeatCorrections.ts
└── types/
    └── index.ts
```

## 🤝 Contributing

PRs welcome! Feel free to open issues for bugs or feature requests.

## 📄 License

[MIT](LICENSE) — do whatever you want with it.
