import { useEffect, useState, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import {
  getProfile,
  getSubjects,
  getAttendance,
  getAttendanceBySubject,
  markAttendance,
  computeSubjectStats,
} from '../services/api';

/* ── Circular progress ring ──────────────────────────────── */
function CircularProgress({ percentage, size = 88, stroke = 7, color }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const colorClass =
    color === 'red'
      ? 'text-red-500'
      : color === 'yellow'
      ? 'text-yellow-500'
      : 'text-green-500';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${colorClass} transition-all duration-700`}
        />
      </svg>
      <span className="absolute text-sm font-bold text-gray-900">
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
}

/* ── Mark-today modal ────────────────────────────────────── */
function MarkTodayModal({ subject, onClose, onSaved }) {
  const [status, setStatus] = useState('present');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await markAttendance({ subjectId: subject.id, status, notes: notes.trim() || null });
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Mark Today</h3>
        <p className="text-sm text-gray-500 mb-5">
          {subject.name} {subject.code ? `(${subject.code})` : ''}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {['present', 'absent', 'not_happened'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition cursor-pointer ${
                status === s
                  ? s === 'present'
                    ? 'bg-green-100 border-green-400 text-green-700'
                    : s === 'absent'
                    ? 'bg-red-100 border-red-400 text-red-700'
                    : 'bg-gray-100 border-gray-400 text-gray-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {s === 'not_happened' ? 'No Class' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition mb-5 resize-none"
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-500 hover:to-purple-500 transition disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Subject card ────────────────────────────────────────── */
function SubjectCard({ subject, stats, targetPct, onMarkToday }) {
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-5 flex flex-col hover:shadow-xl transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-gray-900 truncate">{subject.name}</h3>
          {subject.code && (
            <span className="text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
              {subject.code}
            </span>
          )}
          {subject.teacher_name && (
            <p className="text-xs text-gray-400 mt-1 truncate">{subject.teacher_name}</p>
          )}
        </div>
        <CircularProgress
          percentage={stats.percentage}
          color={stats.status}
          size={80}
          stroke={6}
        />
      </div>

      {/* Attended / Total */}
      <div className="flex items-center gap-3 text-sm mb-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-gray-600">
            <span className="font-semibold text-gray-900">{stats.present}</span> attended
          </span>
        </div>
        <span className="text-gray-300">|</span>
        <span className="text-gray-600">
          <span className="font-semibold text-gray-900">{stats.total}</span> total
        </span>
      </div>

      {/* Bunk / Need info */}
      <div className="space-y-1.5 mb-4 flex-1">
        {stats.total > 0 && stats.status !== 'red' && stats.status !== 'yellow' && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span className="text-gray-600">
              Can bunk <span className="font-bold text-green-700">{stats.canBunk}</span> more class{stats.canBunk !== 1 ? 'es' : ''}
            </span>
          </div>
        )}
        {stats.total > 0 && (stats.status === 'red' || stats.status === 'yellow') && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </span>
            <span className="text-gray-600">
              Attend <span className="font-bold text-red-600">{stats.needToAttend}</span> more to reach {targetPct}%
            </span>
          </div>
        )}
        {stats.total === 0 && (
          <p className="text-xs text-gray-400 italic">No classes recorded yet</p>
        )}
      </div>

      {/* Mark Today */}
      <button
        type="button"
        onClick={() => onMarkToday(subject)}
        className="w-full py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:from-indigo-500 hover:to-purple-500 transition cursor-pointer shadow"
      >
        Mark Today
      </button>
    </div>
  );
}

/* ── Activity item ───────────────────────────────────────── */
function ActivityItem({ record }) {
  const statusConfig = {
    present: { label: 'Present', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
    absent: { label: 'Absent', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
    not_happened: { label: 'No Class', dot: 'bg-gray-400', bg: 'bg-gray-50', text: 'text-gray-600' },
  };
  const cfg = statusConfig[record.status] || statusConfig.present;
  const subjectName = record.subjects?.name || 'Unknown';
  const subjectCode = record.subjects?.code;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot} shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 truncate">
          <span className="font-medium">{subjectName}</span>
          {subjectCode && <span className="text-gray-400 ml-1">({subjectCode})</span>}
        </p>
        {record.notes && (
          <p className="text-xs text-gray-400 truncate">{record.notes}</p>
        )}
      </div>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
      <span className="text-xs text-gray-400 whitespace-nowrap">{record.date}</span>
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [subjectStats, setSubjectStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markSubject, setMarkSubject] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [profileData, subjectsData, activityData] = await Promise.all([
        getProfile(),
        getSubjects(),
        getAttendance({ limit: 10 }),
      ]);

      setProfile(profileData);
      setSubjects(subjectsData);
      setRecentActivity(activityData);

      // Fetch attendance per subject & compute stats
      const statsMap = {};
      await Promise.all(
        subjectsData.map(async (sub) => {
          const records = await getAttendanceBySubject(sub.id);
          statsMap[sub.id] = computeSubjectStats(
            records,
            Number(profileData.target_attendance_pct)
          );
        })
      );
      setSubjectStats(statsMap);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkSaved = () => {
    setMarkSubject(null);
    loadData();
  };

  const targetPct = profile ? Number(profile.target_attendance_pct) : 75;
  const aboveTarget = subjects.filter(
    (s) => subjectStats[s.id] && subjectStats[s.id].percentage >= targetPct && subjectStats[s.id].total > 0
  ).length;
  const belowTarget = subjects.filter(
    (s) => subjectStats[s.id] && subjectStats[s.id].percentage < targetPct && subjectStats[s.id].total > 0
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {profile?.full_name || user?.email?.split('@')[0] || 'Student'} 👋
          </h1>
          <p className="text-gray-500 mt-1">
            {profile?.college_name
              ? `${profile.college_name} · Target: ${targetPct}%`
              : `Target attendance: ${targetPct}%`}
          </p>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow border border-white/60 p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-indigo-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Subjects</p>
              <p className="text-2xl font-bold text-gray-900">{subjects.length}</p>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow border border-white/60 p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-green-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Above Target</p>
              <p className="text-2xl font-bold text-green-600">{aboveTarget}</p>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow border border-white/60 p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-red-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Below Target</p>
              <p className="text-2xl font-bold text-red-600">{belowTarget}</p>
            </div>
          </div>
        </div>

        {/* Subject cards */}
        {subjects.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow border border-white/60 p-12 text-center mb-8">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No Subjects Yet</h3>
            <p className="text-gray-500 text-sm">Add your first subject to start tracking attendance.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {subjects.map((sub) => (
              <SubjectCard
                key={sub.id}
                subject={sub}
                stats={subjectStats[sub.id] || { total: 0, present: 0, absent: 0, percentage: 0, canBunk: 0, needToAttend: 0, status: 'green' }}
                targetPct={targetPct}
                onMarkToday={setMarkSubject}
              />
            ))}
          </div>
        )}

        {/* Recent activity */}
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow border border-white/60 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recent Activity
          </h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-4 text-center">No attendance records yet.</p>
          ) : (
            <div>
              {recentActivity.map((record) => (
                <ActivityItem key={record.id} record={record} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Mark today modal */}
      {markSubject && (
        <MarkTodayModal
          subject={markSubject}
          onClose={() => setMarkSubject(null)}
          onSaved={handleMarkSaved}
        />
      )}
    </div>
  );
}
