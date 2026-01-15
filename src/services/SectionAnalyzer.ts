/**
 * SectionAnalyzer - Detects music sections from audio analysis
 *
 * Section Types and Cut Density Mapping:
 * - intro: Sparse cuts (8-16 beats), let the scene breathe
 * - verse: Moderate cuts (4-8 beats), storytelling pace
 * - chorus: Frequent cuts (2-4 beats), high energy visuals
 * - drop: Rapid cuts (1-2 beats), maximum impact
 * - breakdown: Very sparse (8-16 beats), emotional moment
 * - outro: Sparse cuts (8-16 beats), wind down
 *
 * Detection is based on:
 * 1. Energy level thresholds
 * 2. Energy change gradients (build-ups, drops)
 * 3. Position in track (intro at start, outro at end)
 */

import type { MusicSection } from '../types';
import { getAverageEnergy, detectEnergyChanges } from './EnergyAnalyzer';

/** Minimum section duration in seconds */
const MIN_SECTION_DURATION = 4.0;

/** Energy thresholds for section classification */
const ENERGY_THRESHOLDS = {
  /** Energy >= this is high (chorus/drop territory) */
  HIGH: 0.7,
  /** Energy >= this is medium (verse territory) */
  MEDIUM: 0.4,
  /** Energy < MEDIUM is low (breakdown/intro territory) */
};

/** How far from track start/end to consider intro/outro (seconds) */
const EDGE_SECTION_THRESHOLD = 15;

/**
 * Section type based on energy level and position.
 */
type SectionType = MusicSection['type'];

/**
 * Classify section type based on energy and track position.
 */
function classifySection(
  energy: number,
  startTime: number,
  endTime: number,
  totalDuration: number,
  energyChange: number
): SectionType {
  // Check for intro (early in track)
  if (startTime < EDGE_SECTION_THRESHOLD && energy < ENERGY_THRESHOLDS.HIGH) {
    return 'intro';
  }

  // Check for outro (late in track, lower energy)
  if (endTime > totalDuration - EDGE_SECTION_THRESHOLD && energy < ENERGY_THRESHOLDS.HIGH) {
    return 'outro';
  }

  // High energy sections
  if (energy >= ENERGY_THRESHOLDS.HIGH) {
    // If there was a significant positive energy change leading into this,
    // it's likely a "drop" (EDM) or climactic moment
    if (energyChange > 0.25) {
      return 'drop';
    }
    return 'chorus';
  }

  // Medium energy sections
  if (energy >= ENERGY_THRESHOLDS.MEDIUM) {
    return 'verse';
  }

  // Low energy sections
  // Check if preceded by high energy (likely a breakdown)
  if (energyChange < -0.2) {
    return 'breakdown';
  }

  return 'unknown';
}

/**
 * Merge adjacent sections of the same type.
 */
