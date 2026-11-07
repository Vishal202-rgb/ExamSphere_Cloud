import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api.js';
import { getSocket } from '../../services/socket.js';
import {
  Activity,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Megaphone,
  ArrowLeft,
  Wifi,
  WifiOff,
  Radio,
  FileCheck2,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import ProctoringTimelineModal from './ProctoringTimelineModal.jsx';

export default function LiveExamMonitoringPage() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState(null);
  const [exam, setExam] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search filter
  const [search, setSearch] = useState('');

  // Announcement Modal
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState(null);

  // Proctoring Timeline Modal
  const [selectedProctoringAttempt, setSelectedProctoringAttempt] = useState(null);

  const fetchMonitoringData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/faculty/exams/${examId}/monitoring`);
      if (res?.data) {
        setData(res.data);
        setExam(res.data.exam);
        setStats(res.data.stats);
        setCandidates(res.data.candidates || []);
        setRecentActivity(res.data.recentActivity || []);
      }
    } catch (err) {
      console.error('Failed to load live monitoring telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();

    // 1. Initialize Socket.IO connection and join exam monitoring room
    const socket = getSocket();
    if (socket) {
      socket.emit('exam:join', { examId }, (ack) => {
        if (ack?.error) console.warn('Socket exam:join error:', ack.error);
      });

      // 2. Real-Time Telemetry Event Handlers
      const handleCandidateOnline = (payload) => {
        setCandidates((prev) =>
          prev.map((c) => (c.studentId === payload.studentId ? { ...c, isOnline: true } : c))
        );
        setStats((prev) => (prev ? { ...prev, onlineCount: prev.onlineCount + 1 } : prev));
      };

      const handleCandidateOffline = (payload) => {
        setCandidates((prev) =>
          prev.map((c) => (c.studentId === payload.studentId ? { ...c, isOnline: false } : c))
        );
        setStats((prev) =>
          prev ? { ...prev, onlineCount: Math.max(0, prev.onlineCount - 1) } : prev
        );
      };

      const handleExamStarted = (payload) => {
        setCandidates((prev) =>
          prev.map((c) =>
            c.studentId === payload.studentId
              ? {
                  ...c,
                  hasStarted: true,
                  status: 'IN_PROGRESS',
                  startedAt: payload.startedAt,
                  expiresAt: payload.expiresAt,
                }
              : c
          )
        );
        setStats((prev) =>
          prev
            ? {
                ...prev,
                startedCount: prev.startedCount + 1,
                inProgressCount: prev.inProgressCount + 1,
              }
            : prev
        );
        setRecentActivity((prev) => [
          {
            id: `act-${Date.now()}`,
            action: 'EXAM_ATTEMPT_STARTED',
            user: { name: payload.studentName },
            timestamp: payload.startedAt,
          },
          ...prev.slice(0, 14),
        ]);
      };

      const handleSubmissionReceived = (payload) => {
        setCandidates((prev) =>
          prev.map((c) =>
            c.studentId === payload.studentId
              ? {
                  ...c,
                  status: 'SUBMITTED',
                  submissionReason: payload.submissionReason,
                  submittedAt: payload.submittedAt,
                }
              : c
          )
        );
        setStats((prev) =>
          prev
            ? {
                ...prev,
                submittedCount: prev.submittedCount + 1,
                inProgressCount: Math.max(0, prev.inProgressCount - 1),
              }
            : prev
        );
        setRecentActivity((prev) => [
          {
            id: `act-${Date.now()}`,
            action: 'EXAM_ATTEMPT_SUBMITTED',
            user: { name: `Candidate` },
            timestamp: payload.submittedAt,
          },
          ...prev.slice(0, 14),
        ]);
      };

      const handleAttemptExpired = (payload) => {
        setCandidates((prev) =>
          prev.map((c) =>
            c.studentId === payload.studentId
              ? {
                  ...c,
                  status: 'AUTO_SUBMITTED',
                  submissionReason: 'AUTO_TIMEOUT',
                }
              : c
          )
        );
        setStats((prev) =>
          prev
            ? {
                ...prev,
                expiredCount: prev.expiredCount + 1,
                inProgressCount: Math.max(0, prev.inProgressCount - 1),
              }
            : prev
        );
      };

      const handleCandidateViolation = (payload) => {
        setCandidates((prev) =>
          prev.map((c) =>
            c.studentId === payload.studentId || c.attemptId === payload.attemptId
              ? {
                  ...c,
                  violationCount: payload.violationCount,
                  ...(payload.eventType === 'TAB_BLUR' ? { tabSwitchCount: (c.tabSwitchCount || 0) + 1 } : {}),
                  ...(payload.eventType === 'FULLSCREEN_EXIT' ? { fullscreenExitCount: (c.fullscreenExitCount || 0) + 1 } : {}),
                }
              : c
          )
        );
        setRecentActivity((prev) => [
          {
            id: `act-${Date.now()}`,
            action: 'EXAM_VIOLATION_RECORDED',
            user: { name: payload.studentName || 'Candidate' },
            timestamp: payload.timestamp || new Date().toISOString(),
            metadata: { strike: payload.strike, eventType: payload.eventType },
          },
          ...prev.slice(0, 14),
        ]);
      };

      const handleCandidateDisqualified = (payload) => {
        setCandidates((prev) =>
          prev.map((c) =>
            c.studentId === payload.studentId || c.attemptId === payload.attemptId
              ? {
                  ...c,
                  status: 'DISQUALIFIED',
                  isDisqualified: true,
                  violationCount: payload.violationCount || 2,
                  disqualificationType: payload.isAutomatic ? 'AUTOMATIC' : 'MANUAL',
                  disqualifyReason: payload.reason,
                }
              : c
          )
        );
        setStats((prev) =>
          prev
            ? {
                ...prev,
                disqualifiedCount: (prev.disqualifiedCount || 0) + 1,
                inProgressCount: Math.max(0, prev.inProgressCount - 1),
              }
            : prev
        );
        setRecentActivity((prev) => [
          {
            id: `act-${Date.now()}`,
            action: 'EXAM_ATTEMPT_DISQUALIFIED',
            user: { name: payload.studentName || 'Candidate' },
            timestamp: payload.timestamp || new Date().toISOString(),
            metadata: { reason: payload.reason, isAutomatic: payload.isAutomatic },
          },
          ...prev.slice(0, 14),
        ]);
      };

      socket.on('candidate:online', handleCandidateOnline);
      socket.on('candidate:offline', handleCandidateOffline);
      socket.on('exam:started', handleExamStarted);
      socket.on('attempt:submission_received', handleSubmissionReceived);
      socket.on('attempt:expired', handleAttemptExpired);
      socket.on('candidate:violation', handleCandidateViolation);
      socket.on('candidate:disqualified', handleCandidateDisqualified);

      return () => {
        socket.emit('exam:leave', { examId });
        socket.off('candidate:online', handleCandidateOnline);
        socket.off('candidate:offline', handleCandidateOffline);
        socket.off('exam:started', handleExamStarted);
        socket.off('attempt:submission_received', handleSubmissionReceived);
        socket.off('attempt:expired', handleAttemptExpired);
        socket.off('candidate:violation', handleCandidateViolation);
        socket.off('candidate:disqualified', handleCandidateDisqualified);
      };
    }
  }, [examId]);

  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementMessage.trim()) return;

    try {
      setIsBroadcasting(true);
      await api.post(`/faculty/exams/${examId}/announcements`, {
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
      });
      setBroadcastFeedback('Announcement broadcasted successfully to all candidates!');
      setAnnouncementTitle('');
      setAnnouncementMessage('');
      setShowAnnouncementModal(false);
      setTimeout(() => setBroadcastFeedback(null), 4000);
    } catch (err) {
      alert(err.message || 'Failed to broadcast announcement');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      c.email.toLowerCase().includes(s) ||
      (c.rollNumber && c.rollNumber.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <button
            onClick={() => navigate(`/faculty/exams/${examId}/submissions`)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Submissions
          </button>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <span>Live Examination Monitor</span>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Live Telemetry
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {exam?.title} • Course: <span className="text-blue-400 font-mono">{exam?.course?.code || '—'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchMonitoringData}
            title="Refresh telemetry"
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowAnnouncementModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/30 transition flex items-center gap-2"
          >
            <Megaphone className="w-4 h-4" />
            Broadcast Announcement
          </button>
        </div>
      </div>

      {broadcastFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
          {broadcastFeedback}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-navy/90 border border-blue-500/30 shadow-md space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Users className="w-3 h-3 text-blue-400" />
            Assigned
          </span>
          <p className="text-2xl font-black text-white">{stats?.totalAssigned || 0}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-navy/90 border border-emerald-500/30 shadow-md space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Wifi className="w-3 h-3 text-emerald-400" />
            Online Now
          </span>
          <p className="text-2xl font-black text-emerald-400">{stats?.onlineCount || 0}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-navy/90 border border-cyan-500/30 shadow-md space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Radio className="w-3 h-3 text-cyan-400" />
            Started
          </span>
          <p className="text-2xl font-black text-cyan-300">{stats?.startedCount || 0}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-navy/90 border border-amber-500/30 shadow-md space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            In Progress
          </span>
          <p className="text-2xl font-black text-amber-400">{stats?.inProgressCount || 0}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-navy/90 border border-purple-500/30 shadow-md space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-purple-400" />
            Submitted
          </span>
          <p className="text-2xl font-black text-purple-400">{stats?.submittedCount || 0}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-navy/90 border border-orange-500/30 shadow-md space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-orange-400" />
            Timeouts
          </span>
          <p className="text-2xl font-black text-orange-400">{stats?.expiredCount || 0}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-navy/90 border border-rose-500/40 shadow-md space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            Disqualified
          </span>
          <p className="text-2xl font-black text-rose-400">{stats?.disqualifiedCount || 0}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="p-4 rounded-2xl bg-slate-navy/90 border border-slate-800 shadow-md space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-200">Overall Submission Completion</span>
          <span className="font-mono text-blue-400 font-bold">
            {stats?.submissionProgress || 0}%
          </span>
        </div>
        <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-blue-600 to-indigo-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${stats?.submissionProgress || 0}%` }}
          ></div>
        </div>
      </div>

      {/* Candidate Live Roster Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Candidate Examination Roster</span>
            <span className="text-xs text-slate-400 font-normal">
              ({filteredCandidates.length} students)
            </span>
          </h2>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search candidate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-navy/90 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Presence</th>
                  <th className="py-3 px-4">Exam Status</th>
                  <th className="py-3 px-4">Anti-Cheating Strikes</th>
                  <th className="py-3 px-4">Exits & Switches</th>
                  <th className="py-3 px-4">Remaining / Submitted</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Integrity Telemetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-slate-500 animate-pulse">
                      Streaming candidate roster telemetries...
                    </td>
                  </tr>
                ) : filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-slate-500">
                      No candidates found.
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((c) => (
                    <tr key={c.studentId} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-white">
                        <div>{c.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{c.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{c.rollNumber}</td>
                      <td className="py-3 px-4">
                        {c.isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <Wifi className="w-3 h-3" />
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            <WifiOff className="w-3 h-3" />
                            Offline
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {c.isDisqualified ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40"
                            title={c.disqualifyReason || 'Disqualified attempt'}
                          >
                            <ShieldAlert className="w-3 h-3 text-rose-400" />
                            <span>DISQUALIFIED ({c.disqualificationType === 'AUTOMATIC' ? 'Two-Strike Auto' : 'Manual'})</span>
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              c.status === 'IN_PROGRESS'
                                ? c.violationCount === 1
                                  ? 'bg-amber-500/25 text-amber-300 border-amber-500/40'
                                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : c.status === 'SUBMITTED' || c.status === 'EVALUATED'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : c.status === 'AUTO_SUBMITTED'
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {c.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${
                            c.isDisqualified || c.violationCount >= 2
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : c.violationCount === 1
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {c.isDisqualified || c.violationCount >= 2
                            ? '⚠️ 2/2 Strikes (Disqualified)'
                            : c.violationCount === 1
                            ? '⚠️ 1/2 Strikes (Warning)'
                            : '✓ 0/2 Clear'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                        <span>{c.fullscreenExitCount || 0} exits</span>
                        <span className="text-slate-500 mx-1">•</span>
                        <span>{c.tabSwitchCount || 0} blurs</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono">
                        {c.remainingSeconds !== null ? (
                          `${Math.floor(c.remainingSeconds / 60)}m ${c.remainingSeconds % 60}s`
                        ) : c.submittedAt ? (
                          new Date(c.submittedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {c.submissionReason || (c.isDisqualified ? 'DISQUALIFIED' : '—')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {c.attemptId ? (
                          <button
                            onClick={() =>
                              setSelectedProctoringAttempt({
                                attemptId: c.attemptId,
                                candidateName: c.name,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-semibold transition"
                            title="View candidate integrity activity logs"
                          >
                            <ShieldAlert className="w-3 h-3 text-purple-400" />
                            <span>Activity Log</span>
                          </button>
                        ) : (
                          <span className="text-slate-500 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Broadcast Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg p-6 rounded-2xl border border-slate-800 bg-slate-navy shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-400" />
                Broadcast Urgent Announcement
              </h3>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              This message will be dispatched in real-time to all currently active candidate screens
              and stored in their persistent notification tray.
            </p>

            <form onSubmit={handleBroadcastSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Announcement Title</label>
                <input
                  type="text"
                  placeholder="e.g., Question 3 Typo Clarification"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Announcement Details</label>
                <textarea
                  rows={4}
                  placeholder="Type message to candidates..."
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500 resize-none placeholder:text-slate-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBroadcasting}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition disabled:opacity-50"
                >
                  {isBroadcasting ? 'Broadcasting...' : 'Send Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Proctoring Activity Timeline Modal */}
      {selectedProctoringAttempt && (
        <ProctoringTimelineModal
          attemptId={selectedProctoringAttempt.attemptId}
          candidateName={selectedProctoringAttempt.candidateName}
          onClose={() => setSelectedProctoringAttempt(null)}
        />
      )}
    </div>
  );
}
