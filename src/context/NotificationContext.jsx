import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getSubjects, getAttendance, computeSubjectStats } from '../services/api';
import { sendAttendanceAlert } from '../services/emailService';

/* ════════════════════════════════════════════════════════════
   NOTIFICATION CONTEXT — persistent notification centre
   ════════════════════════════════════════════════════════════ */
const NotificationContext = createContext(null);

const STORAGE_KEY = 'att_notifications';

const TYPES = {
  LOW_ATTENDANCE: 'low_attendance',
  UNMARKED_DAY:   'unmarked_day',
  WEEKLY_SUMMARY: 'weekly_summary',
  GENERAL:        'general',
};

// ---- helpers ----
const today = () => new Date().toISOString().slice(0, 10);
const weekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
};

function load(userId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function save(userId, list) {
  localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(list));
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const generated = useRef(false);

  // load persisted on user change
  useEffect(() => {
    if (user) {
      setNotifications(load(user.id));
      generated.current = false;
    } else {
      setNotifications([]);
      generated.current = false;
    }
  }, [user]);

  // persist whenever notifications change
  useEffect(() => {
    if (user) save(user.id, notifications);
  }, [notifications, user]);

  /* ---- refresh: allow re-generating notifications on demand ---- */
  const refresh = useCallback(() => {
    generated.current = false;
  }, []);

  /* ---- auto-generate notifications on login ---- */
  useEffect(() => {
    if (!user || generated.current) return;
    generated.current = true;

    (async () => {
      try {
        const subjects = await getSubjects();
        if (!subjects?.length) return;

        const adds = [];
        const todayStr = today();
        const weekStartStr = weekStart();

        // Get default target
        let defaultTarget = 75;
        try {
          const stored = localStorage.getItem('att_default_target');
          if (stored) defaultTarget = Number(stored);
        } catch {}

        // Compute per-subject stats
        for (const subj of subjects) {
          const stats = await computeSubjectStats(subj.id);
          const pct   = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : null;
          const target = subj.target_percentage || defaultTarget;

          // LOW ATTENDANCE alert
          if (pct !== null && pct < target) {
            const key = `low_${subj.id}_${todayStr}`;
            const alertMsg = `Your attendance in ${subj.name} is ${pct}%, below the target of ${target}%.`;
            adds.push({
              id: key,
              type: TYPES.LOW_ATTENDANCE,
              title: `Low attendance: ${subj.name}`,
              message: alertMsg,
              icon: 'warning',
              createdAt: new Date().toISOString(),
              read: false,
            });

            // Send email alert on login (non-blocking)
            if (user.email) {
              sendAttendanceAlert({
                toEmail: user.email,
                subjectName: subj.name,
                percentage: String(pct),
                target,
                needToAttend: stats.needToAttend || 0,
                message: alertMsg,
              }).catch(() => {});
            }
          }
        }

        // UNMARKED DAY reminder — check if any subject has no record for today
        const todayRecords = await getAttendance({ from: todayStr, to: todayStr });
        const markedSubjectIds = new Set((todayRecords || []).map((r) => r.subject_id));
        const unmarked = subjects.filter((s) => !markedSubjectIds.has(s.id));
        if (unmarked.length > 0) {
          const names = unmarked.map((s) => s.name).join(', ');
          adds.push({
            id: `unmarked_${todayStr}`,
            type: TYPES.UNMARKED_DAY,
            title: 'Unmarked attendance today',
            message: `You haven't marked attendance for: ${names}.`,
            icon: 'reminder',
            createdAt: new Date().toISOString(),
            read: false,
          });
        }

        // WEEKLY SUMMARY — one per week
        const totalRecords = await getAttendance({ from: weekStartStr, to: todayStr });
        if (totalRecords?.length) {
          const present = totalRecords.filter((r) => r.status === 'present').length;
          const pct = Math.round((present / totalRecords.length) * 100);
          adds.push({
            id: `weekly_${weekStartStr}`,
            type: TYPES.WEEKLY_SUMMARY,
            title: 'Weekly summary',
            message: `This week: ${present}/${totalRecords.length} classes attended (${pct}%).`,
            icon: 'summary',
            createdAt: new Date().toISOString(),
            read: false,
          });
        }

        if (!adds.length) return;

        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const fresh = adds.filter((a) => !existingIds.has(a.id));
          return fresh.length ? [...fresh, ...prev] : prev;
        });
      } catch (err) {
        console.error('Notification generation error:', err);
      }
    })();
  }, [user]);

  /* ---- actions ---- */
  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [{
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      read: false,
      type: TYPES.GENERAL,
      icon: 'info',
      ...notification,
    }, ...prev]);
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, addNotification,
      markAsRead, markAllAsRead, removeNotification, clearAll, refresh,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
