import { useEffect, useState, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { useToast } from '../context/ToastContext';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import {
  getSubjects,
  getProfile,
  getAttendanceBySubject,
  markAttendance,
  computeSubjectStats,
} from '../services/api';
import { sendAttendanceAlert } from '../services/emailService';

/* ── Circular progress ───────────────────────────────────── */
function CircularProgress({ percentage, color, size = 100, stroke = 8 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const cls =
    color === 'red' ? 'text-red-500' : color === 'yellow' ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-gray-200" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className={`${cls} transition-all duration-700`} />
      </svg>
      <span className="absolute text-lg font-bold text-gray-900">{percentage.toFixed(1)}%</span>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function MarkAttendancePage() {
  const [subjects, setSubjects] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedSubject, setSelectedSubject] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('');
  const [isManual, setIsManual] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Stats for selected subject
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Toast & Notifications
  const toast = useToast();
  const { addNotification } = useNotifications();
  const { user } = useAuth();

  const loadBase = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([getProfile(), getSubjects()]);
      setProfile(p);
      setSubjects(s);
      if (s.length > 0 && !selectedSubject) setSelectedSubject(s[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBase(); }, [loadBase]);

  // Load stats when subject changes
  useEffect(() => {
    if (!selectedSubject || !profile) { setStats(null); return; }
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const records = await getAttendanceBySubject(selectedSubject);
        if (!cancelled) {
          setStats(computeSubjectStats(records, Number(profile.target_attendance_pct)));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSubject, profile]);

  const targetPct = profile ? Number(profile.target_attendance_pct) : 75;

  const resetForm = () => {
    setStatus('');
    setIsManual(false);
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = async () => {
    if (!selectedSubject) { toast.error('Please select a subject.'); return; }
    if (!status) { toast.error('Please select attendance status.'); return; }
    if (!date) { toast.error('Please select a date.'); return; }

    setSaving(true);
    try {
      await markAttendance({
        subjectId: selectedSubject,
        date,
        status,
        notes: notes.trim() || null,
      });

      const subName = subjects.find((s) => s.id === selectedSubject)?.name || 'Subject';
      toast.success(`${subName} marked as ${status === 'not_happened' ? 'no class' : status} on ${date}.`);
      resetForm();

      // Refresh stats
      const records = await getAttendanceBySubject(selectedSubject);
      const newStats = computeSubjectStats(records, targetPct);
      setStats(newStats);

      // Threshold notification — fire when attendance drops below target
      if (newStats.total > 0 && newStats.percentage < targetPct) {
        const pct = newStats.percentage.toFixed(1);
        const alertMsg = `Your attendance in ${subName} is ${pct}%, below the target of ${targetPct}%. You need to attend ${newStats.needToAttend} more class${newStats.needToAttend !== 1 ? 'es' : ''} to reach the target.`;

        toast.warning(`⚠️ ${subName} attendance is ${pct}%, below your ${targetPct}% target!`);
        addNotification({
          id: `low_${selectedSubject}_${new Date().toISOString().slice(0, 10)}`,
          type: 'low_attendance',
          title: `Low attendance: ${subName}`,
          message: alertMsg,
          icon: 'warning',
        });

        // Send email alert (non-blocking)
        if (user?.email) {
          sendAttendanceAlert({
            toEmail: user.email,
            subjectName: subName,
            percentage: pct,
            target: targetPct,
            needToAttend: newStats.needToAttend,
            message: alertMsg,
          }).then((sent) => {
            if (sent) toast.info('📧 Email alert sent to ' + user.email);
          });
        }
      }
    } catch (err) {
      const msg = err.message || 'Failed to save attendance.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const selectedSub = subjects.find((s) => s.id === selectedSubject);

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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mark Attendance</h1>
          <p className="text-gray-500 mt-1">Record your daily class attendance</p>
        </div>

        {subjects.length === 0 ? (
          /* No subjects */
          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow border border-white/60 p-16 text-center">
            <div className="mx-auto h-20 w-20 rounded-2xl bg-indigo-100 flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Subjects Yet</h3>
            <p className="text-gray-500 mb-6">Add subjects first, then come back to mark attendance.</p>
            <a href="/subjects" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg hover:from-indigo-500 hover:to-purple-500 transition">
              Go to Subjects
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── Left: Form ─────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Subject & Date */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Subject selector */}
                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Subject
                    </label>
                    <div className="relative">
                      <select
                        id="subject"
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-gray-300 bg-white py-2.5 pl-4 pr-10 text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition cursor-pointer"
                      >
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}{s.code ? ` (${s.code})` : ''}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </div>
                  </div>

                  {/* Date picker */}
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Date
                    </label>
                    <input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white py-2.5 px-4 text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition cursor-pointer"
                    />
                  </div>
                </div>

                {selectedSub?.teacher_name && (
                  <p className="mt-3 text-xs text-gray-400 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Teacher: {selectedSub.teacher_name}
                  </p>
                )}
              </div>

              {/* Status buttons */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Attendance Status</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'present', label: 'Present', icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ), active: 'bg-green-100 border-green-400 text-green-700 ring-2 ring-green-400/30', hover: 'hover:bg-green-50 hover:border-green-300' },
                    { value: 'absent', label: 'Absent', icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ), active: 'bg-red-100 border-red-400 text-red-700 ring-2 ring-red-400/30', hover: 'hover:bg-red-50 hover:border-red-300' },
                    { value: 'not_happened', label: 'No Class', icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    ), active: 'bg-gray-200 border-gray-400 text-gray-700 ring-2 ring-gray-400/30', hover: 'hover:bg-gray-100 hover:border-gray-300' },
                  ].map((btn) => (
                    <button
                      key={btn.value}
                      type="button"
                      onClick={() => setStatus(btn.value)}
                      className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 font-semibold transition-all cursor-pointer ${
                        status === btn.value ? btn.active : `border-gray-200 text-gray-500 ${btn.hover}`
                      }`}
                    >
                      {btn.icon}
                      <span className="text-sm">{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual entry & Notes */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isManual}
                    onChange={(e) => setIsManual(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Manual Entry</span>
                    <p className="text-xs text-gray-400">Check if another teacher took the class or you're back-filling</p>
                  </div>
                </label>

                {isManual && (
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Notes / Remarks
                    </label>
                    <textarea
                      id="notes"
                      rows={3}
                      placeholder="e.g. Substitute teacher, extra class, lab session…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 py-2.5 px-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !status}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-lg font-bold shadow-xl hover:from-indigo-500 hover:to-purple-500 focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving…
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Save Attendance
                  </>
                )}
              </button>
            </div>

            {/* ── Right: Stats sidebar ───────────────── */}
            <div className="lg:col-span-1">
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6 sticky top-24">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">
                  {selectedSub?.name || 'Subject'} Stats
                </h2>

                {statsLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  </div>
                ) : !stats || stats.total === 0 ? (
                  <div className="text-center py-8">
                    <div className="mx-auto h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-400">No records yet</p>
                    <p className="text-xs text-gray-300 mt-1">Stats appear after your first entry</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Progress ring */}
                    <div className="flex justify-center">
                      <CircularProgress percentage={stats.percentage} color={stats.status} />
                    </div>

                    {/* Stat rows */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Total Classes</span>
                        <span className="text-sm font-bold text-gray-900">{stats.total}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Attended</span>
                        <span className="text-sm font-bold text-green-600">{stats.present}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Absent</span>
                        <span className="text-sm font-bold text-red-600">{stats.absent}</span>
                      </div>

                      <hr className="border-gray-100" />

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Target</span>
                        <span className="text-sm font-bold text-indigo-600">{targetPct}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Current</span>
                        <span className={`text-sm font-bold ${
                          stats.percentage >= targetPct ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {stats.percentage.toFixed(1)}%
                        </span>
                      </div>

                      <hr className="border-gray-100" />

                      {/* Bunk / Need info */}
                      {stats.percentage >= targetPct ? (
                        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                          <p className="text-sm text-green-700 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Can bunk <span className="font-bold">{stats.canBunk}</span> class{stats.canBunk !== 1 ? 'es' : ''}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                          <p className="text-sm text-red-700 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Need <span className="font-bold">{stats.needToAttend}</span> more to reach {targetPct}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
