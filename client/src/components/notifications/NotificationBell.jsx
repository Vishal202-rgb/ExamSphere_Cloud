import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
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
  ExternalLink,
} from 'lucide-react';

export default function NotificationBell() {
  const { isAuthenticated, token } = useSelector((state) => state.auth);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Fetch unread count and recent notifications
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    try {
      const res = await api.get('/notifications?limit=8');
      if (res?.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch {
      // Ignore network errors on passive polling
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();

    // Listen for real-time notifications via Socket.IO
    const socket = getSocket();
    if (socket) {
      const handleNewNotification = (notif) => {
        setNotifications((prev) => [notif, ...prev.slice(0, 7)]);
        setUnreadCount((prev) => prev + 1);
      };

      const handleCountUpdated = (data) => {
        if (typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        }
      };

      socket.on('notification:new', handleNewNotification);
      socket.on('notification:count_updated', handleCountUpdated);

      return () => {
        socket.off('notification:new', handleNewNotification);
        socket.off('notification:count_updated', handleCountUpdated);
      };
    }
  }, [isAuthenticated, token, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleMarkAsRead = async (notifId, e) => {
    e.stopPropagation();
    try {
      await api.patch(`/notifications/${notifId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
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
        return <Award className="w-4 h-4 text-emerald-400" />;
      case 'EXAM_SCHEDULED':
      case 'EXAM_ASSIGNED':
        return <Calendar className="w-4 h-4 text-blue-400" />;
      case 'EXAM_STARTING_SOON':
      case 'EXAM_REMINDER':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'ANNOUNCEMENT':
        return <Megaphone className="w-4 h-4 text-purple-400" />;
      case 'ALERT':
      case 'EXAM_CANCELLED':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatRelativeTime = (timestamp) => {
    const diffSec = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700/80 transition"
        title="View Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-[#0F172A] shadow-md shadow-rose-500/30">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-[#111827]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-semibold">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] text-slate-400 hover:text-blue-400 flex items-center gap-1 transition"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                <p className="text-xs font-medium text-slate-300">You're all caught up!</p>
                <p className="text-[10px] text-slate-500">No new alerts at this time.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.isRead) handleMarkAsRead(notif.id, { stopPropagation: () => {} });
                    if (notif.metadata?.examId) {
                      navigate(`/student/exams/${notif.metadata.examId}`);
                    }
                    setIsOpen(false);
                  }}
                  className={`p-3.5 flex gap-3 transition cursor-pointer hover:bg-slate-800/50 ${
                    !notif.isRead ? 'bg-blue-500/5' : ''
                  }`}
                >
                  <div className="shrink-0 p-2 rounded-xl bg-slate-900 border border-slate-800 h-fit">
                    {getIconForType(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4
                        className={`text-xs truncate ${
                          !notif.isRead ? 'font-bold text-white' : 'font-medium text-slate-300'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(notif.id, e)}
                      title="Mark as read"
                      className="shrink-0 self-center text-slate-500 hover:text-blue-400 p-1"
                    >
                      <span className="block w-2 h-2 rounded-full bg-blue-500"></span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-800 bg-[#111827] text-center">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition py-1 px-3 rounded-lg"
            >
              <span>View All Notifications</span>
              <ExternalLink className="w-3 h-3 text-blue-400" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
