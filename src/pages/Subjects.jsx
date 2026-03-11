import { useEffect, useState, useCallback, useMemo } from 'react';
import Navbar from '../components/Navbar';
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getAttendanceBySubject,
  getProfile,
  computeSubjectStats,
} from '../services/api';

/* ── Confirmation dialog ─────────────────────────────────── */
function ConfirmDialog({ title, message, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 transition disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add / Edit modal ────────────────────────────────────── */
function SubjectModal({ subject, existingCodes, onClose, onSaved }) {
  const isEdit = !!subject;
  const [form, setForm] = useState({
    name: subject?.name || '',
    code: subject?.code || '',
    teacher_name: subject?.teacher_name || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const validate = () => {
    if (!form.name.trim()) return 'Subject name is required.';
    if (
      form.code.trim() &&
      existingCodes.includes(form.code.trim().toLowerCase()) &&
      (!isEdit || form.code.trim().toLowerCase() !== subject.code?.toLowerCase())
    ) {
      return 'A subject with this code already exists.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const v = validate();
    if (v) { setError(v); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        teacher_name: form.teacher_name.trim() || null,
      };
      if (isEdit) {
        await updateSubject(subject.id, payload);
      } else {
        await createSubject(payload);
      }
      onSaved();
    } catch (err) {
      if (err.message?.includes('duplicate') || err.code === '23505') {
        setError('A subject with this code already exists.');
      } else {
        setError(err.message || 'Failed to save.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-5">
          {isEdit ? 'Edit Subject' : 'Add New Subject'}
        </h3>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 mt-0.5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Name */}
          <div>
            <label htmlFor="subName" className="block text-sm font-medium text-gray-700 mb-1.5">
              Subject Name <span className="text-red-400">*</span>
            </label>
            <input
              id="subName"
              type="text"
              placeholder="e.g. Data Structures"
              value={form.name}
              onChange={set('name')}
              className="w-full rounded-xl border border-gray-300 py-2.5 px-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
            />
          </div>

          {/* Code */}
          <div>
            <label htmlFor="subCode" className="block text-sm font-medium text-gray-700 mb-1.5">
              Subject Code
            </label>
            <input
              id="subCode"
              type="text"
              placeholder="e.g. CS201"
              value={form.code}
              onChange={set('code')}
              className="w-full rounded-xl border border-gray-300 py-2.5 px-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
            />
          </div>

          {/* Teacher */}
          <div>
            <label htmlFor="subTeacher" className="block text-sm font-medium text-gray-700 mb-1.5">
              Teacher Name
            </label>
            <input
              id="subTeacher"
              type="text"
              placeholder="e.g. Dr. Smith"
              value={form.teacher_name}
              onChange={set('teacher_name')}
              className="w-full rounded-xl border border-gray-300 py-2.5 px-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-500 hover:to-purple-500 transition disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Add Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Mini circular progress ──────────────────────────────── */
function MiniCircle({ percentage, color, size = 52, stroke = 5 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const colorClass =
    color === 'red' ? 'text-red-500' : color === 'yellow' ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-gray-200" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className={`${colorClass} transition-all duration-700`} />
      </svg>
      <span className="absolute text-xs font-bold text-gray-800">{percentage.toFixed(0)}%</span>
    </div>
  );
}

/* ── Subject card ────────────────────────────────────────── */
function SubjectCard({ subject, stats, onEdit, onDelete }) {
  return (
    <div className="group bg-white/80 backdrop-blur-md rounded-2xl shadow border border-white/60 p-5 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-gray-900 truncate text-lg">{subject.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {subject.code && (
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {subject.code}
              </span>
            )}
            {subject.teacher_name && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {subject.teacher_name}
              </span>
            )}
          </div>
        </div>
        <MiniCircle percentage={stats.percentage} color={stats.status} />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span><span className="font-semibold text-gray-700">{stats.present}</span> present</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span><span className="font-semibold text-gray-700">{stats.absent}</span> absent</span>
        </div>
        <span className="text-gray-300">|</span>
        <span><span className="font-semibold text-gray-700">{stats.total}</span> total</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onEdit(subject)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(subject)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}

/* ── Subjects page ───────────────────────────────────────── */
export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [statsMap, setStatsMap] = useState({});
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editSubject, setEditSubject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [profileData, subjectsData] = await Promise.all([
        getProfile(),
        getSubjects(),
      ]);
      setProfile(profileData);
      setSubjects(subjectsData);

      const map = {};
      await Promise.all(
        subjectsData.map(async (sub) => {
          const records = await getAttendanceBySubject(sub.id);
          map[sub.id] = computeSubjectStats(records, Number(profileData.target_attendance_pct));
        })
      );
      setStatsMap(map);
    } catch (err) {
      console.error('Subjects load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaved = () => {
    setShowModal(false);
    setEditSubject(null);
    loadData();
  };

  const handleEdit = (sub) => {
    setEditSubject(sub);
    setShowModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSubject(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const existingCodes = useMemo(
    () => subjects.map((s) => s.code?.toLowerCase()).filter(Boolean),
    [subjects]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return subjects;
    const q = search.toLowerCase();
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code?.toLowerCase().includes(q) ||
        s.teacher_name?.toLowerCase().includes(q)
    );
  }, [subjects, search]);

  const targetPct = profile ? Number(profile.target_attendance_pct) : 75;
  const defaultStats = { total: 0, present: 0, absent: 0, percentage: 0, canBunk: 0, needToAttend: 0, status: 'green' };

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Subjects</h1>
            <p className="text-gray-500 mt-1">
              {subjects.length} subject{subjects.length !== 1 ? 's' : ''} · Target: {targetPct}%
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setEditSubject(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg hover:from-indigo-500 hover:to-purple-500 transition cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Subject
          </button>
        </div>

        {/* Search */}
        {subjects.length > 0 && (
          <div className="mb-6">
            <div className="relative max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search by name, code, or teacher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white/70 backdrop-blur py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {subjects.length === 0 && (
          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow border border-white/60 p-16 text-center">
            <div className="mx-auto h-20 w-20 rounded-2xl bg-indigo-100 flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Subjects Yet</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Add your subjects to start tracking attendance. You can add the subject name, code, and teacher.
            </p>
            <button
              type="button"
              onClick={() => { setEditSubject(null); setShowModal(true); }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg hover:from-indigo-500 hover:to-purple-500 transition cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Your First Subject
            </button>
          </div>
        )}

        {/* No search results */}
        {subjects.length > 0 && filtered.length === 0 && (
          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow border border-white/60 p-12 text-center">
            <p className="text-gray-500">No subjects match "<span className="font-medium text-gray-700">{search}</span>"</p>
          </div>
        )}

        {/* Subject cards grid */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((sub) => (
              <SubjectCard
                key={sub.id}
                subject={sub}
                stats={statsMap[sub.id] || defaultStats}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add / Edit modal */}
      {showModal && (
        <SubjectModal
          subject={editSubject}
          existingCodes={existingCodes}
          onClose={() => { setShowModal(false); setEditSubject(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Subject"
          message={`"${deleteTarget.name}" and all its attendance records will be permanently deleted.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
