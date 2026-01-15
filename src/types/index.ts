/**
 * Core types for beat detection and music analysis
 * Extracted from DayGen for standalone use
 */

/**
 * Drum pattern detected in audio - identifies kick, snare, and hi-hat hits.
 * Used for cut planning: snare hits make excellent cut points in pop/EDM.
 */
export interface DrumPattern {
  /** Timestamps of detected kick drum hits (low frequency transients) */
  kickTimes: number[];
  /** Timestamps of detected snare hits (mid frequency transients) */
  snareTimes: number[];
  /** Timestamps of detected hi-hat hits (high frequency transients) */
  hihatTimes: number[];
  /** Length of the repeating pattern in seconds (typically 2-4 bars) */
  patternLength: number;
}

/**
 * Detected music section with energy profile.
 * Different sections warrant different cut densities:
 * - Drops/choruses: rapid cuts (every 1-2 beats)
 * - Verses: moderate cuts (every 4 beats)
 * - Breakdowns: sparse cuts (every 8-16 beats)
 */
export interface MusicSection {
  /** Section classification based on energy and spectral characteristics */
  type: 'intro' | 'verse' | 'chorus' | 'drop' | 'breakdown' | 'outro' | 'unknown';
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Normalized energy level 0-1 (chorus/drop typically > 0.7) */
  energy: number;
}
