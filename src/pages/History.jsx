import { useEffect, useState, useCallback, useMemo } from 'react';
import Navbar from '../components/Navbar';
import {
  getSubjects,
  getAttendance,
  getAttendancePaginated,
  updateAttendanceRecord,
  deleteAttendance,
} from '../services/api';

/* ════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════ */
const STATUS_CFG = {
  present:      { label: 'Present',  dot: 'bg-green-500', bg: 'bg-green-50',  text: 'text-green-700', border: 'border-green-200' },
  absent:       { label: 'Absent',   dot: 'bg-red-500',   bg: 'bg-red-50',    text: 'text-red-700',   border: 'border-red-200' },
  not_happened: { label: 'No Class', dot: 'bg-gray-400',  bg: 'bg-gray-50',   text: 'text-gray-600',  border: 'border-gray-200' },
};

function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const startDay = first.getDay(); // 0=Sun
  const days = last.getDate();
  return { startDay, days, year, month };
}

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

/* ════════════════════════════════════════════════════════════
   EDIT MODAL
   ════════════════════════════════════════════════════════════ */
function EditModal({ record, onClose, onSaved }) {
  const [status, setStatus] = useState(record.status);
  const [notes, setNotes] = useState(record.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateAttendanceRecord(record.id, { status, notes: notes.trim() || null });
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to update.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Edit Record</h3>
        <p className="text-sm text-gray-500 mb-5">
          {record.subjects?.name} — {record.date}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-2 mb-4">
          {['present', 'absent', 'not_happened'].map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition cursor-pointer ${
                status === s
                  ? s === 'present' ? 'bg-green-100 border-green-400 text-green-700'
                    : s === 'absent' ? 'bg-red-100 border-red-400 text-red-700'
                    : 'bg-gray-100 border-gray-400 text-gray-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              {s === 'not_happened' ? 'No Class' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition mb-5 resize-none" />

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition cursor-pointer">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-500 hover:to-purple-500 transition disabled:opacity-60 cursor-pointer">
            {saving ? 'Saving…' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DELETE CONFIRM
   ════════════════════════════════════════════════════════════ */
function DeleteConfirm({ record, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const handleDelete = async () => {
    setLoading(true);
    try { await deleteAttendance(record.id); onDeleted(); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

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
            <h3 className="font-bold text-gray-900">Delete Record</h3>
            <p className="text-sm text-gray-500">
              {record.subjects?.name} — {record.date} ({STATUS_CFG[record.status]?.label})
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition cursor-pointer">Cancel</button>
          <button type="button" onClick={handleDelete} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 transition disabled:opacity-60 cursor-pointer">
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CALENDAR VIEW
   ════════════════════════════════════════════════════════════ */
function CalendarView({ records, calYear, calMonth, setCalYear, setCalMonth }) {
  const grid = monthGrid(calYear, calMonth);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Build lookup:  dateStr -> { statuses: [...] }
  const dateMap = useMemo(() => {
    const m = {};
    records.forEach((r) => {
      if (!m[r.date]) m[r.date] = [];
      m[r.date].push(r.status);
    });
    return m;
  }, [records]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  // Monthly summary
  const monthRecords = records.filter((r) => {
    const d = new Date(r.date);
    return d.getFullYear() === calYear && d.getMonth() === calMonth;
  });
  const mPresent = monthRecords.filter((r) => r.status === 'present').length;
  const mAbsent  = monthRecords.filter((r) => r.status === 'absent').length;
  const mNoClass = monthRecords.filter((r) => r.status === 'not_happened').length;
  const mTotal   = mPresent + mAbsent;
  const mPct     = mTotal > 0 ? ((mPresent / mTotal) * 100).toFixed(1) : '—';

  const cells = [];
  for (let i = 0; i < grid.startDay; i++) cells.push(null);
  for (let d = 1; d <= grid.days; d++) cells.push(d);

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h3 className="text-lg font-bold text-gray-900">{MONTHS[calMonth]} {calYear}</h3>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-400 mb-2">
        {DAYS.map((d) => <div key={d}>{d}</div>)}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const ds = fmtDate(calYear, calMonth, day);
          const statuses = dateMap[ds] || [];
          const isToday = ds === new Date().toISOString().split('T')[0];

          let bgClass = '';
          if (statuses.length > 0) {
            const hasPresent = statuses.includes('present');
            const hasAbsent  = statuses.includes('absent');
            const hasNoClass = statuses.includes('not_happened');
            if (hasPresent && !hasAbsent) bgClass = 'bg-green-200 text-green-900';
            else if (hasAbsent && !hasPresent) bgClass = 'bg-red-200 text-red-900';
            else if (hasPresent && hasAbsent) bgClass = 'bg-yellow-200 text-yellow-900';
            else if (hasNoClass) bgClass = 'bg-gray-200 text-gray-700';
          }

          return (
            <div key={ds}
              className={`relative h-10 flex items-center justify-center rounded-lg text-sm font-medium transition
                ${bgClass || 'text-gray-700'}
                ${isToday ? 'ring-2 ring-indigo-500' : ''}
              `}
              title={statuses.length ? statuses.join(', ') : undefined}
            >
              {day}
              {statuses.length > 1 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-indigo-500 text-[9px] text-white flex items-center justify-center font-bold">{statuses.length}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Monthly summary */}
      <div className="mt-6 grid grid-cols-4 gap-3 text-center">
        <div className="bg-green-50 rounded-xl py-3">
          <p className="text-lg font-bold text-green-700">{mPresent}</p>
          <p className="text-xs text-green-600">Present</p>
        </div>
        <div className="bg-red-50 rounded-xl py-3">
          <p className="text-lg font-bold text-red-700">{mAbsent}</p>
          <p className="text-xs text-red-600">Absent</p>
        </div>
        <div className="bg-gray-50 rounded-xl py-3">
          <p className="text-lg font-bold text-gray-700">{mNoClass}</p>
          <p className="text-xs text-gray-500">No Class</p>
        </div>
        <div className="bg-indigo-50 rounded-xl py-3">
          <p className="text-lg font-bold text-indigo-700">{mPct}{mPct !== '—' ? '%' : ''}</p>
          <p className="text-xs text-indigo-600">Rate</p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   LIST VIEW ROW
   ════════════════════════════════════════════════════════════ */
function ListRow({ record, onEdit, onDelete }) {
  const cfg = STATUS_CFG[record.status] || STATUS_CFG.present;
  return (
    <div className="group flex items-center gap-3 py-3.5 px-4 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition">
      <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot} shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">
          <span className="font-medium">{record.subjects?.name || '—'}</span>
          {record.subjects?.code && <span className="text-gray-400 ml-1">({record.subjects.code})</span>}
        </p>
        {record.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{record.notes}</p>}
      </div>
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text} ${cfg.border} border`}>
        {cfg.label}
      </span>
      {record.is_manual && (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">Manual</span>
      )}
      <span className="text-xs text-gray-400 whitespace-nowrap w-24 text-right">{record.date}</span>
      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(record)} title="Edit"
          className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button onClick={() => onDelete(record)} title="Delete"
          className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PAGINATION
   ════════════════════════════════════════════════════════════ */
function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const range = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - range && i <= page + range)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition">
        Prev
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-2 text-gray-400">…</span>
        ) : (
          <button key={p} onClick={() => onPage(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
              p === page ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}>
            {p}
          </button>
        )
      )}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition">
        Next
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════ */
export default function History() {
  const [view, setView] = useState('calendar'); // 'calendar' | 'list'
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSubject, setFilterSubject] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterManual, setFilterManual] = useState(false);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calRecords, setCalRecords] = useState([]);

  // List state
  const [listData, setListData] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  // Modals
  const [editRecord, setEditRecord] = useState(null);
  const [deleteRecord, setDeleteRecord] = useState(null);

  // Load subjects
  useEffect(() => {
    getSubjects().then(setSubjects).catch(console.error);
  }, []);

  // Build filter obj
  const buildFilters = useCallback(() => {
    const f = {};
    if (filterSubject) f.subjectId = filterSubject;
    if (filterFrom) f.from = filterFrom;
    if (filterTo) f.to = filterTo;
    if (filterStatus) f.status = filterStatus;
    if (filterManual) f.manualOnly = true;
    return f;
  }, [filterSubject, filterFrom, filterTo, filterStatus, filterManual]);

  // Load calendar records (all for the month, ignoring pagination)
  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const f = buildFilters();
      // Override date range to the calendar month unless user set explicit range
      if (!f.from && !f.to) {
        f.from = fmtDate(calYear, calMonth, 1);
        const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
        f.to = fmtDate(calYear, calMonth, lastDay);
      }
      const data = await getAttendance(f);
      setCalRecords(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [calYear, calMonth, buildFilters]);

  // Load list records (paginated)
  const loadList = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const result = await getAttendancePaginated(buildFilters(), p, PAGE_SIZE);
      setListData(result.data);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setTotalCount(result.count);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [buildFilters]);

  // Reload on view change or filter change
  useEffect(() => {
    if (view === 'calendar') loadCalendar();
    else loadList(1);
  }, [view, loadCalendar, loadList]);

  const refresh = () => {
    if (view === 'calendar') loadCalendar();
    else loadList(page);
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const all = await getAttendance(buildFilters());
      if (all.length === 0) return;
      const headers = ['Date', 'Subject', 'Code', 'Status', 'Manual', 'Notes'];
      const rows = all.map((r) => [
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
    } catch (err) { console.error(err); }
  };

  const clearFilters = () => {
    setFilterSubject('');
    setFilterFrom('');
    setFilterTo('');
    setFilterStatus('');
    setFilterManual(false);
  };

  const hasFilters = filterSubject || filterFrom || filterTo || filterStatus || filterManual;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Attendance History</h1>
            <p className="text-gray-500 mt-1">Review and manage your attendance records</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-white/80 rounded-xl border border-gray-200 p-1">
              <button onClick={() => setView('calendar')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                  view === 'calendar' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Calendar
              </button>
              <button onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                  view === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                List
              </button>
            </div>
            {/* Export */}
            <button onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow border border-white/60 p-5 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            {/* Subject */}
            <div className="w-44">
              <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
              <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer">
                <option value="">All</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {/* Date range */}
            <div className="w-36">
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer" />
            </div>
            <div className="w-36">
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer" />
            </div>
            {/* Status */}
            <div className="w-36">
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer">
                <option value="">All</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="not_happened">No Class</option>
              </select>
            </div>
            {/* Manual only */}
            <label className="flex items-center gap-2 pb-1 cursor-pointer">
              <input type="checkbox" checked={filterManual} onChange={(e) => setFilterManual(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
              <span className="text-sm text-gray-600">Manual only</span>
            </label>
            {/* Clear */}
            {hasFilters && (
              <button onClick={clearFilters}
                className="text-sm text-indigo-600 hover:text-indigo-500 font-medium pb-1 cursor-pointer">
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        ) : view === 'calendar' ? (
          /* Calendar */
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
            <CalendarView records={calRecords} calYear={calYear} calMonth={calMonth} setCalYear={setCalYear} setCalMonth={setCalMonth} />
          </div>
        ) : (
          /* List */
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60">
            {/* Header row */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-700">{totalCount}</span> record{totalCount !== 1 ? 's' : ''}
              </p>
            </div>

            {listData.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-gray-400">No records found.</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="mt-3 text-sm text-indigo-600 hover:text-indigo-500 font-medium cursor-pointer">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div>
                {listData.map((r) => (
                  <ListRow key={r.id} record={r} onEdit={setEditRecord} onDelete={setDeleteRecord} />
                ))}
              </div>
            )}

            <div className="px-5 py-3 border-t border-gray-100">
              <Pagination page={page} totalPages={totalPages} onPage={(p) => loadList(p)} />
            </div>
          </div>
        )}
      </main>

      {/* Edit modal */}
      {editRecord && (
        <EditModal record={editRecord} onClose={() => setEditRecord(null)} onSaved={() => { setEditRecord(null); refresh(); }} />
      )}
      {/* Delete confirm */}
      {deleteRecord && (
        <DeleteConfirm record={deleteRecord} onClose={() => setDeleteRecord(null)} onDeleted={() => { setDeleteRecord(null); refresh(); }} />
      )}
    </div>
  );
}
