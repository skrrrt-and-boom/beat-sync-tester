/**
 * DrumAnalyzer - Detects drum hits (kick, snare, hi-hat) from audio
 *
 * Why drums matter for video editing:
 * - Kick drums: Foundation of the beat, good for establishing cuts
 * - Snare drums: "Backbeat" (beats 2 and 4), excellent impact points
 * - Hi-hats: Rhythmic texture, useful for fast-paced montages
 *
 * Detection method:
 * Uses frequency-band energy onset detection:
 * - Low band (20-200 Hz): Kick drum detection
 * - Mid band (200-2000 Hz): Snare drum detection
 * - High band (5000-15000 Hz): Hi-hat detection
 *
 * This runs in the Web Worker using pure DSP (no Web Audio API).
 */

import type { DrumPattern } from '../types';

/** Frequency bands for drum detection (Hz) */
const FREQUENCY_BANDS = {
  kick: { low: 20, high: 200 },
  snare: { low: 200, high: 2000 },
  hihat: { low: 5000, high: 15000 },
};

/** FFT parameters */
const FFT_SIZE = 2048;
const HOP_SIZE = 512; // 75% overlap

/** Onset detection thresholds (relative to local mean) */
const ONSET_THRESHOLDS = {
  kick: 1.8,  // Kicks are usually prominent
  snare: 2.0, // Snares cut through the mix
  hihat: 1.6, // Hi-hats are more continuous
};

/** Minimum time between detected hits (seconds) */
const MIN_HIT_INTERVAL = {
  kick: 0.15,  // ~400 BPM max
  snare: 0.12, // ~500 BPM max
  hihat: 0.05, // ~1200 BPM max (hi-hats can be very fast)
};

/**
 * Simple Hamming window for FFT preprocessing.
 * Reduces spectral leakage at frame boundaries.
 */
function createHammingWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
  }
  return window;
}

/**
 * Apply windowing to a frame of samples.
 */
function applyWindow(samples: Float32Array, window: Float32Array): Float32Array {
  const result = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    result[i] = samples[i] * window[i];
  }
  return result;
}

/**
 * Radix-2 Cooley-Tukey FFT implementation.
 * O(N log N) complexity - much faster than naive DFT for large inputs.
 *
 * Requires input length to be a power of 2 (FFT_SIZE = 2048 satisfies this).
 * Returns magnitude spectrum (only positive frequencies).
 */
function computeMagnitudeSpectrum(samples: Float32Array): Float32Array {
  const N = samples.length;

  // Ensure N is power of 2
  if ((N & (N - 1)) !== 0) {
    throw new Error(`FFT requires power of 2 length, got ${N}`);
  }

  // Create complex arrays for in-place FFT
  const real = new Float32Array(samples);
  const imag = new Float32Array(N);

  // Bit-reversal permutation
  const bits = Math.log2(N);
  for (let i = 0; i < N; i++) {
    const reversed = reverseBits(i, bits);
    if (reversed > i) {
      // Swap real
      const tempReal = real[i];
      real[i] = real[reversed];
      real[reversed] = tempReal;
      // Swap imag (all zeros initially, but needed for consistency)
      const tempImag = imag[i];
      imag[i] = imag[reversed];
      imag[reversed] = tempImag;
    }
  }

  // Cooley-Tukey iterative FFT
  for (let size = 2; size <= N; size *= 2) {
    const halfSize = size / 2;
    const angleStep = -2 * Math.PI / size;

    for (let i = 0; i < N; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const angle = angleStep * j;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const evenIdx = i + j;
        const oddIdx = i + j + halfSize;

        // Butterfly operation
        const tReal = real[oddIdx] * cos - imag[oddIdx] * sin;
        const tImag = real[oddIdx] * sin + imag[oddIdx] * cos;

        real[oddIdx] = real[evenIdx] - tReal;
        imag[oddIdx] = imag[evenIdx] - tImag;
        real[evenIdx] = real[evenIdx] + tReal;
        imag[evenIdx] = imag[evenIdx] + tImag;
      }
    }
  }

  // Compute magnitude spectrum (only positive frequencies)
  const spectrum = new Float32Array(N / 2);
  for (let k = 0; k < N / 2; k++) {
    spectrum[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
  }

  return spectrum;
}

/**
 * Reverse bits of an integer (for FFT bit-reversal permutation)
 */
function reverseBits(x: number, bits: number): number {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}

/**
 * Calculate energy in a specific frequency band.
 */
