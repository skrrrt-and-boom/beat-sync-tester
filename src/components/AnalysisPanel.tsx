/**
 * Panel displaying beat analysis results and export functionality
 */

import React from 'react';
import { Download, Trash2 } from 'lucide-react';
import type { EnhancedBeatAnalysisResult } from '../services/BeatDetectionService';
import type { BeatCorrection } from '../hooks/useBeatCorrections';

interface AnalysisPanelProps {
  analysis: EnhancedBeatAnalysisResult | null;
  corrections: BeatCorrection[];
  trackUrl: string | null;
  onClearCorrections: () => void;
  isAnalyzing: boolean;
  analysisProgress: number;
}

/**
 * Format time as MM:SS.ms
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
}

/**
 * Export analysis data + corrections as JSON
 */
function exportAnalysis(
  analysis: EnhancedBeatAnalysisResult,
  corrections: BeatCorrection[],
  trackUrl: string
): void {
  const exportData = {
    exportedAt: new Date().toISOString(),
    trackUrl,
    analysis: {
      tempo: analysis.tempo,
      beatCount: analysis.beatCount,
      barCount: analysis.barCount,
      beatTimes: analysis.beatTimes,
      barTimes: analysis.barTimes,
      downbeatTimes: analysis.downbeatTimes,
      downbeatIndices: analysis.downbeatIndices,
      beatStrengths: analysis.beatStrengths,
      sections: analysis.sections,
      drumPattern: {
        kickTimes: analysis.drumPattern.kickTimes,
        snareTimes: analysis.drumPattern.snareTimes,
        hihatTimes: analysis.drumPattern.hihatTimes,
        patternLength: analysis.drumPattern.patternLength,
      },
      phraseBoundaries: analysis.phraseBoundaries,
      analysisTimeMs: analysis.analysisTimeMs,
      analysisVersion: analysis.analysisVersion,
    },
    corrections: {
      count: corrections.length,
      addedBeats: corrections.map(c => c.time),
    },
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `beat-analysis-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  analysis,
  corrections,
  trackUrl,
  onClearCorrections,
  isAnalyzing,
  analysisProgress,
}) => {
  if (isAnalyzing) {
    return (
      <div className="bg-theme-black/40 border border-theme-dark rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-theme-white/30 border-t-theme-white rounded-full animate-spin" />
          <span className="text-sm text-theme-white/70">
            Analyzing... {Math.round(analysisProgress * 100)}%
          </span>
        </div>
        <div className="mt-3 h-2 bg-theme-black/60 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-500 transition-all duration-300"
            style={{ width: `${analysisProgress * 100}%` }}
          />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-theme-black/40 border border-theme-dark rounded-xl p-4">
        <span className="text-sm text-theme-white/50">
          Select an audio file and click Analyze to see beat detection results
        </span>
      </div>
    );
  }

  return (
    <div className="bg-theme-black/40 border border-theme-dark rounded-xl divide-y divide-theme-dark">
      {/* Summary Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-medium text-theme-text">
              {analysis.tempo.toFixed(1)}
            </div>
            <div className="text-xs text-theme-white/50 uppercase tracking-wider">BPM</div>
          </div>
          <div>
            <div className="text-2xl font-medium text-theme-text">
              {analysis.beatCount}
            </div>
            <div className="text-xs text-theme-white/50 uppercase tracking-wider">Beats</div>
          </div>
          <div>
            <div className="text-2xl font-medium text-theme-text">
              {analysis.barCount}
            </div>
            <div className="text-xs text-theme-white/50 uppercase tracking-wider">Bars</div>
          </div>
          <div>
            <div className="text-2xl font-medium text-theme-text">
              {(analysis.analysisTimeMs / 1000).toFixed(2)}s
            </div>
            <div className="text-xs text-theme-white/50 uppercase tracking-wider">Analysis</div>
          </div>
        </div>

        {/* Corrections count */}
        {corrections.length > 0 && (
          <div className="mt-3 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <span className="text-sm text-orange-400">
              {corrections.length} manual correction{corrections.length !== 1 ? 's' : ''} added
            </span>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="p-4">
        <h3 className="text-xs font-medium text-theme-white/50 uppercase tracking-wider mb-2">
          Sections ({analysis.sections.length})
        </h3>
        <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
          {analysis.sections.map((section, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-theme-white/5"
            >
              <span className="capitalize text-theme-white/80">{section.type}</span>
              <div className="flex items-center gap-3 text-theme-white/50 text-xs font-mono">
                <span>
                  {formatTime(section.startTime)} - {formatTime(section.endTime)}
                </span>
                <span className="w-16 text-right">
                  E: {section.energy.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drum Pattern */}
      <div className="p-4">
        <h3 className="text-xs font-medium text-theme-white/50 uppercase tracking-wider mb-2">
          Drum Pattern
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="text-lg font-medium text-red-400">
              {analysis.drumPattern.kickTimes.length}
            </div>
            <div className="text-xs text-theme-white/50">Kicks</div>
          </div>
          <div className="text-center p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="text-lg font-medium text-yellow-400">
              {analysis.drumPattern.snareTimes.length}
            </div>
            <div className="text-xs text-theme-white/50">Snares</div>
          </div>
          <div className="text-center p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="text-lg font-medium text-green-400">
              {analysis.drumPattern.hihatTimes.length}
            </div>
            <div className="text-xs text-theme-white/50">Hi-hats</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 flex flex-wrap gap-2">
        <button
          onClick={() => trackUrl && exportAnalysis(analysis, corrections, trackUrl)}
          disabled={!trackUrl}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <Download size={16} />
          Export JSON
        </button>
        {corrections.length > 0 && (
          <button
            onClick={onClearCorrections}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
          >
            <Trash2 size={16} />
            Clear Corrections
          </button>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanel;
