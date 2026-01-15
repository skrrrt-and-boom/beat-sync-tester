/**
 * Browser-based beat detection service using essentia.js
 * Uses a Web Worker to prevent UI freezing during heavy analysis
 *
 * Beat Sync V2 (Phase 2): Enhanced with energy, section, and drum analysis
 */

import type { DrumPattern, MusicSection } from '../types';

// Re-export types for convenience
export type { DrumPattern, MusicSection };

/**
 * Basic beat analysis result (Phase 1 compatibility)
 */
export interface BeatAnalysisResult {
  beatTimes: number[];
  downbeatIndices: number[];
  downbeatTimes: number[];
  barTimes: number[];
  tempo: number;
  beatCount: number;
  barCount: number;
}

/**
 * Enhanced beat analysis result (Phase 2)
 * Extends basic result with energy, sections, and drum analysis
 */
export interface EnhancedBeatAnalysisResult extends BeatAnalysisResult {
  // Beat strength (Phase 2)
  beatStrengths: number[];

  // Drum pattern (Phase 2)
  drumPattern: DrumPattern;

  // Music sections (Phase 2)
  sections: MusicSection[];

  // Energy envelope (Phase 2)
  energyCurve: Float32Array;

  // Phrase boundaries (Phase 2)
  phraseBoundaries: number[];

  // Metadata
  analysisVersion: 2;
  analysisTimeMs: number;
}

interface WorkerResponse {
  type: 'result' | 'error' | 'progress';
  data?: EnhancedBeatAnalysisResult;
  error?: string;
  progress?: number;
}

/**
 * Progress callback for analysis updates
 */
export type AnalysisProgressCallback = (progress: number) => void;

class BeatDetectionService {
  private worker: Worker | null = null;
  private audioContext: AudioContext | null = null;

  /**
   * Get or create the audio context for decoding
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 44100 });
    }
    return this.audioContext;
  }

  /**
   * Get or create the Web Worker for analysis
   */
  private getWorker(): Worker {
    if (!this.worker) {
      // Vite-compatible worker import
      this.worker = new Worker(
        new URL('./beat-detection.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return this.worker;
  }

  /**
   * Convert stereo audio buffer to mono Float32Array
   */
  private toMono(audioBuffer: AudioBuffer): Float32Array {
    const left = audioBuffer.getChannelData(0);

    if (audioBuffer.numberOfChannels === 1) {
      return left;
    }

    const right = audioBuffer.getChannelData(1);
    const mono = new Float32Array(left.length);

    for (let i = 0; i < left.length; i++) {
      mono[i] = (left[i] + right[i]) / 2;
    }

    return mono;
  }

  /**
   * Analyze beats in an audio file (basic result for backward compatibility)
   * Uses Web Worker to prevent UI freezing
   */
  async analyzeBeats(audioUrl: string): Promise<BeatAnalysisResult> {
    const result = await this.analyzeBeatsEnhanced(audioUrl);
    // Return only the basic fields for backward compatibility
    return {
      beatTimes: result.beatTimes,
      downbeatIndices: result.downbeatIndices,
      downbeatTimes: result.downbeatTimes,
      barTimes: result.barTimes,
      tempo: result.tempo,
      beatCount: result.beatCount,
      barCount: result.barCount,
    };
  }

  /**
   * Analyze beats with full Phase 2 enhancements
   * Returns energy, sections, and drum analysis for intelligent cut planning
   *
   * @param audioUrl - URL of the audio file to analyze
   * @param onProgress - Optional progress callback (0-1)
   */
  async analyzeBeatsEnhanced(
    audioUrl: string,
    onProgress?: AnalysisProgressCallback
  ): Promise<EnhancedBeatAnalysisResult> {
    console.log('[BeatDetection] Starting enhanced analysis:', audioUrl);
    const startTime = performance.now();

    // 1. Fetch audio on main thread
    onProgress?.(0.02);
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // 2. Decode audio on main thread (requires AudioContext)
    onProgress?.(0.03);
    const audioContext = this.getAudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 3. Convert to mono
    const monoData = this.toMono(audioBuffer);

    console.log(`[BeatDetection] Audio decoded in ${(performance.now() - startTime).toFixed(0)}ms, sending to worker...`);

    // 4. Send to Web Worker for heavy analysis (non-blocking)
    const worker = this.getWorker();

    return new Promise<EnhancedBeatAnalysisResult>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const { type, data, error, progress } = event.data;

        if (type === 'progress' && progress !== undefined) {
          // Scale worker progress (0-1) to overall progress (0.05-0.95)
          onProgress?.(0.05 + progress * 0.9);
          return;
        }

        if (type === 'result' && data) {
          const elapsed = performance.now() - startTime;
          console.log(`[BeatDetection] Enhanced analysis complete in ${elapsed.toFixed(0)}ms`);
          console.log(`[BeatDetection] Found ${data.sections.length} sections, ${data.drumPattern.kickTimes.length} kicks, ${data.drumPattern.snareTimes.length} snares`);
          worker.removeEventListener('message', handleMessage);
          worker.removeEventListener('error', handleError);
          onProgress?.(1);
          resolve(data);
        } else if (type === 'error') {
          worker.removeEventListener('message', handleMessage);
          worker.removeEventListener('error', handleError);
          reject(new Error(error || 'Worker analysis failed'));
        }
      };

      const handleError = (event: ErrorEvent) => {
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);
        reject(new Error(`Worker error: ${event.message}`));
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);

      // Send audio data to worker (transferable for zero-copy)
      worker.postMessage(
        {
          type: 'analyze',
          audioData: monoData,
          sampleRate: audioBuffer.sampleRate,
        },
        [monoData.buffer] // Transfer ownership of the buffer
      );
    });
  }

  /**
   * Find the nearest beat to a given time
   * Used for transition snapping
   */
  findNearestBeat(time: number, beatTimes: number[]): number {
    if (beatTimes.length === 0) return time;

    return beatTimes.reduce((nearest, beat) =>
      Math.abs(beat - time) < Math.abs(nearest - time) ? beat : nearest
    );
  }

  /**
   * Find the nearest snare hit to a given time
   * Snare hits are excellent cut points (typically on beats 2 and 4)
   *
   * @param time - Target time in seconds
   * @param drumPattern - The analyzed drum pattern
   * @param maxDistance - Maximum distance to consider (default 0.5s)
   * @returns Nearest snare time, or null if none within range
   */
  findNearestSnare(
    time: number,
    drumPattern: DrumPattern,
    maxDistance: number = 0.5
  ): number | null {
    if (drumPattern.snareTimes.length === 0) return null;

    const nearest = drumPattern.snareTimes.reduce((best, snare) =>
      Math.abs(snare - time) < Math.abs(best - time) ? snare : best
    );

    return Math.abs(nearest - time) <= maxDistance ? nearest : null;
  }

  /**
   * Get the section at a given time
   */
  getSectionAtTime(time: number, sections: MusicSection[]): MusicSection | null {
    return sections.find(s => time >= s.startTime && time < s.endTime) || null;
  }

  /**
   * Calculate uniform clip duration based on tempo
   * Formula: barDuration = (60 / tempo) * 4 (standard 4/4 time)
   */
  calculateUniformClipDuration(tempo: number, targetBars: number = 2): number {
    const barDuration = (60 / tempo) * 4;
    return barDuration * targetBars;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Singleton instance
export const beatDetectionService = new BeatDetectionService();
