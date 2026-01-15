/**
 * Legend showing the color codes for different beat marker types
 */

import React from 'react';

interface LegendItem {
  color: string;
  label: string;
  opacity?: number;
}

const LEGEND_ITEMS: LegendItem[] = [
  { color: 'rgba(156, 163, 175, 0.6)', label: 'Beat', opacity: 0.6 },
  { color: 'rgba(255, 255, 255, 0.8)', label: 'Bar', opacity: 0.8 },
  { color: 'rgba(34, 211, 238, 0.8)', label: 'Downbeat', opacity: 0.8 },
  { color: 'rgba(168, 85, 247, 0.7)', label: 'Phrase', opacity: 0.7 },
  { color: 'rgba(239, 68, 68, 0.6)', label: 'Kick', opacity: 0.6 },
  { color: 'rgba(250, 204, 21, 0.6)', label: 'Snare', opacity: 0.6 },
  { color: 'rgba(34, 197, 94, 0.6)', label: 'Hi-hat', opacity: 0.6 },
  { color: 'rgba(249, 115, 22, 1)', label: 'Correction', opacity: 1 },
];

export const BeatMarkerLegend: React.FC = () => {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 bg-theme-black/40 border border-theme-dark rounded-xl">
      <span className="text-xs text-theme-white/50 font-medium uppercase tracking-wider">Legend:</span>
      {LEGEND_ITEMS.map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor: item.color,
            }}
          />
          <span className="text-xs text-theme-white/70">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default BeatMarkerLegend;
