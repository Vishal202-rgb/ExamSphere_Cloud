// ==============================================================================
// ExamSphere – Faculty Proctoring Timeline & Audit Modal
// Displays candidate integrity telemetry, anti-cheating strikes, audit history,
// and clearly distinguishes automatic two-strike disqualification from manual faculty action.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import api from '../../services/api.js';
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Eye,
  Minimize2,
  Maximize2,
  WifiOff,
  Wifi,
  Clock,
  AlertTriangle,
  X,
  Loader2,
  AlertCircle,
  Info,
  FileText,
  UserCheck,
  Activity,
  History,
} from 'lucide-react';

export default function ProctoringTimelineModal({ attemptId, candidateName, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'audit'

  useEffect(() => {
    if (!attemptId) return;

    const fetchTimeline = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/proctoring/attempts/${attemptId}`);
        if (res?.data) {
          setData(res.data);
        }
      } catch (err) {
        setError(err.message || 'Failed to load candidate proctoring timeline');
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [attemptId]);

  const summary = data?.summary || {};
  const timeline = data?.timeline || [];
  const auditLogs = data?.auditLogs || [];
  const attempt = data?.attempt || {};

  const getEventBadge = (type) => {
    switch (type) {
      case 'TAB_BLUR':
        return {
          icon: <Eye className="w-3.5 h-3.5 text-amber-400" />,
          label: 'Tab Blurred / Unfocused',
          bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
      case 'TAB_FOCUS':
        return {
          icon: <Eye className="w-3.5 h-3.5 text-emerald-400" />,
          label: 'Tab Focused / Regained',
          bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      case 'FULLSCREEN_EXIT':
        return {
          icon: <Minimize2 className="w-3.5 h-3.5 text-rose-400" />,
          label: 'Fullscreen Exited',
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold',
        };
      case 'FULLSCREEN_ENTER':
        return {
          icon: <Maximize2 className="w-3.5 h-3.5 text-blue-400" />,
          label: 'Fullscreen Entered',
          bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        };
      case 'DISCONNECT':
        return {
          icon: <WifiOff className="w-3.5 h-3.5 text-rose-400" />,
          label: 'Connection Interrupted',
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold',
        };
      case 'RECONNECT':
        return {
          icon: <Wifi className="w-3.5 h-3.5 text-emerald-400" />,
          label: 'Connection Restored',
          bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      default:
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-slate-400" />,
          label: type,
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
        };
    }
  };

  const getAuditBadge = (action) => {
    switch (action) {
      case 'EXAM_ATTEMPT_DISQUALIFIED':
        return {
          icon: <ShieldX className="w-3.5 h-3.5 text-rose-400" />,
          label: 'Attempt Disqualified',
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold',
        };
      case 'EXAM_VIOLATION_RECORDED':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
          label: 'Violation Recorded (Warning 1/2)',
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold',
        };
      case 'ATTEMPT_SUBMITTED':
      case 'ATTEMPT_AUTO_SUBMITTED':
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />,
          label: 'Attempt Submitted',
          bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      case 'ATTEMPT_STARTED':
        return {
          icon: <Activity className="w-3.5 h-3.5 text-blue-400" />,
          label: 'Exam Started',
          bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        };
      default:
        return {
          icon: <FileText className="w-3.5 h-3.5 text-slate-400" />,
          label: action.replace(/_/g, ' '),
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
        };
    }
  };

  return (
    <div
      id="proctoring-timeline-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
    >
      <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-navy shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Security & Proctoring Audit</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  Authoritative
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Candidate: <span className="text-blue-400 font-semibold">{candidateName}</span>
                {attempt.id && (
                  <span className="ml-2 font-mono text-[10px] text-slate-500">({attempt.id.slice(0, 8)}...)</span>
                )}
              </p>
            </div>
          </div>

          <button
            id="close-proctoring-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <p className="text-xs">Loading candidate telemetry and security records...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs">
              {error}
            </div>
          ) : (
            <>
              {/* Disqualification or Status Banner */}
              {summary.isDisqualified ? (
                <div
                  id="disqualification-status-banner"
                  className="p-4 rounded-2xl border bg-rose-950/40 border-rose-500/40 text-rose-200 space-y-2 shadow-lg shadow-rose-950/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <ShieldX className="w-5 h-5 text-rose-400 shrink-0" />
                      <div>
                        <span className="text-xs uppercase font-mono tracking-wider text-rose-400 font-bold block">
                          {summary.disqualificationType === 'AUTOMATIC'
                            ? 'Automatic Disqualification (Two-Strike System)'
                            : 'Manual Faculty Disqualification'}
                        </span>
                        <h3 className="font-bold text-sm text-white">
                          Attempt Terminated & Permanently Disqualified
                        </h3>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      2 / 2 Strikes
                    </span>
                  </div>
                  <div className="text-xs text-rose-300/90 pl-7 space-y-1">
                    <p>
                      <strong className="text-white">Reason:</strong>{' '}
                      {summary.disqualifyReason || 'Two unpermitted window/fullscreen departures detected.'}
                    </p>
                    {summary.disqualifiedAt && (
                      <p className="text-[11px] text-rose-400/80 font-mono">
                        Enforced at: {new Date(summary.disqualifiedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ) : summary.violationCount === 1 ? (
                <div
                  id="violation-warning-banner"
                  className="p-4 rounded-2xl border bg-amber-500/15 border-amber-500/30 text-amber-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold text-sm block text-amber-300">
                        Warning 1/2 Active (First Departure Recorded)
                      </span>
                      <span className="text-[11px] text-amber-400/80">
                        Next fullscreen exit or tab blur will trigger automatic disqualification.
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    1 / 2 Strikes
                  </span>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-bold text-sm block">Integrity Clear</span>
                      <span className="text-[11px] text-slate-400">
                        No policy strikes recorded during this active examination session.
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    0 / 2 Strikes
                  </span>
                </div>
              )}

              {/* Metrics Summary Grid */}
              <div className="grid grid-cols-4 gap-2.5 text-center">
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Strikes</div>
                  <div
                    className={`text-base font-bold font-mono ${
                      summary.violationCount >= 2
                        ? 'text-rose-400'
                        : summary.violationCount === 1
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {summary.violationCount || 0} / 2
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Fullscreen Exits</div>
                  <div className="text-base font-bold font-mono text-white">
                    {summary.fullscreenExitCount || 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Tab Switches</div>
                  <div className="text-base font-bold font-mono text-white">
                    {summary.tabBlurCount || 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Total Events</div>
                  <div className="text-base font-bold font-mono text-white">
                    {summary.totalEventsCount || 0}
                  </div>
                </div>
              </div>

              {/* Sub-tabs: Telemetry vs Audit History */}
              <div className="flex border-b border-slate-800 gap-4 pt-1">
                <button
                  id="tab-telemetry-btn"
                  onClick={() => setActiveTab('telemetry')}
                  className={`flex items-center gap-2 pb-2 text-xs font-bold transition border-b-2 ${
                    activeTab === 'telemetry'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Telemetry Events ({timeline.length})
                </button>
                <button
                  id="tab-audit-btn"
                  onClick={() => setActiveTab('audit')}
                  className={`flex items-center gap-2 pb-2 text-xs font-bold transition border-b-2 ${
                    activeTab === 'audit'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  Audit History ({auditLogs.length})
                </button>
              </div>

              {/* Telemetry Stream */}
              {activeTab === 'telemetry' && (
                <div className="space-y-2">
                  {timeline.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                      No browser activity telemetry events recorded for this candidate.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {timeline.map((ev) => {
                        const badge = getEventBadge(ev.eventType);
                        return (
                          <div
                            key={ev.id}
                            className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${badge.bg}`}
                              >
                                {badge.icon}
                                <span>{badge.label}</span>
                              </span>
                              {ev.details?.reason && (
                                <span className="text-[10px] text-slate-500">
                                  ({ev.details.reason})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span>{new Date(ev.clientTime || ev.serverTime).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Audit History Log */}
              {activeTab === 'audit' && (
                <div className="space-y-2" id="audit-history-list">
                  {auditLogs.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                      No security audit log entries recorded for this session.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {auditLogs.map((log) => {
                        const badge = getAuditBadge(log.action);
                        return (
                          <div
                            key={log.id}
                            className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${badge.bg}`}
                              >
                                {badge.icon}
                                <span>{badge.label}</span>
                              </span>
                              {log.metadata?.reason && (
                                <span className="text-[11px] text-slate-400">
                                  {log.metadata.reason}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Disclaimer Notice */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5 text-[11px] text-slate-400">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Notice: Automated browser activity telemetry and audit trails serve as authoritative records. Browsers cannot reliably prevent OS shortcuts, screenshots, or physical external devices, so monitoring focuses on window focus and fullscreen state changes.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
}

