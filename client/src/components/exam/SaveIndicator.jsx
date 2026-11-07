// ==============================================================================
// ExamSphere – Save Indicator Component
// Visual feedback for asynchronous answer persistence and optimistic updates
// ==============================================================================

import React from 'react';
import { CheckCircle2, Loader2, AlertCircle, WifiOff } from 'lucide-react';

export default function SaveIndicator({ status = 'saved', lastSavedAt = null }) {
  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div
      id="exam-save-indicator"
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-medium transition-all"
    >
      {status === 'saving' && (
        <span className="inline-flex items-center gap-1.5 text-blue-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
          <span>Saving...</span>
        </span>
      )}

      {status === 'saved' && (
        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Saved {lastSavedAt ? `(${formatTime(lastSavedAt)})` : ''}</span>
        </span>
      )}

      {status === 'error' && (
        <span className="inline-flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/30">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Unsaved (retrying...)</span>
        </span>
      )}

      {status === 'offline' && (
        <span className="inline-flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline (cached locally)</span>
        </span>
      )}
    </div>
  );
}
