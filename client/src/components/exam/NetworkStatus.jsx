// ==============================================================================
// ExamSphere – Network Status Component
// Displays connectivity state with heartbeat indication
// ==============================================================================

import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function NetworkStatus({ isOnline = true }) {
  return (
    <div
      id="exam-network-status"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all ${
        isOnline
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
      }`}
      title={isOnline ? 'Network connection active' : 'Network disconnected: changes are preserved locally'}
    >
      {isOnline ? (
        <>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
          <Wifi className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline</span>
        </>
      )}
    </div>
  );
}
