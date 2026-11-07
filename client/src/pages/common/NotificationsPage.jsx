import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import { getSocket } from '../../services/socket.js';
import {
  Bell,
  CheckCheck,
  Calendar,
  AlertTriangle,
  Award,
  Info,
  Clock,
  Megaphone,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchNotifications = React.useCallback(async (signal) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/notifications?page=${page}&limit=15&unreadOnly=${unreadOnly}`, { signal });
      if (signal?.aborted) return;
      if (res?.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (err) {
      if (signal?.aborted || err?.isCanceled || err?.code === 'ERR_CANCELED') return;
      console.error('Failed to load notifications:', err);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [page, unreadOnly]);

  useEffect(() => {
    const controller = new AbortController();
    fetchNotifications(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      const handleNewNotification = (notif) => {
        setNotifications((prev) => [notif, ...prev]);
        setUnreadCount((prev) => prev + 1);
      };
      socket.on('notification:new', handleNewNotification);
      return () => socket.off('notification:new', handleNewNotification);
    }
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'RESULT_PUBLISHED':
        return <Award className="w-5 h-5 text-amber-400" />;
      case 'EXAM_SCHEDULED':
      case 'EXAM_ASSIGNED':
        return <Calendar className="w-5 h-5 text-blue-400" />;
      case 'EXAM_STARTING_SOON':
      case 'EXAM_REMINDER':
        return <Clock className="w-5 h-5 text-cyan-400" />;
      case 'ANNOUNCEMENT':
        return <Megaphone className="w-5 h-5 text-purple-400" />;
      case 'ALERT':
      case 'EXAM_CANCELLED':
        return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-800/80 bg-slate-navy/90 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-md shadow-blue-500/10">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
              Notifications & Alerts
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold">
                  {unreadCount} unread
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">
              Exam assignments, schedules, published scorecards, and announcements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => {
              setUnreadOnly(!unreadOnly);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              unreadOnly
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {unreadOnly ? 'Showing Unread' : 'Filter Unread'}
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 bg-slate-navy/90 rounded-2xl border border-slate-800 animate-pulse">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-slate-navy/90 rounded-2xl border border-slate-800 space-y-3 shadow-xl">
            <CheckCircle2 className="w-12 h-12 mx-auto text-slate-600" />
            <h3 className="text-sm font-semibold text-white">No Notifications Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {unreadOnly
                ? 'You have read all your alerts.'
                : 'You do not have any notification records in your inbox yet.'}
            </p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => {
                if (!notif.isRead) handleMarkAsRead(notif.id);
                if (notif.metadata?.examId) {
                  navigate(`/student/exams/${notif.metadata.examId}`);
                }
              }}
              className={`p-4 rounded-2xl border transition flex gap-4 cursor-pointer shadow-lg ${
                !notif.isRead
                  ? 'border-blue-500/30 bg-slate-900/90 shadow-blue-500/5 hover:border-blue-500/50'
                  : 'border-slate-800/80 bg-slate-navy/90 hover:bg-slate-850'
              }`}
            >
              <div className={`shrink-0 p-3 rounded-2xl border self-start ${
                !notif.isRead ? 'bg-blue-500/10 border-blue-500/20' : 'bg-slate-950/60 border-slate-800'
              }`}>
                {getIconForType(notif.type)}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <h3
                    className={`text-sm ${
                      !notif.isRead ? 'font-bold text-white' : 'font-semibold text-slate-300'
                    }`}
                  >
                    {notif.title}
                  </h3>
                  <span className="text-[11px] text-slate-500 shrink-0 font-mono">
                    {new Date(notif.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>
              </div>

              {!notif.isRead && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAsRead(notif.id);
                  }}
                  title="Mark as read"
                  className="shrink-0 p-1.5 self-center text-blue-400 hover:text-white transition"
                >
                  <span className="block w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></span>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-xs text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
