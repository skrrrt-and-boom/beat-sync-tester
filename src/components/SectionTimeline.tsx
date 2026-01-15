/**
 * Horizontal timeline showing music sections (intro, verse, chorus, drop, etc.)
 * Click on a section to seek to that point in the track
 */

import React from 'react';
import type { MusicSection } from '../types';

interface SectionTimelineProps {
  sections: MusicSection[];
  totalDuration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

/**
 * Get color for each section type
 */
function getSectionColor(type: MusicSection['type']): string {
  switch (type) {
    case 'intro':
      return 'bg-gray-500/60';
    case 'verse':
      return 'bg-blue-500/60';
    case 'chorus':
      return 'bg-purple-500/60';
    case 'drop':
      return 'bg-red-500/60';
    case 'breakdown':
      return 'bg-yellow-500/60';
    case 'outro':
      return 'bg-gray-500/60';
    default:
      return 'bg-theme-white/30';
  }
}

/**
 * Format time as MM:SS.ms
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
}

export const SectionTimeline: React.FC<SectionTimelineProps> = ({
  sections,
  totalDuration,
  currentTime,
  onSeek,
}) => {
  if (sections.length === 0 || totalDuration === 0) {
    return (
      <div className="h-8 bg-theme-black/40 border border-theme-dark rounded-lg flex items-center justify-center">
        <span className="text-xs text-theme-white/40">No sections detected</span>
      </div>
    );
  }

  // Calculate current time position as percentage
  const currentPositionPercent = (currentTime / totalDuration) * 100;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-theme-white/50">Sections (click to seek)</span>
        <span className="text-xs text-theme-white/50">{formatTime(totalDuration)}</span>
      </div>
      <div className="relative h-8 bg-theme-black/40 border border-theme-dark rounded-lg overflow-hidden">
        {/* Section bars */}
        {sections.map((section, index) => {
          const leftPercent = (section.startTime / totalDuration) * 100;
          const widthPercent = ((section.endTime - section.startTime) / totalDuration) * 100;

          return (
            <button
              key={`${section.type}-${index}`}
              className={`absolute top-0 bottom-0 ${getSectionColor(section.type)} hover:brightness-125 transition-all cursor-pointer group`}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
              }}
              onClick={() => onSeek(section.startTime)}
              title={`${section.type}: ${formatTime(section.startTime)} - ${formatTime(section.endTime)} (energy: ${section.energy.toFixed(2)})`}
            >
              {/* Section label (only show if wide enough) */}
              {widthPercent > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white/90 capitalize truncate px-1">
                  {section.type}
                </span>
              )}

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-theme-black/90 border border-theme-dark rounded text-xs text-theme-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="font-medium capitalize">{section.type}</div>
                <div className="text-theme-white/70">
                  {formatTime(section.startTime)} - {formatTime(section.endTime)}
                </div>
                <div className="text-theme-white/50">Energy: {section.energy.toFixed(2)}</div>
              </div>
            </button>
          );
        })}

        {/* Current time indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)] z-10 pointer-events-none"
          style={{ left: `${currentPositionPercent}%` }}
        />
      </div>
    </div>
  );
};

export default SectionTimeline;