function mergeSections(sections: MusicSection[]): MusicSection[] {
  if (sections.length <= 1) return sections;

  const merged: MusicSection[] = [];
  let current = { ...sections[0] };

  for (let i = 1; i < sections.length; i++) {
    const next = sections[i];

    if (next.type === current.type) {
      // Merge: extend current section
      current.endTime = next.endTime;
      // Recalculate average energy
      current.energy = (current.energy + next.energy) / 2;
    } else {
      // Different type: push current, start new
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Analyze audio and detect music sections.
 *
 * @param energyCurve - Energy curve from EnergyAnalyzer
 * @param barTimes - Bar (measure) timestamps for section boundary snapping
 * @param audioDuration - Total audio duration in seconds
 * @returns Array of detected music sections
 */
export function analyzeSections(
  energyCurve: Float32Array,
  barTimes: number[],
  audioDuration: number
): MusicSection[] {
  if (energyCurve.length === 0) {
    // No energy data, return single unknown section
    return [{
      type: 'unknown',
      startTime: 0,
      endTime: audioDuration,
      energy: 0.5,
    }];
  }

  // Get energy changes (significant rises/drops)
  const energyChanges = detectEnergyChanges(energyCurve, 0.15);

  // Create section boundaries at energy change points and bar positions
  const boundaries: number[] = [0];

  // Add energy change points as potential boundaries
  for (const change of energyChanges) {
    // Snap to nearest bar if available
    const snappedTime = snapToNearestBar(change.time, barTimes);
    if (snappedTime - boundaries[boundaries.length - 1] >= MIN_SECTION_DURATION) {
      boundaries.push(snappedTime);
    }
  }

  // Ensure we end at the track duration
  if (audioDuration - boundaries[boundaries.length - 1] >= MIN_SECTION_DURATION) {
    boundaries.push(audioDuration);
  } else if (boundaries.length > 1) {
    boundaries[boundaries.length - 1] = audioDuration;
  } else {
    boundaries.push(audioDuration);
  }

  // If we only have start/end, add boundaries at regular intervals based on bars
  if (boundaries.length === 2 && barTimes.length > 0) {
    // Add boundaries every 8 bars (typical phrase length)
    const barsPerSection = 8;
    for (let i = barsPerSection; i < barTimes.length; i += barsPerSection) {
      const barTime = barTimes[i];
      if (barTime > boundaries[0] + MIN_SECTION_DURATION &&
          barTime < boundaries[1] - MIN_SECTION_DURATION) {
        boundaries.push(barTime);
      }
    }
    boundaries.sort((a, b) => a - b);
  }

  // Create sections from boundaries
  const sections: MusicSection[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const startTime = boundaries[i];
    const endTime = boundaries[i + 1];

    // Calculate average energy for this section
    const energy = getAverageEnergy(energyCurve, startTime, endTime);

    // Determine energy change leading into this section
    const prevEnergy = i > 0
      ? getAverageEnergy(energyCurve, boundaries[i - 1], startTime)
      : energy;
    const energyChange = energy - prevEnergy;

    // Classify the section
    const type = classifySection(energy, startTime, endTime, audioDuration, energyChange);

    sections.push({
      type,
      startTime,
      endTime,
      energy,
    });
  }

  // Merge adjacent sections of the same type
  return mergeSections(sections);
}

/**
 * Snap a time to the nearest bar boundary.
 */
function snapToNearestBar(time: number, barTimes: number[]): number {
  if (barTimes.length === 0) return time;

  let nearestBar = barTimes[0];
  let minDiff = Math.abs(time - nearestBar);

  for (const barTime of barTimes) {
    const diff = Math.abs(time - barTime);
    if (diff < minDiff) {
      minDiff = diff;
      nearestBar = barTime;
    }
    // Early exit if we've passed the time (bars are sorted)
    if (barTime > time + 2) break;
  }

  return nearestBar;
}

/**
 * Detect phrase boundaries (typically 4-8 bar units).
 * Phrases are natural "sentence" structures in music.
 *
 * @param barTimes - Bar timestamps
 * @param sections - Detected sections (phrases often align with section changes)
 * @returns Array of phrase boundary timestamps
 */
export function detectPhraseBoundaries(
  barTimes: number[],
  sections: MusicSection[]
): number[] {
  const phrases: number[] = [];

  // Add section boundaries as phrase boundaries
  for (const section of sections) {
    if (!phrases.includes(section.startTime)) {
      phrases.push(section.startTime);
    }
  }

  // Add every 4th bar as phrase boundaries (common phrase length)
  const BARS_PER_PHRASE = 4;
  for (let i = 0; i < barTimes.length; i += BARS_PER_PHRASE) {
    const barTime = barTimes[i];
    // Only add if not too close to existing boundary
    const minDistance = 2.0; // 2 seconds minimum between phrase boundaries
    const tooClose = phrases.some(p => Math.abs(p - barTime) < minDistance);
    if (!tooClose) {
      phrases.push(barTime);
    }
  }

  // Sort and return
  return phrases.sort((a, b) => a - b);
}
