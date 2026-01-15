/**
 * Beat Detection & Sync Tester - Standalone Version
 *
 * A standalone tool for visualizing beat detection accuracy and testing sync.
 * Shows detected beats overlaid on waveform with manual correction capabilities.
 *
 * Audio Input Methods:
 * 1. Local file picker (drag & drop or browse)
 * 2. Paste URL directly
 */

import React, { useState, useCallback, useRef } from 'react';
import { Music, Upload, Link as LinkIcon, FileAudio } from 'lucide-react';
import { beatDetectionService, type EnhancedBeatAnalysisResult } from './services/BeatDetectionService';

// Components
import { BeatVisualizerWaveform } from './components/BeatVisualizerWaveform';
import { AnalysisPanel } from './components/AnalysisPanel';
import { SectionTimeline } from './components/SectionTimeline';
import { BeatMarkerLegend } from './components/BeatMarkerLegend';
import { useBeatCorrections } from './hooks/useBeatCorrections';

export const App: React.FC = () => {
  // Audio source state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis state
  const [analysis, setAnalysis] = useState<EnhancedBeatAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Corrections
  const {
    corrections,
    addCorrection,
    removeCorrection,
    updateCorrection,
    clearCorrections,
  } = useBeatCorrections(audioUrl);

  // Handle file selection
  const handleFileSelect = (file: File) => {
    // Revoke previous object URL to avoid memory leaks
    if (audioUrl && audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrl);
    }

    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioFileName(file.name);
    setAnalysis(null);
    setCurrentTime(0);
    setIsPlaying(false);
    setAnalysisError(null);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      handleFileSelect(file);
    }
  };

  // Handle custom URL submission
  const handleCustomUrlSubmit = () => {
    if (customUrl.trim()) {
      // Revoke previous blob URL if exists
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }

      setAudioUrl(customUrl.trim());
      setAudioFileName(null);
      setAnalysis(null);
      setCurrentTime(0);
      setIsPlaying(false);
      setAnalysisError(null);
    }
  };

  // Run beat analysis
  const runAnalysis = async () => {
    if (!audioUrl) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisError(null);
    setAnalysis(null);

    try {
      const result = await beatDetectionService.analyzeBeatsEnhanced(
        audioUrl,
        (progress) => setAnalysisProgress(progress)
      );
      setAnalysis(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setAnalysisError(message);
      console.error('[BeatSyncTester] Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  // Handle seek from section timeline
  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Display name for current audio
  const displayName = audioFileName || (audioUrl ? 'URL Audio' : 'No audio selected');

  return (
    <div className="min-h-screen bg-theme-black py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-theme-text font-raleway">
            Beat Detection & Sync Tester
          </h1>
          <p className="text-theme-white/60 mt-1">
            Visualize beat detection accuracy and test music-video synchronization
          </p>
        </div>

        {/* Audio Source Selection */}
        <div className="mb-6 p-4 bg-theme-black/40 border border-theme-dark rounded-xl">
          <h2 className="text-sm font-medium text-theme-white/70 mb-3 flex items-center gap-2">
            <Music size={16} />
            Audio Source
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* File Drop Zone */}
            <div>
              <label className="block text-xs text-theme-white/50 mb-1">Local File</label>
              <div
                className={`relative flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-theme-dark hover:border-theme-mid bg-theme-black/40'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                {audioFileName ? (
                  <>
                    <FileAudio size={24} className="text-cyan-400 mb-1" />
                    <span className="text-sm text-theme-white/80 truncate max-w-full px-4">
                      {audioFileName}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload size={24} className="text-theme-white/40 mb-1" />
                    <span className="text-xs text-theme-white/50">
                      Drop audio file or click to browse
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Custom URL */}
            <div>
              <label className="block text-xs text-theme-white/50 mb-1">Or paste URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCustomUrlSubmit()}
                  placeholder="https://example.com/audio.mp3"
                  className="flex-1 px-3 py-2 bg-theme-black/60 border border-theme-dark rounded-lg text-theme-text text-sm focus:outline-none focus:border-theme-mid placeholder:text-theme-white/30"
                />
                <button
                  onClick={handleCustomUrlSubmit}
                  disabled={!customUrl.trim()}
                  className="px-3 py-2 bg-theme-white/5 hover:bg-theme-white/10 border border-theme-dark rounded-lg transition-colors disabled:opacity-50"
                  title="Load URL"
                >
                  <LinkIcon size={16} className="text-theme-white/70" />
                </button>
              </div>
              <p className="text-xs text-theme-white/40 mt-1">
                Press Enter or click to load
              </p>
            </div>
          </div>

          {/* Analyze Button */}
          {audioUrl && (
            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={runAnalysis}
                disabled={isAnalyzing}
                className="px-6 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Beats'}
              </button>
              <span className="text-sm text-theme-white/60">
                Selected: <span className="text-theme-white/80">{displayName}</span>
              </span>
            </div>
          )}

          {/* Error display */}
          {analysisError && (
            <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              Error: {analysisError}
            </div>
          )}
        </div>

        {/* Section Timeline */}
        {analysis && (
          <div className="mb-4">
            <SectionTimeline
              sections={analysis.sections}
              totalDuration={duration}
              currentTime={currentTime}
              onSeek={handleSeek}
            />
          </div>
        )}

        {/* Waveform Visualizer */}
        {audioUrl && (
          <div className="mb-4">
            <BeatVisualizerWaveform
              audioUrl={audioUrl}
              analysis={analysis}
              corrections={corrections}
              onAddCorrection={addCorrection}
              onRemoveCorrection={removeCorrection}
              onUpdateCorrection={updateCorrection}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
              onDurationChange={setDuration}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
            />
          </div>
        )}

        {/* Beat Legend */}
        {analysis && (
          <div className="mb-6">
            <BeatMarkerLegend />
          </div>
        )}

        {/* Analysis Panel */}
        <AnalysisPanel
          analysis={analysis}
          corrections={corrections}
          trackUrl={audioUrl}
          onClearCorrections={clearCorrections}
          isAnalyzing={isAnalyzing}
          analysisProgress={analysisProgress}
        />
      </div>
    </div>
  );
};

export default App;
