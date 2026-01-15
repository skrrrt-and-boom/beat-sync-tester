# beat-sync-tester
I vibecoded this for my own purposes and it turned out to be more useful for me than expected. In hope that somebody will find this useful:

Upload your music and it will give you whole music sync analysis.

## Quick Start

  ```bash
  git clone git@github.com:skrrrt-and-boom/beat-sync-tester.git
  cd beat-sync-tester
  npm install
  npm run dev

  Open http://localhost:5173 in your browser.

  Usage

  1. Load audio — Drag & drop a file or paste a URL
  2. Analyze — Click "Analyze Beats" to detect beats, sections, and drums
  3. Interact — Click waveform to seek, Shift+click to add correction markers, right-click to remove
  4. Export — Copy analysis JSON from the panel below

  Features

  - 🎵 Beat detection via https://essentia.upf.edu/essentiajs/ (WASM)
  - 🌊 Interactive waveform with https://wavesurfer.xyz/
  - 🥁 Drum pattern analysis (kick, snare, hi-hat)
  - 🎼 Section detection (intro, verse, chorus, drop, breakdown, outro)
  - ✏️ Manual beat corrections (persisted in localStorage)
  - 📊 JSON export for integration

  Tech Stack

  React 19 • Vite • TypeScript • Tailwind CSS • essentia.js • wavesurfer.js
  ```
