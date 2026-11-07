// ==============================================================================
// ExamSphere – Countdown Timer Component
// Real-time server-authoritative countdown with urgency alerting (<5m remaining)
// ==============================================================================

import React, { useEffect, useRef } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export default function CountdownTimer({ remainingSeconds = 0, isExpired = false, onExpire }) {
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    if (remainingSeconds <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      if (onExpire) {
        onExpire();
      }
    }
  }, [remainingSeconds, onExpire]);

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');
  const formattedTime = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  const isUrgent = remainingSeconds > 0 && remainingSeconds <= 300; // < 5 minutes
  const isCritical = remainingSeconds > 0 && remainingSeconds <= 60; // < 1 minute

  return (
    <div
      id="exam-countdown-timer"
      aria-label={`Time remaining: ${formattedTime}`}
      className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border transition-all duration-300 font-mono text-xs font-bold ${
        isExpired
          ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
          : isCritical
          ? 'bg-rose-500/20 border-rose-500/80 text-rose-300 animate-pulse shadow-lg shadow-rose-500/20'
          : isUrgent
          ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
          : 'bg-slate-900/80 border-slate-700/80 text-slate-100 shadow-md'
      }`}
    >
      {isUrgent || isExpired ? (
        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
      ) : (
        <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
      )}

      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-sans font-medium">
          {isExpired ? 'Time Expired' : 'Remaining Time'}
        </span>
        <span className="text-sm tracking-widest text-slate-100">{isExpired ? '00:00:00' : formattedTime}</span>
      </div>
    </div>
  );
}
