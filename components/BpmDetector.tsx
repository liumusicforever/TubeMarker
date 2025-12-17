import React, { useState, useEffect, useCallback } from 'react';
import { Icons } from '../constants';

interface BpmDetectorProps {
  onSave: (bpm: number) => void;
  initialBpm?: number;
}

const BpmDetector: React.FC<BpmDetectorProps> = ({ onSave, initialBpm = 0 }) => {
  const [taps, setTaps] = useState<number[]>([]);
  const [bpm, setBpm] = useState<number>(initialBpm);
  const [lastTapTime, setLastTapTime] = useState<number>(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    
    // Reset if it's been too long (2 seconds) since last tap
    if (now - lastTapTime > 2000 && lastTapTime !== 0) {
      setTaps([now]);
      setLastTapTime(now);
      return;
    }

    const newTaps = [...taps, now];
    // Keep only last 10 taps for rolling average
    if (newTaps.length > 10) newTaps.shift();
    
    setTaps(newTaps);
    setLastTapTime(now);

    if (newTaps.length > 1) {
      // Calculate intervals
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      setBpm(calculatedBpm);
    }
  }, [taps, lastTapTime]);

  // Keyboard support (Spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        // Only trigger if not focusing an input to avoid conflicts, 
        // but note: Space usually toggles video. 
        // We'll map 'T' key instead for better UX or let user click.
        // Let's stick to click for this implementation to avoid video conflict.
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTap]);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center space-y-4">
      <div className="text-center">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">BPM Detector</h3>
        <div className="flex items-baseline justify-center space-x-1">
          <span className="text-4xl font-bold text-slate-800">{bpm > 0 ? bpm : '--'}</span>
          <span className="text-xs text-slate-400">BPM</span>
        </div>
        {taps.length > 1 && (
           <p className="text-xs text-slate-400 mt-1">
             Interval: {(60000 / bpm).toFixed(0)}ms
           </p>
        )}
      </div>

      <div className="w-full flex gap-2">
        <button
          onClick={handleTap}
          className="flex-1 h-16 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 active:scale-95 transition-all rounded-lg flex flex-col items-center justify-center text-slate-600 font-medium border-2 border-slate-200 border-b-4"
        >
          <Icons.Activity className="w-6 h-6 mb-1" />
          <span>TAP</span>
        </button>
        
        <button
          onClick={() => onSave(bpm)}
          disabled={bpm === 0}
          className={`flex-1 h-16 rounded-lg flex flex-col items-center justify-center font-medium border-b-4 transition-all
            ${bpm > 0 
              ? 'bg-brand-500 hover:bg-brand-600 text-white border-brand-700 active:scale-95' 
              : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'}`}
        >
          <Icons.Check className="w-6 h-6 mb-1" />
          <span>SAVE</span>
        </button>
      </div>
    </div>
  );
};

export default BpmDetector;
