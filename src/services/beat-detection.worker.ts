/**
 * Web Worker for beat detection using essentia.js
 * Runs heavy audio analysis off the main thread to prevent UI freezing
 *
 * Beat Sync V2 (Phase 2): Enhanced with energy, section, and drum analysis
 * for intelligent cut planning based on music structure.
 */

import { analyzeEnergy } from './EnergyAnalyzer';
import { analyzeSections, detectPhraseBoundaries } from './SectionAnalyzer';
import { analyzeDrums } from './DrumAnalyzer';
import type { DrumPattern, MusicSection } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EssentiaInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EssentiaWASMModule = any;

/**
 * Basic beat analysis result (Phase 1 compatibility)
 */
interface BasicBeatAnalysisResult {
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
interface EnhancedBeatAnalysisResult extends BasicBeatAnalysisResult {
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

interface WorkerMessage {
    type: 'analyze' | 'analyze-enhanced';
    audioData: Float32Array;
    sampleRate: number;
}

interface WorkerResponse {
    type: 'result' | 'error' | 'progress';
    data?: EnhancedBeatAnalysisResult;
    error?: string;
    progress?: number;
}

let essentia: EssentiaInstance | null = null;
let essentiaModule: EssentiaWASMModule | null = null;
let isInitialized = false;

/**
 * Initialize essentia.js WASM module inside the worker
 */
async function initialize(): Promise<void> {
    if (isInitialized) return;

    try {
        // Dynamic import essentia.js
        const EssentiaWASMModule = await import('essentia.js/dist/essentia-wasm.es.js');
        const EssentiaCoreModule = await import('essentia.js/dist/essentia.js-core.es.js');

        const wasmModule = EssentiaWASMModule.EssentiaWASM;
        const Essentia = EssentiaCoreModule.default;

        if (!wasmModule) {
            throw new Error('EssentiaWASM export not found');
        }

        essentiaModule = wasmModule;
        essentia = new Essentia(essentiaModule, false);
        isInitialized = true;
    } catch (error) {
        console.error('[BeatWorker] Failed to initialize:', error);
        throw error;
    }
}

/**
 * Calculate beat strengths using RMS energy around each beat position
 */
function calculateBeatStrengths(
    audioData: Float32Array,
    beatTimes: number[],
    sampleRate: number
): number[] {
    const frameSize = 2048;
    const halfFrame = frameSize / 2;

    const rawStrengths = beatTimes.map(beatTime => {
        const sampleIndex = Math.floor(beatTime * sampleRate);
        const start = Math.max(0, sampleIndex - halfFrame);
        const end = Math.min(audioData.length, sampleIndex + halfFrame);

        let sumSquares = 0;
        for (let i = start; i < end; i++) {
            sumSquares += audioData[i] * audioData[i];
        }

        const rms = Math.sqrt(sumSquares / (end - start));
        return rms;
    });

    // Normalize to 0-1 range
    if (rawStrengths.length === 0) return [];

    const maxStrength = Math.max(...rawStrengths);
    if (maxStrength === 0) return rawStrengths.map(() => 0);

    return rawStrengths.map(s => s / maxStrength);
}

/**
 * Detect downbeats based on onset strength and bar position
 */
function detectDownbeats(
    beatTimes: number[],
    beatStrengths: number[]
): { downbeatIndices: number[]; downbeatTimes: number[] } {
    if (beatStrengths.length === 0) {
        return { downbeatIndices: [], downbeatTimes: [] };
    }

    const mean = beatStrengths.reduce((a, b) => a + b, 0) / beatStrengths.length;
    const variance = beatStrengths.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / beatStrengths.length;
    const std = Math.sqrt(variance);
    const threshold = mean + 0.3 * std;

    const downbeatIndices: number[] = [];

    beatStrengths.forEach((strength, i) => {
        const isStrong = strength > threshold;
        const isBarPosition = i % 4 === 0;

        if (isStrong || isBarPosition) {
            downbeatIndices.push(i);
        }
    });

    const downbeatTimes = downbeatIndices
        .filter(i => i < beatTimes.length)
        .map(i => beatTimes[i]);

    return { downbeatIndices, downbeatTimes };
}

/**
 * Send progress update to main thread
 */
function sendProgress(progress: number): void {
    const response: WorkerResponse = { type: 'progress', progress };
    self.postMessage(response);
}

/**
 * Analyze beats from audio data with full Phase 2 enhancements
 */
async function analyzeBeatsEnhanced(
    audioData: Float32Array,
    sampleRate: number
): Promise<EnhancedBeatAnalysisResult> {
    const startTime = performance.now();

    // Phase 1: Initialize essentia
    sendProgress(0.05);
    await initialize();

    if (!essentia || !essentiaModule) {
        throw new Error('Essentia not initialized');
    }

    // Phase 1: Basic beat tracking with essentia
    sendProgress(0.1);
    const audioVector = essentia.arrayToVector(audioData);

    sendProgress(0.2);
    const beatResult = essentia.BeatTrackerMultiFeature(audioVector);
    const beatTimes: number[] = essentia.vectorToArray(beatResult.ticks);

    // Calculate tempo from beat intervals
    let tempo = 120;
    if (beatTimes.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < beatTimes.length; i++) {
            intervals.push(beatTimes[i] - beatTimes[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        tempo = 60 / avgInterval;
    }

    // Calculate bar times (every 4 beats)
    const barTimes: number[] = [];
    for (let i = 0; i < beatTimes.length; i += 4) {
        barTimes.push(beatTimes[i]);
    }

    sendProgress(0.35);

    // Phase 2: Beat strength analysis
    const beatStrengths = calculateBeatStrengths(audioData, beatTimes, sampleRate);

    // Identify downbeats
    const { downbeatIndices, downbeatTimes } = detectDownbeats(beatTimes, beatStrengths);

    sendProgress(0.45);

    // Phase 2: Energy envelope analysis
    console.log('[BeatWorker] Running energy analysis...');
    const energyCurve = analyzeEnergy(audioData, sampleRate);

    sendProgress(0.6);

    // Phase 2: Section detection
    console.log('[BeatWorker] Running section analysis...');
    const audioDuration = audioData.length / sampleRate;
    const sections = analyzeSections(energyCurve, barTimes, audioDuration);

    sendProgress(0.75);

    // Phase 2: Drum pattern detection
    console.log('[BeatWorker] Running drum analysis...');
    const drumPattern = analyzeDrums(audioData, sampleRate, beatTimes);

    sendProgress(0.9);

    // Phase 2: Phrase boundary detection
    console.log('[BeatWorker] Detecting phrase boundaries...');
    const phraseBoundaries = detectPhraseBoundaries(barTimes, sections);

    const analysisTimeMs = performance.now() - startTime;
    console.log(`[BeatWorker] Enhanced analysis complete in ${analysisTimeMs.toFixed(0)}ms`);
    console.log(`[BeatWorker] Drums detected: ${drumPattern.kickTimes.length} kicks, ${drumPattern.snareTimes.length} snares, ${drumPattern.hihatTimes.length} hi-hats`);
    console.log(`[BeatWorker] Structure: ${sections.length} sections, ${phraseBoundaries.length} phrase boundaries`);

    sendProgress(1.0);

    return {
        // Basic beat data (Phase 1 compatible)
        beatTimes,
        downbeatIndices,
        downbeatTimes,
        barTimes,
        tempo,
        beatCount: beatTimes.length,
        barCount: barTimes.length,

        // Enhanced data (Phase 2)
        beatStrengths,
        drumPattern,
        sections,
        energyCurve,
        phraseBoundaries,

        // Metadata
        analysisVersion: 2,
        analysisTimeMs,
    };
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const { type, audioData, sampleRate } = event.data;

    // Both 'analyze' and 'analyze-enhanced' now use the enhanced pipeline
    // for backward compatibility while providing Phase 2 features
    if (type === 'analyze' || type === 'analyze-enhanced') {
        try {
            const result = await analyzeBeatsEnhanced(audioData, sampleRate);
            const response: WorkerResponse = { type: 'result', data: result };
            self.postMessage(response);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Analysis failed';
            const response: WorkerResponse = { type: 'error', error: message };
            self.postMessage(response);
        }
    }
};

// Export empty object to make this a module (required for Vite worker)
export {};
