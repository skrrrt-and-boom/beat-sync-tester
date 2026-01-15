/**
 * Enhanced waveform visualization with beat markers
 * Shows algorithm-detected beats (semi-transparent) and user corrections (solid orange)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Play, Pause, RotateCcw } from 'lucide-react';
import type { EnhancedBeatAnalysisResult } from '../services/BeatDetectionService';
import type { BeatCorrection } from '../hooks/useBeatCorrections';

// Pixels per second for waveform (affects zoom)
const DEFAULT_PIXELS_PER_SECOND = 50;
const MIN_PIXELS_PER_SECOND = 10;
const MAX_PIXELS_PER_SECOND = 200;

interface BeatVisualizerWaveformProps {
  audioUrl: string | null;
  analysis: EnhancedBeatAnalysisResult | null;
  corrections: BeatCorrection[];
  onAddCorrection: (time: number) => void;
  onRemoveCorrection: (id: string) => void;
  onUpdateCorrection: (id: string, newTime: number) => void;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
}

/**
 * Format time as MM:SS.mmm
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

export const BeatVisualizerWaveform: React.FC<BeatVisualizerWaveformProps> = ({
  audioUrl,
  analysis,
  corrections,
  onAddCorrection,
  onRemoveCorrection,
  onUpdateCorrection,
  currentTime,
  onTimeUpdate,
  onDurationChange,
  isPlaying,
  onPlayPause,
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_PIXELS_PER_SECOND);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!audioUrl || !waveformRef.current) return;

    setIsReady(false);

    // Cleanup previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgba(255, 255, 255, 0.3)',
      progressColor: 'rgba(255, 255, 255, 0.5)',
      cursorColor: 'rgba(255, 255, 255, 0.8)',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 120,
      normalize: true,
      backend: 'WebAudio',
      minPxPerSec: pixelsPerSecond,
    });

    // Add Regions Plugin
    const wsRegions = ws.registerPlugin(RegionsPlugin.create());
    regionsPluginRef.current = wsRegions;

    ws.on('ready', () => {
      const dur = ws.getDuration();
      setDuration(dur);
      onDurationChange(dur);
      setIsReady(true);
    });

    ws.on('audioprocess', (time) => {
      onTimeUpdate(time);
    });

    ws.on('seeking', (time) => {
      onTimeUpdate(time);
    });

    ws.on('finish', () => {
      onTimeUpdate(0);
    });

    // Handle clicks on waveform to add corrections
    ws.on('interaction', (newTime) => {
      // Seek to clicked position
      ws.setTime(newTime);
      onTimeUpdate(newTime);
    });

    ws.load(audioUrl);
    wavesurferRef.current = ws;

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      regionsPluginRef.current = null;
    };
  }, [audioUrl]);

  // Update zoom level
  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.zoom(pixelsPerSecond);
    }
  }, [pixelsPerSecond, isReady]);

  // Update playback rate
  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate, isReady]);

  // Sync play/pause state
  useEffect(() => {
    if (!wavesurferRef.current || !isReady) return;

    if (isPlaying && !wavesurferRef.current.isPlaying()) {
      wavesurferRef.current.play();
    } else if (!isPlaying && wavesurferRef.current.isPlaying()) {
      wavesurferRef.current.pause();
    }
  }, [isPlaying, isReady]);

  // Auto-scroll to keep playhead visible during playback
  useEffect(() => {
    if (!scrollContainerRef.current || !isReady || !isPlaying) return;

    const container = scrollContainerRef.current;
    const playheadPosition = currentTime * pixelsPerSecond;
    const containerWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;

    // Define margins - playhead should stay within the middle 60% of the view
    const leftMargin = containerWidth * 0.2;
    const rightMargin = containerWidth * 0.8;

    const playheadRelativePosition = playheadPosition - scrollLeft;

    // If playhead is past the right margin, scroll to put it at the left margin
    if (playheadRelativePosition > rightMargin) {
      container.scrollTo({
        left: playheadPosition - leftMargin,
        behavior: 'smooth',
      });
    }
    // If playhead is before the left margin (e.g., after seeking back), scroll to show it
    else if (playheadRelativePosition < leftMargin && scrollLeft > 0) {
      container.scrollTo({
        left: Math.max(0, playheadPosition - leftMargin),
        behavior: 'smooth',
      });
    }
  }, [currentTime, pixelsPerSecond, isReady, isPlaying]);

  // Add beat markers when analysis is ready
  useEffect(() => {
    if (!regionsPluginRef.current || !analysis || !isReady) return;

    // Clear existing algorithm markers
    const regions = regionsPluginRef.current.getRegions();
    regions.forEach(r => {
      if (r.id?.startsWith('algo-')) {
        r.remove();
      }
    });

    // Add beat markers (gray, semi-transparent)
    analysis.beatTimes.forEach((time, index) => {
      const isBar = analysis.barTimes.includes(time);
      const isDownbeat = analysis.downbeatIndices.includes(index);

      let color = 'rgba(156, 163, 175, 0.4)'; // Gray for regular beats

      if (isBar) {
        color = 'rgba(255, 255, 255, 0.5)'; // White for bars
      }
      if (isDownbeat) {
        color = 'rgba(34, 211, 238, 0.5)'; // Cyan for downbeats
      }

      regionsPluginRef.current?.addRegion({
        start: time,
        end: time,
        color,
        drag: false,
        resize: false,
        id: `algo-beat-${index}`,
      });
    });

    // Add kick markers (red)
    analysis.drumPattern.kickTimes.forEach((time, index) => {
      regionsPluginRef.current?.addRegion({
        start: time,
        end: time,
        color: 'rgba(239, 68, 68, 0.4)',
        drag: false,
        resize: false,
        id: `algo-kick-${index}`,
      });
    });

    // Add snare markers (yellow)
    analysis.drumPattern.snareTimes.forEach((time, index) => {
      regionsPluginRef.current?.addRegion({
        start: time,
        end: time,
        color: 'rgba(250, 204, 21, 0.4)',
        drag: false,
        resize: false,
        id: `algo-snare-${index}`,
      });
    });

    // Add phrase boundary markers (purple - premium transition points)
    if (analysis.phraseBoundaries) {
      analysis.phraseBoundaries.forEach((time, index) => {
        regionsPluginRef.current?.addRegion({
          start: time,
          end: time,
          color: 'rgba(168, 85, 247, 0.7)', // Purple for phrase boundaries
          drag: false,
          resize: false,
          id: `algo-phrase-${index}`,
        });
      });
    }

    // Note: We don't add hi-hat markers by default as they're too dense
    // Uncomment below to show them:
    // analysis.drumPattern.hihatTimes.forEach((time, index) => {
    //   regionsPluginRef.current?.addRegion({
    //     start: time,
    //     end: time,
    //     color: 'rgba(34, 197, 94, 0.3)',
    //     drag: false,
    //     resize: false,
    //     id: `algo-hihat-${index}`,
    //   });
    // });
  }, [analysis, isReady]);

  // Add correction markers (orange, solid, draggable)
  useEffect(() => {
    if (!regionsPluginRef.current || !isReady) return;

    // Clear existing correction markers
    const regions = regionsPluginRef.current.getRegions();
    regions.forEach(r => {
      if (r.id?.startsWith('corr-')) {
        r.remove();
      }
    });

    // Add correction markers
    corrections.forEach(correction => {
      const region = regionsPluginRef.current?.addRegion({
        start: correction.time,
        end: correction.time,
        color: 'rgba(249, 115, 22, 1)', // Orange, solid
        drag: true,
        resize: false,
        id: correction.id,
      });

      // Handle drag end - update correction time
      if (region) {
        region.on('update-end', () => {
          onUpdateCorrection(correction.id, region.start);
        });
      }
    });
  }, [corrections, isReady, onUpdateCorrection]);

  // Handle click - normal click seeks, shift+click adds correction
  const handleWaveformClick = useCallback(
    (e: React.MouseEvent) => {
      if (!wavesurferRef.current || !isReady) return;

      // Shift+click to add a correction at click position
      if (e.shiftKey) {
        // The interaction event handles seeking, so we get the current time after seek
        // We use a small timeout to ensure the time is updated
        setTimeout(() => {
          if (wavesurferRef.current) {
            const time = wavesurferRef.current.getCurrentTime();
            onAddCorrection(time);
          }
        }, 50);
        return;
      }

      // Normal click just seeks (handled by WaveSurfer's interaction event)
      // No additional action needed - WaveSurfer handles the seek
    },
    [isReady, onAddCorrection]
  );

  // Handle right-click to remove corrections
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!wavesurferRef.current || !isReady) return;

      // Find nearest correction within 100ms of current playback position
      const clickTime = wavesurferRef.current.getCurrentTime();
      const nearestCorrection = corrections.find(
        c => Math.abs(c.time - clickTime) < 0.1
      );

      if (nearestCorrection) {
        e.preventDefault(); // Prevent context menu only if removing a correction
        onRemoveCorrection(nearestCorrection.id);
      }
    },
    [isReady, corrections, onRemoveCorrection]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Spacebar to play/pause
      if (e.code === 'Space' && !e.target?.toString().includes('Input')) {
        // Prevent scrolling and only trigger if not typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          onPlayPause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPlayPause]);

  const handleSeekToStart = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setTime(0);
      onTimeUpdate(0);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Controls header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-theme-white/50">
          Click to seek · Shift+click to add · Right-click to remove · Space to play/pause
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-theme-white/50">Zoom:</span>
          <input
            type="range"
            min={MIN_PIXELS_PER_SECOND}
            max={MAX_PIXELS_PER_SECOND}
            value={pixelsPerSecond}
            onChange={e => setPixelsPerSecond(Number(e.target.value))}
            className="w-24 h-1 bg-theme-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
          />
          <span className="text-xs text-theme-white/50 w-10">{pixelsPerSecond}px</span>
        </div>
      </div>

      {/* Waveform container */}
      <div
        className="relative bg-theme-black/40 border border-theme-dark rounded-xl overflow-hidden"
        onClick={handleWaveformClick}
        onContextMenu={handleContextMenu}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-theme-black/60 z-20">
            <div className="w-6 h-6 border-2 border-theme-white/30 border-t-theme-white rounded-full animate-spin" />
          </div>
        )}

        <div
          ref={scrollContainerRef}
          className="overflow-x-auto overflow-y-hidden custom-scrollbar"
        >
          <div
            ref={waveformRef}
            className="min-h-[120px]"
            style={{ width: duration * pixelsPerSecond || '100%' }}
          />
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-4 px-2">
        <button
          onClick={onPlayPause}
          disabled={!isReady}
          className="flex items-center justify-center w-10 h-10 bg-theme-white/10 hover:bg-theme-white/20 border border-theme-dark rounded-full transition-colors disabled:opacity-50"
        >
          {isPlaying ? (
            <Pause size={18} fill="currentColor" className="text-theme-white" />
          ) : (
            <Play size={18} fill="currentColor" className="text-theme-white ml-0.5" />
          )}
        </button>

        <button
          onClick={handleSeekToStart}
          disabled={!isReady}
          className="flex items-center justify-center w-8 h-8 bg-theme-white/5 hover:bg-theme-white/10 border border-theme-dark rounded-full transition-colors disabled:opacity-50"
          title="Back to start"
        >
          <RotateCcw size={14} className="text-theme-white/70" />
        </button>

        {/* Playback speed */}
        <div className="flex items-center gap-1">
          {[0.5, 1, 2].map(rate => (
            <button
              key={rate}
              onClick={() => setPlaybackRate(rate)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                playbackRate === rate
                  ? 'bg-theme-white/20 text-theme-white'
                  : 'bg-theme-white/5 text-theme-white/60 hover:bg-theme-white/10'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Time display */}
        <div className="flex-1 text-right">
          <span className="font-mono text-sm text-theme-white/80">
            {formatTime(currentTime)}
          </span>
          <span className="text-theme-white/40 mx-1">/</span>
          <span className="font-mono text-sm text-theme-white/50">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BeatVisualizerWaveform;
