import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Check,
  Sparkles,
  Flame,
  UserCheck,
  Briefcase,
  AlertTriangle,
  Info,
  ExternalLink
} from 'lucide-react';
import { crmService } from '../../services/crm';
import { socketService } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';

export function NotificationCenter() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const dropdownRef = useRef(null);

  // Load unread count and initial notifications
  const fetchUnreadCount = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await crmService.getUnreadCount();
      const count = res.data?.data?.count ?? res.data?.count ?? 0;
      setUnreadCount(count);
    } catch (err) {
      // Graceful fallback
    }
  };

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await crmService.getNotifications({ limit: 15 });
      const payload = res.data?.data || res.data || {};
      setNotifications(payload.notifications || []);
      setUnreadCount(payload.unreadCount ?? 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchUnreadCount();

    // Connect socket
    socketService.connect();

    // Listen to real-time notification events
    const unsubNotification = socketService.onNotification((newNotif) => {
      setNotifications((prev) => [newNotif, ...prev.slice(0, 19)]);
      setUnreadCount((prev) => prev + 1);
    });

    const unsubCount = socketService.onUnreadCount(({ count }) => {
      setUnreadCount(count);
    });

    // 45-second fallback polling interval
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 45000);

    // Refresh on window focus
    const handleFocus = () => fetchUnreadCount();
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubNotification();
      unsubCount();
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, user?.id]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await crmService.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await crmService.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleItemClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await crmService.markNotificationAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        // Continue navigation even if read toggle fails
      }
    }

    setIsOpen(false);
    if (notif.metadata?.link) {
      navigate(notif.metadata.link);
    }
  };

  const formatRelativeTime = (isoString) => {
    if (!isoString) return '';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'SCORE_THRESHOLD_REACHED':
        return <Flame className="w-4 h-4 text-amber-500" />;
      case 'RECOMMENDATION_GENERATED':
        return <Sparkles className="w-4 h-4 text-purple-500" />;
      case 'DEAL_STAGE_CHANGED':
        return <Briefcase className="w-4 h-4 text-emerald-500" />;
      case 'LEAD_ASSIGNED':
        return <UserCheck className="w-4 h-4 text-blue-500" />;
      case 'SYSTEM_ALERT':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label="View notifications"
        className={`relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
          isOpen ? 'bg-slate-100 text-slate-900' : ''
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full ring-2 ring-white animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-medium bg-rose-100 text-rose-700 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={markingAll}
                className="text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium text-slate-600">All caught up!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No notifications to display.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 relative ${
                    !notif.isRead ? 'bg-brand-50/40' : ''
                  }`}
                >
                  {/* Indicator Dot */}
                  {!notif.isRead && (
                    <span className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-brand-600" />
                  )}

                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                      {notif.message}
                    </p>
                    {notif.metadata?.link && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-brand-600 font-medium mt-1">
                        View details <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  {/* Quick Mark Read */}
                  {!notif.isRead && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkAsRead(notif.id, e)}
                      title="Mark as read"
                      className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200/60 flex-shrink-0 mt-0.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-center">
            <span className="text-[11px] text-slate-500">
              Live updates enabled via authenticated WebSocket
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;
