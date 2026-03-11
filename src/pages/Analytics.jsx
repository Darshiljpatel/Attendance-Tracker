import { useEffect, useState, useMemo } from 'react';
import Navbar from '../components/Navbar';
import { getSubjects, getAttendance, getProfile } from '../services/api';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, AreaChart,
} from 'recharts';

/* ════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════ */
const COLORS = ['#6366f1', '#22c55e', '#ef4444', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316'];
const PIE_COLORS = { present: '#22c55e', absent: '#ef4444', not_happened: '#94a3b8' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function monthKey(dateStr) { return dateStr.slice(0, 7); } // "2026-03"
function dayOfWeek(dateStr) { return new Date(dateStr).getDay(); } // 0=Sun

/* card wrapper */
function Card({ title, subtitle, children, className = '' }) {
  return (
    <div className={`bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6 ${className}`}>
      {title && <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>}
      {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   HEATMAP CALENDAR
   ════════════════════════════════════════════════════════════ */
function HeatmapCalendar({ records }) {
  // last 3 months heatmap (Sun=0 → Sat=6, weeks as columns)
  const today = new Date();
  const start = new Date(today);
  start.setMonth(start.getMonth() - 3);
  start.setDate(start.getDate() - start.getDay()); // align to Sunday

  // build dateMap: dateStr -> status
  const dateMap = useMemo(() => {
    const m = {};
    records.forEach((r) => {
      if (!m[r.date]) m[r.date] = { present: 0, absent: 0, noClass: 0 };
      if (r.status === 'present') m[r.date].present++;
      else if (r.status === 'absent') m[r.date].absent++;
      else m[r.date].noClass++;
    });
    return m;
  }, [records]);

  // build weeks
  const weeks = [];
  let d = new Date(start);
  while (d <= today) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const ds = fmtDate(d);
      week.push({ date: ds, day: d.getDay(), data: dateMap[ds] || null, future: d > today });
      d.setDate(d.getDate() + 1);
    }
    weeks.push(week);
  }

  const getColor = (data) => {
    if (!data) return 'bg-gray-100';
    if (data.present > 0 && data.absent === 0) return 'bg-green-400';
    if (data.absent > 0 && data.present === 0) return 'bg-red-400';
    if (data.present > 0 && data.absent > 0) return 'bg-yellow-400';
    return 'bg-gray-300';
  };

  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 mr-1">
          {DAYS.map((d, i) => (
            <div key={i} className="h-3.5 w-5 text-[9px] text-gray-400 flex items-center justify-end pr-0.5">{i % 2 === 1 ? d : ''}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((cell) => (
              <div key={cell.date}
                className={`h-3.5 w-3.5 rounded-sm ${cell.future ? 'bg-transparent' : getColor(cell.data)} transition`}
                title={cell.future ? '' : `${cell.date}${cell.data ? `: ${cell.data.present}P ${cell.data.absent}A` : ': No record'}`} />
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-gray-100" /> No record</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-green-400" /> Present</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-400" /> Absent</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-yellow-400" /> Mixed</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CUSTOM TOOLTIP
   ════════════════════════════════════════════════════════════ */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <span className="font-bold">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}{p.unit || ''}</span>
        </p>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════ */
export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [records, setRecords] = useState([]);
  const [target, setTarget] = useState(75);

  useEffect(() => {
    (async () => {
      try {
        const [subs, allRecs, profile] = await Promise.all([
          getSubjects(),
          getAttendance({}),
          getProfile(),
        ]);
        setSubjects(subs);
        setRecords(allRecs);
        if (profile?.target_attendance_pct) setTarget(profile.target_attendance_pct);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  /* ── 1. LINE CHART DATA — daily rolling attendance % (last 3 months) ── */
  const trendData = useMemo(() => {
    if (records.length === 0) return [];
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    const cutoffStr = fmtDate(cutoff);

    // sort ascending
    const sorted = [...records]
      .filter((r) => r.date >= cutoffStr && r.status !== 'not_happened')
      .sort((a, b) => a.date.localeCompare(b.date));

    let cumPresent = 0, cumTotal = 0;
    const daily = {};
    sorted.forEach((r) => {
      cumTotal++;
      if (r.status === 'present') cumPresent++;
      daily[r.date] = { pct: (cumPresent / cumTotal) * 100, present: cumPresent, total: cumTotal };
    });

    return Object.entries(daily).map(([date, d]) => ({
      date: `${MONTHS[parseInt(date.slice(5, 7)) - 1]} ${parseInt(date.slice(8))}`,
      rawDate: date,
      pct: d.pct,
      target,
    }));
  }, [records, target]);

  /* ── 2. BAR CHART DATA — per-subject attendance % ── */
  const subjectBarData = useMemo(() => {
    return subjects.map((s) => {
      const subRecs = records.filter((r) => r.subject_id === s.id && r.status !== 'not_happened');
      const present = subRecs.filter((r) => r.status === 'present').length;
      const total = subRecs.length;
      const pct = total > 0 ? (present / total) * 100 : 0;
      return { name: s.name, pct: Math.round(pct * 10) / 10, present, total, target };
    }).sort((a, b) => b.pct - a.pct);
  }, [subjects, records, target]);

  /* ── 3. PIE CHART DATA ── */
  const pieData = useMemo(() => {
    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const noClass = records.filter((r) => r.status === 'not_happened').length;
    if (present + absent + noClass === 0) return [];
    return [
      { name: 'Present', value: present, color: PIE_COLORS.present },
      { name: 'Absent', value: absent, color: PIE_COLORS.absent },
      { name: 'No Class', value: noClass, color: PIE_COLORS.not_happened },
    ];
  }, [records]);

  /* ── 4. Best / Worst subjects ── */
  const { best, worst } = useMemo(() => {
    if (subjectBarData.length === 0) return { best: null, worst: null };
    const withData = subjectBarData.filter((s) => s.total > 0);
    if (withData.length === 0) return { best: null, worst: null };
    return { best: withData[0], worst: withData[withData.length - 1] };
  }, [subjectBarData]);

  /* ── 5. Monthly comparison ── */
  const monthlyData = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      if (r.status === 'not_happened') return;
      const mk = monthKey(r.date);
      if (!map[mk]) map[mk] = { present: 0, absent: 0, total: 0 };
      map[mk].total++;
      if (r.status === 'present') map[mk].present++;
      else map[mk].absent++;
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // last 6 months
      .map(([mk, d]) => ({
        month: `${MONTHS[parseInt(mk.slice(5)) - 1]} ${mk.slice(2, 4)}`,
        present: d.present,
        absent: d.absent,
        pct: d.total > 0 ? Math.round((d.present / d.total) * 1000) / 10 : 0,
      }));
  }, [records]);

  /* ── 6. Attendance prediction ── */
  const prediction = useMemo(() => {
    if (monthlyData.length < 2) return null;
    // Simple linear regression on monthly pct
    const n = monthlyData.length;
    const xs = monthlyData.map((_, i) => i);
    const ys = monthlyData.map((d) => d.pct);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (ys[i] - yMean);
      den += (xs[i] - xMean) ** 2;
    }
    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;

    // Predict next 2 months
    const predictions = [];
    for (let i = 1; i <= 2; i++) {
      const futureIdx = n - 1 + i;
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + i);
      const predPct = Math.max(0, Math.min(100, intercept + slope * futureIdx));
      predictions.push({
        month: `${MONTHS[futureDate.getMonth()]} ${String(futureDate.getFullYear()).slice(2)}`,
        pct: Math.round(predPct * 10) / 10,
      });
    }

    const trend = slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'stable';
    return { slope: Math.round(slope * 100) / 100, trend, predictions };
  }, [monthlyData]);

  /* ── Overall stats ── */
  const overall = useMemo(() => {
    const present = records.filter((r) => r.status === 'present').length;
    const total = records.filter((r) => r.status !== 'not_happened').length;
    return { present, total, pct: total > 0 ? (present / total) * 100 : 0 };
  }, [records]);

  /* ═══════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Visualize your attendance patterns and insights</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        ) : records.length === 0 ? (
          <Card>
            <div className="py-12 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-400 font-medium">No attendance data yet</p>
              <p className="text-sm text-gray-400 mt-1">Start marking attendance to see analytics</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">

            {/* ── Summary Row ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow border border-white/60 p-5 text-center">
                <p className="text-2xl font-bold text-indigo-600">{overall.pct.toFixed(1)}%</p>
                <p className="text-xs text-gray-500 mt-1">Overall Rate</p>
              </div>
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow border border-white/60 p-5 text-center">
                <p className="text-2xl font-bold text-green-600">{overall.present}</p>
                <p className="text-xs text-gray-500 mt-1">Classes Attended</p>
              </div>
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow border border-white/60 p-5 text-center">
                <p className="text-2xl font-bold text-red-600">{overall.total - overall.present}</p>
                <p className="text-xs text-gray-500 mt-1">Classes Missed</p>
              </div>
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow border border-white/60 p-5 text-center">
                <p className="text-2xl font-bold text-purple-600">{subjects.length}</p>
                <p className="text-xs text-gray-500 mt-1">Subjects</p>
              </div>
            </div>

            {/* ── Line Chart — Attendance Trend ── */}
            {trendData.length > 1 && (
              <Card title="Attendance Trend" subtitle="Rolling attendance percentage over the last 3 months">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradPct" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      <Area type="monotone" dataKey="pct" name="Attendance %" stroke="#6366f1" strokeWidth={2}
                        fill="url(#gradPct)" dot={false} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="target" name="Target" stroke="#ef4444" strokeWidth={1.5}
                        strokeDasharray="6 3" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* ── Bar + Pie in grid ── */}
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Bar chart — 3/5 */}
              {subjectBarData.length > 0 && (
                <Card title="Subject Comparison" subtitle="Attendance % by subject" className="lg:col-span-3">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subjectBarData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" interval={0} angle={-20} textAnchor="end" height={50} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="pct" name="Attendance %" radius={[6, 6, 0, 0]} maxBarSize={48}>
                          {subjectBarData.map((entry, i) => (
                            <Cell key={i}
                              fill={entry.pct >= target ? '#22c55e' : entry.pct >= target - 5 ? '#eab308' : '#ef4444'} />
                          ))}
                        </Bar>
                        <Line type="monotone" dataKey="target" name="Target" stroke="#6366f1"
                          strokeDasharray="6 3" dot={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              {/* Pie chart — 2/5 */}
              {pieData.length > 0 && (
                <Card title="Distribution" subtitle="Overall status breakdown" className="lg:col-span-2">
                  <div className="h-72 flex flex-col items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          innerRadius={50} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconType="circle" iconSize={10}
                          formatter={(value) => <span className="text-sm text-gray-600">{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
            </div>

            {/* ── Heatmap Calendar ── */}
            <Card title="Attendance Heatmap" subtitle="Last 3 months — GitHub-style contribution view">
              <HeatmapCalendar records={records} />
            </Card>

            {/* ── Best & Worst + Predictions ── */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Best */}
              {best && (
                <Card className="border-l-4 border-l-green-400">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Best Performing</p>
                      <p className="font-bold text-gray-900">{best.name}</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-green-600">{best.pct}%</p>
                  <p className="text-xs text-gray-400 mt-1">{best.present}/{best.total} classes attended</p>
                </Card>
              )}

              {/* Worst */}
              {worst && worst.name !== best?.name && (
                <Card className="border-l-4 border-l-red-400">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Needs Attention</p>
                      <p className="font-bold text-gray-900">{worst.name}</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-red-600">{worst.pct}%</p>
                  <p className="text-xs text-gray-400 mt-1">{worst.present}/{worst.total} classes attended</p>
                </Card>
              )}

              {/* Prediction */}
              {prediction && (
                <Card className="border-l-4 border-l-indigo-400">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Trend Prediction</p>
                      <p className="font-bold text-gray-900 capitalize">{prediction.trend}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {prediction.trend === 'improving'
                      ? 'Your attendance is trending upward. Keep it up!'
                      : prediction.trend === 'declining'
                      ? 'Your attendance is falling. Consider attending more classes.'
                      : 'Your attendance is holding steady.'}
                  </p>
                  <div className="space-y-1.5">
                    {prediction.predictions.map((p) => (
                      <div key={p.month} className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-indigo-700 font-medium">{p.month}</span>
                        <span className={`text-sm font-bold ${p.pct >= target ? 'text-green-600' : 'text-red-600'}`}>
                          ~{p.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 italic">Based on linear regression of monthly data</p>
                </Card>
              )}
            </div>

            {/* ── Monthly Comparison ── */}
            {monthlyData.length > 1 && (
              <Card title="Monthly Comparison" subtitle="Present vs absent classes by month">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      <Bar dataKey="present" name="Present" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Monthly stats table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                        <th className="pb-2 font-medium">Month</th>
                        <th className="pb-2 font-medium text-center">Present</th>
                        <th className="pb-2 font-medium text-center">Absent</th>
                        <th className="pb-2 font-medium text-center">Total</th>
                        <th className="pb-2 font-medium text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((m) => (
                        <tr key={m.month} className="border-b border-gray-50">
                          <td className="py-2 font-medium text-gray-700">{m.month}</td>
                          <td className="py-2 text-center text-green-600 font-medium">{m.present}</td>
                          <td className="py-2 text-center text-red-600 font-medium">{m.absent}</td>
                          <td className="py-2 text-center text-gray-600">{m.present + m.absent}</td>
                          <td className="py-2 text-right">
                            <span className={`font-bold ${m.pct >= target ? 'text-green-600' : 'text-red-600'}`}>
                              {m.pct}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
