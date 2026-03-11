import { useEffect, useState, useMemo, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { getSubjects, getAttendanceBySubject, getProfile } from '../services/api';

/* ════════════════════════════════════════════════════════════
   MATH HELPERS
   ════════════════════════════════════════════════════════════ */
function calc(present, total, target) {
  const pct = total > 0 ? (present / total) * 100 : 0;
  const aboveTarget = pct >= target;

  // Can bunk:  present / (total + x) ≥ target/100 → x ≤ (present·100 − target·total) / target
  let canBunk = 0;
  if (total > 0 && aboveTarget) {
    canBunk = Math.floor((present * 100 - target * total) / target);
    if (canBunk < 0) canBunk = 0;
  }

  // Need to attend:  (present + x) / (total + x) ≥ target/100 → x ≥ (target·total − present·100) / (100 − target)
  let needToAttend = 0;
  if (total > 0 && !aboveTarget && target < 100) {
    needToAttend = Math.ceil((target * total - present * 100) / (100 - target));
    if (needToAttend < 0) needToAttend = 0;
  }

  return { pct, aboveTarget, canBunk, needToAttend };
}

function pctAfterBunking(present, total, bunkCount) {
  const newTotal = total + bunkCount;
  return newTotal > 0 ? (present / newTotal) * 100 : 0;
}

function pctAfterAttending(present, total, attendCount) {
  const newTotal = total + attendCount;
  const newPresent = present + attendCount;
  return newTotal > 0 ? (newPresent / newTotal) * 100 : 0;
}

/* ════════════════════════════════════════════════════════════
   MINI CHART  – simple SVG line chart
   ════════════════════════════════════════════════════════════ */
function TrendChart({ present, total, target, maxFuture }) {
  // Build data points: historical point, then projected points for bunking/attending
  const W = 360, H = 140, PX = 30, PY = 16;
  const points = [];
  const steps = Math.min(maxFuture, 30);

  // Current point
  const curPct = total > 0 ? (present / total) * 100 : 0;
  points.push({ x: 0, y: curPct, label: 'Now' });

  // Future bunk scenario
  for (let i = 1; i <= steps; i++) {
    const p = pctAfterBunking(present, total, i);
    points.push({ x: i, y: p });
  }

  // Also compute "attend all" line
  const attendPoints = [{ x: 0, y: curPct }];
  for (let i = 1; i <= steps; i++) {
    attendPoints.push({ x: i, y: pctAfterAttending(present, total, i) });
  }

  const xScale = (v) => PX + (v / steps) * (W - 2 * PX);
  const yMin = 0, yMax = 100;
  const yScale = (v) => H - PY - ((v - yMin) / (yMax - yMin)) * (H - 2 * PY);

  const toPath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Target line */}
      <line x1={PX} x2={W - PX} y1={yScale(target)} y2={yScale(target)}
        stroke="#a5b4fc" strokeWidth="1" strokeDasharray="4 3" />
      <text x={W - PX + 4} y={yScale(target) + 3} fontSize="9" fill="#818cf8" fontWeight="600">
        {target}%
      </text>

      {/* Attend-all line (green) */}
      <path d={toPath(attendPoints)} fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.6" />
      {/* Bunk line (red) */}
      <path d={toPath(points)} fill="none" stroke="#ef4444" strokeWidth="2" />

      {/* Current dot */}
      <circle cx={xScale(0)} cy={yScale(curPct)} r="4" fill="#6366f1" />
      <text x={xScale(0)} y={yScale(curPct) - 8} textAnchor="middle" fontSize="9" fill="#6366f1" fontWeight="700">
        {curPct.toFixed(1)}%
      </text>

      {/* X axis labels */}
      <text x={PX} y={H - 2} fontSize="8" fill="#9ca3af" textAnchor="middle">Now</text>
      <text x={W - PX} y={H - 2} fontSize="8" fill="#9ca3af" textAnchor="middle">+{steps}</text>

      {/* Legend */}
      <line x1={PX} x2={PX + 16} y1={8} y2={8} stroke="#ef4444" strokeWidth="2" />
      <text x={PX + 20} y={11} fontSize="8" fill="#6b7280">Bunk all</text>
      <line x1={PX + 68} x2={PX + 84} y1={8} y2={8} stroke="#22c55e" strokeWidth="2" opacity="0.7" />
      <text x={PX + 88} y={11} fontSize="8" fill="#6b7280">Attend all</text>
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════
   CIRCULAR PROGRESS RING
   ════════════════════════════════════════════════════════════ */
function Ring({ pct, size = 96, stroke = 8, color = '#6366f1' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-700" />
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════
   SUBJECT CARD (compact bunk info)
   ════════════════════════════════════════════════════════════ */
function SubjectCard({ subject, records, target }) {
  const present = records.filter((r) => r.status === 'present').length;
  const total   = records.filter((r) => r.status !== 'not_happened').length;
  const { pct, aboveTarget, canBunk, needToAttend } = calc(present, total, target);

  const ringColor = aboveTarget ? (pct >= target + 5 ? '#22c55e' : '#eab308') : '#ef4444';

  return (
    <div className={`rounded-2xl border p-4 transition ${
      aboveTarget ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <Ring pct={pct} size={52} stroke={5} color={ringColor} />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold"
            style={{ color: ringColor }}>{pct.toFixed(0)}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm truncate">{subject.name}</p>
          <p className="text-xs text-gray-400">{present}/{total} classes</p>
        </div>
      </div>

      {aboveTarget ? (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">
            Can bunk <span className="text-green-900 font-bold">{canBunk}</span> class{canBunk !== 1 ? 'es' : ''}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-red-700 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">
            Attend <span className="text-red-900 font-bold">{needToAttend}</span> more class{needToAttend !== 1 ? 'es' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════ */
export default function BunkCalculator() {
  // Data from DB
  const [subjects, setSubjects] = useState([]);
  const [allRecords, setAllRecords] = useState({});   // subjectId -> records[]
  const [profileTarget, setProfileTarget] = useState(75);
  const [loadingData, setLoadingData] = useState(true);

  // Manual calculator inputs
  const [manPresent, setManPresent] = useState(0);
  const [manTotal,   setManTotal]   = useState(0);
  const [manTarget,  setManTarget]  = useState(75);
  const [sliderVal,  setSliderVal]  = useState(0); // classes to bunk (slider)

  // Selected subject (for subject-wise mode)
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);

  // Mode
  const [mode, setMode] = useState('subjects'); // 'subjects' | 'manual'

  // Show formulas toggle
  const [showFormulas, setShowFormulas] = useState(false);

  /* ── Load data ──────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const [subs, profile] = await Promise.all([getSubjects(), getProfile()]);
        setSubjects(subs);
        if (profile?.target_attendance_pct) {
          setProfileTarget(profile.target_attendance_pct);
          setManTarget(profile.target_attendance_pct);
        }

        // fetch records per subject in parallel
        const entries = await Promise.all(
          subs.map(async (s) => {
            const recs = await getAttendanceBySubject(s.id);
            return [s.id, recs];
          })
        );
        setAllRecords(Object.fromEntries(entries));
        // Auto-select first subject
        if (subs.length > 0) setSelectedSubjectId(subs[0].id);
      } catch (err) { console.error(err); }
      finally { setLoadingData(false); }
    })();
  }, []);

  /* ── Selected subject stats ─────────────────────────────── */
  const selectedSubject = useMemo(() => subjects.find(s => s.id === selectedSubjectId), [subjects, selectedSubjectId]);
  const subjectStats = useMemo(() => {
    const recs = allRecords[selectedSubjectId] || [];
    const present = recs.filter((r) => r.status === 'present').length;
    const total   = recs.filter((r) => r.status !== 'not_happened').length;
    return { present, total, ...calc(present, total, profileTarget) };
  }, [allRecords, selectedSubjectId, profileTarget]);

  /* ── Manual calc ────────────────────────────────────────── */
  const manual = useMemo(() => {
    const p = Math.max(0, manPresent);
    const t = Math.max(0, manTotal);
    const base = calc(p, t, manTarget);
    const afterBunk   = pctAfterBunking(p, t, sliderVal);
    const afterAttend = pctAfterAttending(p, t, sliderVal);
    return { ...base, present: p, total: t, afterBunk, afterAttend };
  }, [manPresent, manTotal, manTarget, sliderVal]);

  const maxSlider = useMemo(() => {
    if (mode === 'manual') return Math.max(manual.canBunk + 5, 30);
    return Math.max(subjectStats.canBunk + 5, 30);
  }, [mode, manual.canBunk, subjectStats.canBunk]);

  /* ── Recommendations ────────────────────────────────────── */
  const getRecommendations = useCallback((data, target) => {
    const tips = [];
    if (data.total === 0) {
      tips.push({ type: 'info', text: 'No attendance data yet. Start marking attendance to see insights.' });
      return tips;
    }
    if (data.pct >= target + 10) {
      tips.push({ type: 'safe', text: `You're well above target! You can safely miss ${data.canBunk} class${data.canBunk !== 1 ? 'es' : ''}.` });
      tips.push({ type: 'tip', text: 'Consider spacing out your bunks rather than taking them consecutively.' });
    } else if (data.pct >= target) {
      tips.push({ type: 'caution', text: `You're just above target. You can only miss ${data.canBunk} class${data.canBunk !== 1 ? 'es' : ''} — be careful.` });
      tips.push({ type: 'tip', text: 'Attend a few more classes before bunking to build a safety buffer.' });
    } else {
      tips.push({ type: 'danger', text: `You're below target by ${(target - data.pct).toFixed(1)}%. Attend ${data.needToAttend} consecutive class${data.needToAttend !== 1 ? 'es' : ''} to recover.` });
      if (data.needToAttend > 10) {
        tips.push({ type: 'warning', text: 'Recovery will take significant effort. Prioritize attendance immediately.' });
      }
      tips.push({ type: 'tip', text: 'Avoid missing any more classes until you reach the target percentage.' });
    }
    return tips;
  }, []);

  const activeData = mode === 'manual'
    ? { pct: manual.pct, canBunk: manual.canBunk, needToAttend: manual.needToAttend, total: manual.total, present: manual.present, aboveTarget: manual.aboveTarget }
    : { pct: subjectStats.pct, canBunk: subjectStats.canBunk, needToAttend: subjectStats.needToAttend, total: subjectStats.total, present: subjectStats.present, aboveTarget: subjectStats.aboveTarget };
  const activeTarget = mode === 'manual' ? manTarget : profileTarget;
  const recommendations = useMemo(() => getRecommendations(activeData, activeTarget), [activeData, activeTarget, getRecommendations]);

  const ICON_MAP = {
    safe:    { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: '✓' },
    caution: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: '⚠' },
    danger:  { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: '✕' },
    warning: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: '!' },
    tip:     { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: '💡' },
    info:    { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'ℹ' },
  };

  /* ── Slider present/total for the interactive prediction ── */
  const sliderPresent = mode === 'manual' ? manual.present : subjectStats.present;
  const sliderTotal   = mode === 'manual' ? manual.total   : subjectStats.total;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Bunk Calculator</h1>
            <p className="text-gray-500 mt-1">Plan smarter, bunk safer</p>
          </div>
          {/* Mode toggle */}
          <div className="flex bg-white/80 rounded-xl border border-gray-200 p-1">
            <button onClick={() => setMode('subjects')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                mode === 'subjects' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'
              }`}>
              My Subjects
            </button>
            <button onClick={() => setMode('manual')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                mode === 'manual' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'
              }`}>
              Manual Input
            </button>
          </div>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* ── LEFT COLUMN (2/3) ── */}
            <div className="lg:col-span-2 space-y-6">

              {/* ── Manual Input Card ── */}
              {mode === 'manual' && (
                <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Enter Attendance</h2>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Classes Attended</label>
                      <input type="number" min={0} value={manPresent} onChange={(e) => setManPresent(Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Total Classes</label>
                      <input type="number" min={0} value={manTotal} onChange={(e) => setManTotal(Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Target %</label>
                      <input type="number" min={1} max={100} value={manTarget} onChange={(e) => setManTarget(Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Subject Selector (subjects mode) ── */}
              {mode === 'subjects' && subjects.length > 0 && (
                <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Select Subject</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {subjects.map((s) => {
                      const recs = allRecords[s.id] || [];
                      const p = recs.filter(r => r.status === 'present').length;
                      const t = recs.filter(r => r.status !== 'not_happened').length;
                      const pct = t > 0 ? (p / t) * 100 : 0;
                      const isSelected = s.id === selectedSubjectId;
                      return (
                        <button key={s.id} onClick={() => { setSelectedSubjectId(s.id); setSliderVal(0); }}
                          className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                            isSelected
                              ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-500/30'
                              : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
                          }`}>
                          <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                          <p className={`text-xs mt-0.5 font-medium ${
                            pct >= profileTarget ? 'text-green-600' : 'text-red-500'
                          }`}>{pct.toFixed(1)}% ({p}/{t})</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Subject / Manual Summary ── */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  {mode === 'subjects' ? (selectedSubject?.name || 'Select a Subject') : 'Results'}
                </h2>

                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Ring */}
                  <div className="relative shrink-0">
                    <Ring pct={activeData.pct} size={120} stroke={10}
                      color={activeData.aboveTarget ? '#22c55e' : '#ef4444'} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold" style={{ color: activeData.aboveTarget ? '#22c55e' : '#ef4444' }}>
                        {activeData.pct.toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-gray-400">{activeData.present}/{activeData.total}</span>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="flex-1 grid grid-cols-2 gap-3 w-full">
                    <div className={`rounded-xl py-3 px-4 ${activeData.aboveTarget ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className="text-xs text-gray-500">Status</p>
                      <p className={`text-sm font-bold ${activeData.aboveTarget ? 'text-green-700' : 'text-red-700'}`}>
                        {activeData.aboveTarget ? 'Above Target' : 'Below Target'}
                      </p>
                    </div>
                    <div className="rounded-xl py-3 px-4 bg-indigo-50">
                      <p className="text-xs text-gray-500">Target</p>
                      <p className="text-sm font-bold text-indigo-700">{activeTarget}%</p>
                    </div>
                    <div className="rounded-xl py-3 px-4 bg-green-50">
                      <p className="text-xs text-gray-500">Can Bunk</p>
                      <p className="text-sm font-bold text-green-700">{activeData.canBunk} class{activeData.canBunk !== 1 ? 'es' : ''}</p>
                    </div>
                    <div className="rounded-xl py-3 px-4 bg-orange-50">
                      <p className="text-xs text-gray-500">Need to Attend</p>
                      <p className="text-sm font-bold text-orange-700">{activeData.needToAttend} class{activeData.needToAttend !== 1 ? 'es' : ''}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Interactive Slider ── */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Prediction Simulator</h2>
                <p className="text-sm text-gray-500 mb-4">Drag the slider to see how bunking or attending affects your %</p>

                <div className="mb-4">
                  <input type="range" min={0} max={maxSlider} value={sliderVal}
                    onChange={(e) => setSliderVal(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0</span>
                    <span className="font-semibold text-gray-700 text-sm">{sliderVal} classes</span>
                    <span>{maxSlider}</span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
                    <p className="text-xs text-red-500 mb-1">If you bunk {sliderVal} class{sliderVal !== 1 ? 'es' : ''}</p>
                    <p className="text-2xl font-bold text-red-700">
                      {pctAfterBunking(sliderPresent, sliderTotal, sliderVal).toFixed(1)}%
                    </p>
                    <p className="text-xs text-red-400 mt-1">
                      {pctAfterBunking(sliderPresent, sliderTotal, sliderVal) >= activeTarget
                        ? '✓ Still above target'
                        : '✕ Below target!'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-green-200 bg-green-50/60 p-4">
                    <p className="text-xs text-green-500 mb-1">If you attend {sliderVal} class{sliderVal !== 1 ? 'es' : ''}</p>
                    <p className="text-2xl font-bold text-green-700">
                      {pctAfterAttending(sliderPresent, sliderTotal, sliderVal).toFixed(1)}%
                    </p>
                    <p className="text-xs text-green-400 mt-1">
                      {pctAfterAttending(sliderPresent, sliderTotal, sliderVal) >= activeTarget
                        ? '✓ Above target'
                        : `↑ ${(activeTarget - pctAfterAttending(sliderPresent, sliderTotal, sliderVal)).toFixed(1)}% more needed`}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Trend Chart ── */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Attendance Trend</h2>
                <p className="text-sm text-gray-500 mb-4">Projected attendance over next classes</p>
                {sliderTotal > 0 ? (
                  <TrendChart present={sliderPresent} total={sliderTotal} target={activeTarget} maxFuture={maxSlider} />
                ) : (
                  <p className="text-center py-8 text-gray-400">Enter attendance data to see the trend.</p>
                )}
              </div>

              {/* ── All Subjects Overview (subjects mode) ── */}
              {mode === 'subjects' && subjects.length > 0 && (
                <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">All Subjects Overview</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {subjects.map((s) => (
                      <div key={s.id} onClick={() => { setSelectedSubjectId(s.id); setSliderVal(0); }} className="cursor-pointer">
                        <SubjectCard subject={s} records={allRecords[s.id] || []} target={profileTarget} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN (1/3) ── */}
            <div className="space-y-6">

              {/* ── Recommendations ── */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Recommendations</h2>
                <div className="space-y-3">
                  {recommendations.map((r, i) => {
                    const cfg = ICON_MAP[r.type] || ICON_MAP.info;
                    return (
                      <div key={i} className={`flex items-start gap-3 rounded-xl border ${cfg.border} ${cfg.bg} p-3`}>
                        <span className="text-base leading-none mt-0.5">{cfg.icon}</span>
                        <p className={`text-sm ${cfg.text}`}>{r.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Warning (below target) ── */}
              {activeData.total > 0 && !activeData.aboveTarget && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="font-bold text-red-800">Below Target!</h3>
                  </div>
                  <p className="text-sm text-red-700 mb-2">
                    Current: <span className="font-bold">{activeData.pct.toFixed(1)}%</span> — Target: <span className="font-bold">{activeTarget}%</span>
                  </p>
                  <p className="text-sm text-red-700">
                    You need to attend <span className="font-bold">{activeData.needToAttend}</span> consecutive class{activeData.needToAttend !== 1 ? 'es' : ''} without missing any to reach your target.
                  </p>
                </div>
              )}

              {/* ── Formulas ── */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 p-6">
                <button onClick={() => setShowFormulas(!showFormulas)}
                  className="flex items-center justify-between w-full text-left cursor-pointer">
                  <h2 className="text-lg font-bold text-gray-900">Formulas Used</h2>
                  <svg xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 text-gray-400 transition-transform ${showFormulas ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showFormulas && (
                  <div className="mt-4 space-y-4 text-sm">
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">Attendance %</p>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 font-mono text-xs text-gray-600">
                        % = (Present ÷ Total) × 100
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">Can Bunk (x classes)</p>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 font-mono text-xs text-gray-600">
                        Present ÷ (Total + x) ≥ Target ÷ 100<br />
                        x ≤ (Present×100 − Target×Total) ÷ Target
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">Need to Attend (x classes)</p>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 font-mono text-xs text-gray-600">
                        (Present + x) ÷ (Total + x) ≥ Target ÷ 100<br />
                        x ≥ (Target×Total − Present×100) ÷ (100 − Target)
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">After Bunking x</p>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 font-mono text-xs text-gray-600">
                        New % = Present ÷ (Total + x) × 100
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">After Attending x</p>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 font-mono text-xs text-gray-600">
                        New % = (Present + x) ÷ (Total + x) × 100
                      </div>
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
