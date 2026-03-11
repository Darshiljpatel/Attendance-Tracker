import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getProfile, updateProfile, getSubjects, getAttendance } from '../services/api';
import { supabase } from '../lib/supabase';

/* ════════════════════════════════════════════════════════════
   ACCORDION SECTION
   ════════════════════════════════════════════════════════════ */
function Section({ icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-6 py-5 text-left cursor-pointer hover:bg-gray-50/50 transition">
        <span className="text-indigo-500">{icon}</span>
        <span className="flex-1 text-lg font-bold text-gray-900">{title}</span>
        <svg xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-6 pb-6 border-t border-gray-100 pt-5">{children}</div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   FAQ ITEM
   ════════════════════════════════════════════════════════════ */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 text-left text-sm font-medium text-gray-800 cursor-pointer">
        <span>{q}</span>
        <svg xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-gray-400 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <p className="text-sm text-gray-500 pb-3 leading-relaxed">{a}</p>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SETTINGS PAGE
   ════════════════════════════════════════════════════════════ */
export default function Settings() {
  const { user, signOut } = useAuth();

  /* ── State ──────────────────────────────────────────────── */
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const toast = useToast();

  // Preferences
  const [targetPct, setTargetPct] = useState(75);
  const [emailReminders, setEmailReminders] = useState(() => localStorage.getItem('emailReminders') === 'true');
  const [lowThreshold, setLowThreshold] = useState(() => Number(localStorage.getItem('lowThreshold')) || 5);

  // Clear data
  const [showClearConfirm, setShowClearConfirm]   = useState(false);
  const [clearText, setClearText]                   = useState('');
  const [clearing, setClearing]                     = useState(false);

  // Contact
  const [contactMsg, setContactMsg] = useState('');
  const [contactSent, setContactSent] = useState(false);

  /* ── Load profile ───────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const profile = await getProfile();
        setTargetPct(profile.target_attendance_pct || 75);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  /* ── Save default target ────────────────────────────────── */
  const handleSaveTarget = async () => {
    if (targetPct < 1 || targetPct > 100) { toast.error('Target must be 1-100.'); return; }
    setSaving(true);
    try {
      await updateProfile({ target_attendance_pct: Number(targetPct) });
      toast.success('Default target updated!');
    } catch (err) { toast.error(err.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  /* ── Save notification prefs (localStorage) ─────────────── */
  const handleSaveNotifs = () => {
    localStorage.setItem('emailReminders', String(emailReminders));
    localStorage.setItem('lowThreshold', String(lowThreshold));
    toast.success('Notification preferences saved!');
  };

  /* ── Export all data as JSON ─────────────────────────────── */
  const handleExportAll = async () => {
    try {
      const [profile, subjects, attendance] = await Promise.all([
        getProfile(),
        getSubjects(),
        getAttendance({}),
      ]);
      const payload = { exportedAt: new Date().toISOString(), profile, subjects, attendance };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully!');
    } catch (err) { toast.error(err.message || 'Export failed.'); }
  };

  /* ── Export CSV ──────────────────────────────────────────── */
  const handleExportCSV = async () => {
    try {
      const attendance = await getAttendance({});
      if (attendance.length === 0) { toast.error('No attendance data to export.'); return; }
      const headers = ['Date', 'Subject', 'Code', 'Status', 'Manual', 'Notes'];
      const rows = attendance.map((r) => [
        r.date,
        r.subjects?.name || '',
        r.subjects?.code || '',
        r.status,
        r.is_manual ? 'Yes' : 'No',
        (r.notes || '').replace(/"/g, '""'),
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported!');
    } catch (err) { toast.error(err.message || 'Export failed.'); }
  };

  /* ── Clear all data ─────────────────────────────────────── */
  const handleClearData = async () => {
    if (clearText !== 'CLEAR') return;
    setClearing(true);
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        await supabase.from('attendance').delete().eq('user_id', u.id);
        await supabase.from('subjects').delete().eq('user_id', u.id);
      }
      setShowClearConfirm(false);
      setClearText('');
      toast.success('All attendance data cleared!');
    } catch (err) { toast.error(err.message || 'Failed to clear data.'); }
    finally { setClearing(false); }
  };

  /* ── Contact ────────────────────────────────────────────── */
  const handleContact = () => {
    if (!contactMsg.trim()) return;
    const subject = encodeURIComponent('Attendance Tracker - Support');
    const body = encodeURIComponent(contactMsg.trim());
    window.open(`mailto:darshiljpatel94@gmail.com?subject=${subject}&body=${body}`, '_blank');
    setContactSent(true);
    setContactMsg('');
    setTimeout(() => setContactSent(false), 5000);
  };

  /* ── FAQ data ───────────────────────────────────────────── */
  const faqs = [
    { q: 'How is attendance percentage calculated?', a: 'Attendance % = (Classes Attended ÷ Total Classes) × 100. Classes marked as "No Class" are excluded from the total.' },
    { q: 'What does "Can Bunk" mean?', a: 'It shows how many consecutive classes you can miss while keeping your attendance at or above your target percentage.' },
    { q: 'How is "Need to Attend" calculated?', a: 'It calculates the minimum number of consecutive classes you must attend to bring your attendance back up to the target percentage.' },
    { q: 'Can I edit or delete past attendance records?', a: 'Yes! Go to the History page, switch to List view, hover over any record and use the edit or delete buttons.' },
    { q: 'Is my data stored securely?', a: 'Yes. All data is stored in Supabase with Row Level Security (RLS) enabled, so only you can access your own data.' },
    { q: 'Can I use this app on my phone?', a: 'Yes, the app is fully responsive and works on all screen sizes.' },
    { q: 'How do I reset my password?', a: 'Go to the Login page and click "Forgot Password?" to receive a password reset email. You can also change it from the Profile page.' },
    { q: 'What happens if I clear all data?', a: 'Clearing data permanently deletes all your subjects and attendance records. Your account and profile information will remain intact.' },
  ];

  /* ═══════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Configure your app preferences</p>
        </div>

        {/* ── Default Target ── */}
        <Section defaultOpen={true} title="Default Target Attendance" icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }>
          <p className="text-sm text-gray-500 mb-4">Set the minimum attendance percentage you want to maintain across all subjects.</p>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-gray-500 mb-1">Target Percentage</label>
              <div className="relative">
                <input type="number" min={1} max={100} value={targetPct}
                  onChange={(e) => setTargetPct(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition pr-10" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
            <button onClick={handleSaveTarget} disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition disabled:opacity-60 cursor-pointer">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {/* Visual indicator */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>0%</span><span>{targetPct}%</span><span>100%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500 transition-all"
                style={{ width: `${targetPct}%` }} />
            </div>
          </div>
        </Section>

        {/* ── Notification Preferences ── */}
        <Section title="Notification Preferences" icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        }>
          <div className="space-y-4">
            {/* Email reminders toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Email Reminders</p>
                <p className="text-xs text-gray-400">Get notified when attendance drops below threshold</p>
              </div>
              <button onClick={() => setEmailReminders(!emailReminders)}
                className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${
                  emailReminders ? 'bg-indigo-600' : 'bg-gray-300'
                }`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition mt-0.5 ${
                  emailReminders ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Low threshold */}
            {emailReminders && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Alert when attendance is within <span className="font-bold text-gray-700">{lowThreshold}%</span> of target
                </label>
                <input type="range" min={1} max={20} value={lowThreshold}
                  onChange={(e) => setLowThreshold(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1%</span><span>20%</span>
                </div>
              </div>
            )}

            <button onClick={handleSaveNotifs}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition cursor-pointer">
              Save Preferences
            </button>

            <p className="text-xs text-gray-400 italic">
              Email alerts are sent via EmailJS when attendance drops below your target. Enable the toggle above and configure your EmailJS credentials in the .env file.
            </p>
          </div>
        </Section>

        {/* ── Data Management ── */}
        <Section title="Data Management" icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        }>
          <div className="space-y-4">
            {/* Export buttons */}
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Export Data</p>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleExportAll}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export JSON (Full Backup)
                </button>
                <button onClick={handleExportCSV}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV (Attendance)
                </button>
              </div>
            </div>

            {/* Clear data */}
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm font-medium text-red-600 mb-1">Clear All Data</p>
              <p className="text-xs text-gray-400 mb-3">Permanently delete all your subjects and attendance records. Your account will remain.</p>

              {!showClearConfirm ? (
                <button onClick={() => setShowClearConfirm(true)}
                  className="px-5 py-2.5 rounded-xl border border-red-300 text-sm font-medium text-red-600 hover:bg-red-50 transition cursor-pointer">
                  Clear All Data
                </button>
              ) : (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-red-700">This will permanently delete all subjects and attendance records. This cannot be undone.</p>
                  </div>
                  <p className="text-xs text-red-700 mb-2">Type <span className="font-bold font-mono">CLEAR</span> to confirm:</p>
                  <input type="text" value={clearText} onChange={(e) => setClearText(e.target.value)}
                    placeholder="Type CLEAR"
                    className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition mb-3" />
                  <div className="flex gap-3">
                    <button onClick={() => { setShowClearConfirm(false); setClearText(''); }}
                      className="flex-1 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition cursor-pointer">Cancel</button>
                    <button onClick={handleClearData} disabled={clearText !== 'CLEAR' || clearing}
                      className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                      {clearing ? 'Clearing…' : 'Clear Everything'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ── Help / FAQ ── */}
        <Section title="Help & FAQ" icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }>
          <div className="space-y-1">
            {faqs.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
          </div>
        </Section>

        {/* ── Contact Support ── */}
        <Section title="Contact Support" icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        }>
          {contactSent ? (
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-green-700">Message sent! We'll get back to you soon.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Have a question, bug report, or feature request? Drop us a message at <a href="mailto:darshiljpatel94@gmail.com" className="text-indigo-600 hover:underline">darshiljpatel94@gmail.com</a>.</p>
              <textarea value={contactMsg} onChange={(e) => setContactMsg(e.target.value)}
                rows={4} placeholder="Describe your issue or feedback…"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition resize-none" />
              <button onClick={handleContact} disabled={!contactMsg.trim()}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                Send Message
              </button>
            </div>
          )}
        </Section>

        {/* ── About ── */}
        <Section title="About" icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <span className="text-xl font-bold text-white">AT</span>
              </div>
              <div>
                <h4 className="font-bold text-gray-900">Attendance Tracker</h4>
                <p className="text-sm text-gray-500">Version 1.0.0</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              A smart attendance tracking app built for college students. Track your attendance across subjects,
              plan bunks strategically, and stay above your target percentage — all in one place.
            </p>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Built with</p>
                <p className="font-medium text-gray-700">React + Tailwind CSS</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Backend</p>
                <p className="font-medium text-gray-700">Supabase</p>
              </div>
            </div>

            {/* Legal links */}
            <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-4">
              <a href="#terms" className="text-sm text-indigo-600 hover:text-indigo-500 font-medium transition">
                Terms of Service
              </a>
              <a href="#privacy" className="text-sm text-indigo-600 hover:text-indigo-500 font-medium transition">
                Privacy Policy
              </a>
              <a href="#licenses" className="text-sm text-indigo-600 hover:text-indigo-500 font-medium transition">
                Open Source Licenses
              </a>
            </div>

            <p className="text-xs text-gray-400 text-center pt-2">
              &copy; {new Date().getFullYear()} Attendance Tracker. All rights reserved.
            </p>
          </div>
        </Section>
      </main>
    </div>
  );
}
