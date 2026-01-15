/**
 * Hook for managing manual beat corrections
 * Allows users to add/remove/adjust beat markers to compare against algorithm output
 */

import { useState, useCallback, useEffect } from 'react';

export interface BeatCorrection {
  time: number;
  id: string;
}

interface UseBeatCorrectionsReturn {
  corrections: BeatCorrection[];
  addCorrection: (time: number) => void;
  removeCorrection: (id: string) => void;
  updateCorrection: (id: string, newTime: number) => void;
  clearCorrections: () => void;
  findCorrectionNear: (time: number, tolerance?: number) => BeatCorrection | null;
}

/**
 * Generate a unique ID for each correction
 */
function generateId(): string {
  return `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get storage key for a track URL (stable across presigned URL changes)
 */
function getStorageKey(trackUrl: string): string {
  // Extract the file path from presigned URLs
  // e.g., "https://bucket.r2.dev/path/to/file.mp3?signature=xxx" -> "path/to/file.mp3"
  try {
    const url = new URL(trackUrl);
    return `beat-corrections:${url.pathname}`;
  } catch {
    return `beat-corrections:${trackUrl}`;
  }
}

export function useBeatCorrections(trackUrl: string | null): UseBeatCorrectionsReturn {
  const [corrections, setCorrections] = useState<BeatCorrection[]>([]);

  // Load corrections from localStorage when track changes
  useEffect(() => {
    if (!trackUrl) {
      setCorrections([]);
      return;
    }

    const key = getStorageKey(trackUrl);
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCorrections(parsed);
        }
      } else {
        setCorrections([]);
      }
    } catch {
      setCorrections([]);
    }
  }, [trackUrl]);

  // Save corrections to localStorage when they change
  useEffect(() => {
    if (!trackUrl) return;

    const key = getStorageKey(trackUrl);
    try {
      localStorage.setItem(key, JSON.stringify(corrections));
    } catch {
      console.warn('[useBeatCorrections] Failed to save corrections to localStorage');
    }
  }, [corrections, trackUrl]);

  const addCorrection = useCallback((time: number) => {
    setCorrections(prev => {
      // Prevent duplicate corrections within 50ms
      const isDuplicate = prev.some(c => Math.abs(c.time - time) < 0.05);
      if (isDuplicate) return prev;

      return [...prev, { time, id: generateId() }].sort((a, b) => a.time - b.time);
    });
  }, []);

  const removeCorrection = useCallback((id: string) => {
    setCorrections(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateCorrection = useCallback((id: string, newTime: number) => {
    setCorrections(prev =>
      prev
        .map(c => (c.id === id ? { ...c, time: newTime } : c))
        .sort((a, b) => a.time - b.time)
    );
  }, []);

  const clearCorrections = useCallback(() => {
    setCorrections([]);
  }, []);

  const findCorrectionNear = useCallback(
    (time: number, tolerance: number = 0.1): BeatCorrection | null => {
      return (
        corrections.find(c => Math.abs(c.time - time) <= tolerance) || null
      );
    },
    [corrections]
  );

  return {
    corrections,
    addCorrection,
    removeCorrection,
    updateCorrection,
    clearCorrections,
    findCorrectionNear,
  };
}
