/**
 * EnergyAnalyzer - Calculates RMS energy envelope from audio data
 *
 * The energy envelope is used to:
 * 1. Detect music sections (high energy = chorus/drop, low = verse/breakdown)
 * 2. Identify build-ups and drops (energy gradient)
 * 3. Weight beat importance (strong beats have higher local energy)
 *
 * Output is sampled at 10 Hz (100ms windows) for smooth section boundaries.
 */

/** Target output sample rate in Hz */
const OUTPUT_SAMPLE_RATE = 10; // 10 samples per second = 100ms windows

/**
 * Calculate RMS (Root Mean Square) energy for a window of samples.
 * RMS represents the "power" of the audio signal.
 */
function calculateRMS(samples: Float32Array, start: number, end: number): number {
  let sumSquares = 0;
  const count = end - start;

  if (count <= 0) return 0;

  for (let i = start; i < end; i++) {
    const sample = samples[i] ?? 0;
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / count);
}

/**
 * Smooth the energy curve using a simple moving average.
 * This removes noise spikes and creates cleaner section boundaries.
 */
function smoothEnergyCurve(curve: Float32Array, windowSize: number): Float32Array {
  const smoothed = new Float32Array(curve.length);
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < curve.length; i++) {
    let sum = 0;
    let count = 0;

    for (let j = Math.max(0, i - halfWindow); j < Math.min(curve.length, i + halfWindow + 1); j++) {
      sum += curve[j];
      count++;
    }

    smoothed[i] = sum / count;
  }

  return smoothed;
}

/**
 * Analyze audio and produce a normalized energy envelope.
 *
 * @param audioData - Mono audio samples (Float32Array, -1 to 1)
 * @param sampleRate - Sample rate of the audio (typically 44100 or 48000)
 * @returns Float32Array of normalized energy values (0-1), sampled at 10 Hz
 */
export function analyzeEnergy(audioData: Float32Array, sampleRate: number): Float32Array {
  const audioDuration = audioData.length / sampleRate;
  const outputLength = Math.ceil(audioDuration * OUTPUT_SAMPLE_RATE);
  const rawEnergy = new Float32Array(outputLength);

  // Adjust window size based on actual sample rate
  const windowSamples = Math.floor(sampleRate / OUTPUT_SAMPLE_RATE);

  // Calculate RMS energy for each window
  for (let i = 0; i < outputLength; i++) {
    const startSample = i * windowSamples;
    const endSample = Math.min(startSample + windowSamples, audioData.length);
    rawEnergy[i] = calculateRMS(audioData, startSample, endSample);
  }

  // Apply smoothing (5-sample window = 500ms smoothing)
  const smoothed = smoothEnergyCurve(rawEnergy, 5);

  // Find max for normalization (avoid divide by zero)
  let maxEnergy = 0;
  for (let i = 0; i < smoothed.length; i++) {
    if (smoothed[i] > maxEnergy) {
      maxEnergy = smoothed[i];
    }
  }

  // Normalize to 0-1 range
  const normalized = new Float32Array(smoothed.length);
  if (maxEnergy > 0) {
    for (let i = 0; i < smoothed.length; i++) {
      normalized[i] = smoothed[i] / maxEnergy;
    }
  }

  return normalized;
}

/**
 * Get the average energy within a time range.
 * Useful for calculating section energy levels.
 *
 * @param energyCurve - The energy curve from analyzeEnergy()
 * @param startTime - Start time in seconds
 * @param endTime - End time in seconds
 * @returns Average normalized energy (0-1)
 */
export function getAverageEnergy(
  energyCurve: Float32Array,
  startTime: number,
  endTime: number
): number {
  const startIndex = Math.floor(startTime * OUTPUT_SAMPLE_RATE);
  const endIndex = Math.min(Math.ceil(endTime * OUTPUT_SAMPLE_RATE), energyCurve.length);

  if (startIndex >= endIndex) return 0;

  let sum = 0;
  for (let i = startIndex; i < endIndex; i++) {
    sum += energyCurve[i];
  }

  return sum / (endIndex - startIndex);
}

/**
 * Detect significant energy changes (rises/drops).
 * Used to identify section transitions like build-ups and drops.
 *
 * @param energyCurve - The energy curve from analyzeEnergy()
 * @param threshold - Minimum change to consider significant (default 0.2)
 * @returns Array of { time, delta } where delta > 0 is rise, < 0 is drop
 */
export function detectEnergyChanges(
  energyCurve: Float32Array,
  threshold: number = 0.2
): Array<{ time: number; delta: number }> {
  const changes: Array<{ time: number; delta: number }> = [];

  // Use 1-second lookahead/lookback for change detection
  const lookWindow = OUTPUT_SAMPLE_RATE; // 10 samples = 1 second

  for (let i = lookWindow; i < energyCurve.length - lookWindow; i++) {
    // Calculate average energy before and after this point
    let beforeSum = 0;
    let afterSum = 0;

    for (let j = 0; j < lookWindow; j++) {
      beforeSum += energyCurve[i - lookWindow + j];
      afterSum += energyCurve[i + j];
    }

    const beforeAvg = beforeSum / lookWindow;
    const afterAvg = afterSum / lookWindow;
    const delta = afterAvg - beforeAvg;

    // Check if this is a significant change
    if (Math.abs(delta) >= threshold) {
      const time = i / OUTPUT_SAMPLE_RATE;

      // Avoid duplicates within 1 second
      const lastChange = changes[changes.length - 1];
      if (!lastChange || time - lastChange.time >= 1.0) {
        changes.push({ time, delta });
      }
    }
  }

  return changes;
}

/**
 * Get the energy sample rate (samples per second).
 * Useful for converting between sample indices and time.
 */
export function getEnergySampleRate(): number {
  return OUTPUT_SAMPLE_RATE;
}