function getBandEnergy(
  spectrum: Float32Array,
  sampleRate: number,
  lowHz: number,
  highHz: number
): number {
  const binResolution = sampleRate / (spectrum.length * 2);
  const lowBin = Math.floor(lowHz / binResolution);
  const highBin = Math.min(Math.ceil(highHz / binResolution), spectrum.length - 1);

  let energy = 0;
  for (let i = lowBin; i <= highBin; i++) {
    energy += spectrum[i] * spectrum[i];
  }

  return Math.sqrt(energy / (highBin - lowBin + 1));
}

/**
 * Detect onsets in an energy envelope using adaptive thresholding.
 */
function detectOnsets(
  energy: Float32Array,
  frameTimes: Float32Array,
  threshold: number,
  minInterval: number
): number[] {
  const onsets: number[] = [];

  // Use a sliding window for local mean
  const windowSize = 10;

  for (let i = windowSize; i < energy.length - 1; i++) {
    // Calculate local mean
    let localMean = 0;
    for (let j = i - windowSize; j < i; j++) {
      localMean += energy[j];
    }
    localMean /= windowSize;

    // Check for onset (current > threshold * localMean AND rising)
    if (energy[i] > threshold * localMean && energy[i] > energy[i - 1]) {
      const time = frameTimes[i];

      // Enforce minimum interval
      if (onsets.length === 0 || time - onsets[onsets.length - 1] >= minInterval) {
        onsets.push(time);
      }
    }
  }

  return onsets;
}

/**
 * Analyze drum patterns in audio data.
 *
 * @param audioData - Mono audio samples (Float32Array)
 * @param sampleRate - Audio sample rate (typically 44100)
 * @param beatTimes - Beat timestamps for pattern length estimation
 * @returns DrumPattern with detected kick, snare, and hi-hat times
 */
export function analyzeDrums(
  audioData: Float32Array,
  sampleRate: number,
  beatTimes: number[]
): DrumPattern {
  const numFrames = Math.floor((audioData.length - FFT_SIZE) / HOP_SIZE);

  if (numFrames <= 0) {
    return {
      kickTimes: [],
      snareTimes: [],
      hihatTimes: [],
      patternLength: 0,
    };
  }

  // Pre-allocate energy arrays for each band
  const kickEnergy = new Float32Array(numFrames);
  const snareEnergy = new Float32Array(numFrames);
  const hihatEnergy = new Float32Array(numFrames);
  const frameTimes = new Float32Array(numFrames);

  // Create window function
  const window = createHammingWindow(FFT_SIZE);

  // Process audio in frames
  for (let frame = 0; frame < numFrames; frame++) {
    const startSample = frame * HOP_SIZE;
    const endSample = startSample + FFT_SIZE;

    // Extract and window the frame
    const frameData = audioData.slice(startSample, endSample);
    const windowed = applyWindow(frameData, window);

    // Compute spectrum
    const spectrum = computeMagnitudeSpectrum(windowed);

    // Calculate energy in each band
    kickEnergy[frame] = getBandEnergy(spectrum, sampleRate, FREQUENCY_BANDS.kick.low, FREQUENCY_BANDS.kick.high);
    snareEnergy[frame] = getBandEnergy(spectrum, sampleRate, FREQUENCY_BANDS.snare.low, FREQUENCY_BANDS.snare.high);
    hihatEnergy[frame] = getBandEnergy(spectrum, sampleRate, FREQUENCY_BANDS.hihat.low, FREQUENCY_BANDS.hihat.high);

    // Calculate frame time (center of frame)
    frameTimes[frame] = (startSample + FFT_SIZE / 2) / sampleRate;
  }

  // Detect onsets in each band
  const kickTimes = detectOnsets(kickEnergy, frameTimes, ONSET_THRESHOLDS.kick, MIN_HIT_INTERVAL.kick);
  const snareTimes = detectOnsets(snareEnergy, frameTimes, ONSET_THRESHOLDS.snare, MIN_HIT_INTERVAL.snare);
  const hihatTimes = detectOnsets(hihatEnergy, frameTimes, ONSET_THRESHOLDS.hihat, MIN_HIT_INTERVAL.hihat);

  // Estimate pattern length based on beat interval
  let patternLength = 0;
  if (beatTimes.length >= 2) {
    const beatInterval = (beatTimes[beatTimes.length - 1] - beatTimes[0]) / (beatTimes.length - 1);
    // Typical pattern is 4 bars = 16 beats
    patternLength = beatInterval * 16;
  }

  return {
    kickTimes,
    snareTimes,
    hihatTimes,
    patternLength,
  };
}
