import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getProfile, updateProfile, getSubjects, getAttendance } from '../services/api';
import { supabase } from '../lib/supabase';

/* ════════════════════════════════════════════════════════════
   PROFILE PAGE
   ════════════════════════════════════════════════════════════ */
export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  /* ── State ──────────────────────────────────────────────── */
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const toast = useToast();
  const fileRef = useRef(null);

  // Editable fields
  const [fullName, setFullName]           = useState('');
  const [collegeName, setCollegeName]     = useState('');
  const [targetPct, setTargetPct]         = useState(75);
  const [avatarUrl, setAvatarUrl]         = useState('');

  // Theme
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // Stats
  const [stats, setStats] = useState({ subjects: 0, overallPct: 0, daysActive: 0 });

  // Password
  const [showPwSection, setShowPwSection] = useState(false);
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPw, setConfirmPw]         = useState('');
  const [pwError, setPwError]             = useState('');
  const [pwSaving, setPwSaving]           = useState(false);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText]               = useState('');
  const [deleting, setDeleting]                   = useState(false);

  // Validation
  const [errors, setErrors] = useState({});

  /* ── Load data ──────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const [profile, subjects, attendance] = await Promise.all([
          getProfile(),
          getSubjects(),
          getAttendance({}),
        ]);

        setFullName(profile.full_name || '');
        setCollegeName(profile.college_name || '');
        setTargetPct(profile.target_attendance_pct || 75);
        setAvatarUrl(profile.avatar_url || '');

        // Compute stats
        const present = attendance.filter((r) => r.status === 'present').length;
        const total   = attendance.filter((r) => r.status !== 'not_happened').length;
        const overallPct = total > 0 ? (present / total) * 100 : 0;

        const uniqueDays = new Set(attendance.map((r) => r.date));

        setStats({
          subjects: subjects.length,
          overallPct,
          daysActive: uniqueDays.size,
        });
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  /* ── Theme toggle ───────────────────────────────────────── */
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  /* ── Validation ─────────────────────────────────────────── */
  const validate = () => {
    const e = {};
    if (!fullName.trim()) e.fullName = 'Full name is required.';
    if (!collegeName.trim()) e.collegeName = 'College name is required.';
    if (!targetPct || targetPct < 1 || targetPct > 100) e.targetPct = 'Target must be 1-100.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Save profile ───────────────────────────────────────── */
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        college_name: collegeName.trim(),
        target_attendance_pct: Number(targetPct),
      });
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to save.');
    } finally { setSaving(false); }
  };

  /* ── Avatar upload ──────────────────────────────────────── */
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB.'); return; }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = data.publicUrl + '?t=' + Date.now(); // cache bust

      await updateProfile({ avatar_url: publicUrl });
      setAvatarUrl(publicUrl);
      toast.success('Avatar updated!');
    } catch (err) {
      toast.error(err.message || 'Upload failed.');
    } finally { setUploading(false); }
  };

  /* ── Change password ────────────────────────────────────── */
  const handleChangePassword = async () => {
    setPwError('');
    if (newPassword.length < 6) { setPwError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPw('');
      setShowPwSection(false);
      toast.success('Password changed successfully!');
    } catch (err) {
      setPwError(err.message || 'Failed to change password.');
    } finally { setPwSaving(false); }
  };

  /* ── Delete account ─────────────────────────────────────── */
  const handleDeleteAccount = async () => {
    if (deleteText !== 'DELETE') return;
    setDeleting(true);
    try {
      // Delete all user data first
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        await supabase.from('attendance').delete().eq('user_id', u.id);
        await supabase.from('subjects').delete().eq('user_id', u.id);
        await supabase.from('profiles').delete().eq('id', u.id);
      }
      await signOut();
      navigate('/login');
    } catch (err) {
      toast.error(err.message || 'Failed to delete account.');
      setDeleting(false);
    }
  };

  /* ── Initials for default avatar ────────────────────────── */
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  /* ════════════════════════════════════════════════════════ */
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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-gray-500 mt-1">Manage your account and preferences</p>
        </div>

        {/* ── Avatar & Name ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="relative group">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar"
                  className="h-24 w-24 rounded-full object-cover ring-4 ring-indigo-100" />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center ring-4 ring-indigo-100">
                  <span className="text-2xl font-bold text-white">{initials}</span>
                </div>
              )}
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer">
                {uploading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>

            <div className="text-center sm:text-left">
              <h2 className="text-xl font-bold text-gray-900">{fullName || 'Your Name'}</h2>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <p className="text-xs text-gray-400 mt-1">
                Member since {new Date(user?.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* ── Account Stats ── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow border border-white/60 p-5 text-center">
            <p className="text-2xl font-bold text-indigo-600">{stats.subjects}</p>
            <p className="text-xs text-gray-500 mt-1">Subjects</p>
          </div>
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow border border-white/60 p-5 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.overallPct.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">Overall Attendance</p>
          </div>
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow border border-white/60 p-5 text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.daysActive}</p>
            <p className="text-xs text-gray-500 mt-1">Days Active</p>
          </div>
        </div>

        {/* ── Personal Information ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Personal Information
          </h3>

          <div className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-indigo-500/20 ${
                  errors.fullName ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-indigo-500'
                }`} placeholder="John Doe" />
              {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
            </div>

            {/* College Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">College Name</label>
              <input type="text" value={collegeName} onChange={(e) => setCollegeName(e.target.value)}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-indigo-500/20 ${
                  errors.collegeName ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-indigo-500'
                }`} placeholder="Your College" />
              {errors.collegeName && <p className="text-xs text-red-500 mt-1">{errors.collegeName}</p>}
            </div>

            {/* Target % */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Attendance %</label>
              <div className="relative">
                <input type="number" min={1} max={100} value={targetPct}
                  onChange={(e) => setTargetPct(Number(e.target.value))}
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-indigo-500/20 pr-10 ${
                    errors.targetPct ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-indigo-500'
                  }`} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
              {errors.targetPct && <p className="text-xs text-red-500 mt-1">{errors.targetPct}</p>}
            </div>

            {/* Email (read only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={user?.email || ''} readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 outline-none cursor-not-allowed" />
            </div>

            {/* Save */}
            <button onClick={handleSave} disabled={saving}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-500 hover:to-purple-500 transition disabled:opacity-60 cursor-pointer">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* ── Preferences ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Preferences
          </h3>

          {/* Theme */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Dark Mode</p>
              <p className="text-xs text-gray-400">Switch between light and dark theme</p>
            </div>
            <button onClick={() => setDarkMode(!darkMode)}
              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer ${
                darkMode ? 'bg-indigo-600' : 'bg-gray-300'
              }`}>
              <span className={`inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow transition duration-200 ease-in-out mt-px ${
                darkMode ? 'translate-x-5.5 ml-px' : 'translate-x-0.5'
              }`}>
                <span className="flex items-center justify-center h-full">
                  {darkMode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
              </span>
            </button>
          </div>
        </div>

        {/* ── Security ── */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Security
          </h3>

          {/* Change Password */}
          <div className="border-b border-gray-100 pb-4 mb-4">
            <button onClick={() => setShowPwSection(!showPwSection)}
              className="flex items-center justify-between w-full text-left cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900">Change Password</p>
                <p className="text-xs text-gray-400">Update your account password</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 text-gray-400 transition-transform ${showPwSection ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showPwSection && (
              <div className="mt-4 space-y-3">
                {pwError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{pwError}</div>
                )}
                <input type="password" placeholder="New password (min 6 chars)" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition" />
                <input type="password" placeholder="Confirm new password" value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition" />
                <button onClick={handleChangePassword} disabled={pwSaving}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition disabled:opacity-60 cursor-pointer">
                  {pwSaving ? 'Changing…' : 'Change Password'}
                </button>
              </div>
            )}
          </div>

          {/* Delete Account */}
          <div>
            <button onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="flex items-center justify-between w-full text-left cursor-pointer">
              <div>
                <p className="text-sm font-medium text-red-600">Delete Account</p>
                <p className="text-xs text-gray-400">Permanently delete your account and all data</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 text-red-400 transition-transform ${showDeleteConfirm ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDeleteConfirm && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4">
                <div className="flex items-start gap-3 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-800">This action is irreversible!</p>
                    <p className="text-xs text-red-600 mt-1">All your subjects, attendance records, and profile data will be permanently deleted.</p>
                  </div>
                </div>
                <p className="text-xs text-red-700 mb-2">
                  Type <span className="font-bold font-mono">DELETE</span> to confirm:
                </p>
                <input type="text" value={deleteText} onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition mb-3" />
                <button onClick={handleDeleteAccount} disabled={deleteText !== 'DELETE' || deleting}
                  className="w-full py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  {deleting ? 'Deleting…' : 'Permanently Delete My Account'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
