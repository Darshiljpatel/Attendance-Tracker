import { supabase } from '../lib/supabase';

/* ── Profile ─────────────────────────────────────────────── */

export async function getProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', (await supabase.auth.getUser()).data.user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ── Subjects ────────────────────────────────────────────── */

export async function getSubjects() {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createSubject(subject) {
  const userId = (await supabase.auth.getUser()).data.user.id;
  const { data, error } = await supabase
    .from('subjects')
    .insert({ ...subject, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSubject(id, updates) {
  const { data, error } = await supabase
    .from('subjects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSubject(id) {
  const { error } = await supabase.from('subjects').delete().eq('id', id);
  if (error) throw error;
}

/* ── Attendance ──────────────────────────────────────────── */

export async function getAttendance(filters = {}) {
  let query = supabase
    .from('attendance')
    .select('*, subjects(name, code)')
    .order('date', { ascending: false });

  if (filters.subjectId) query = query.eq('subject_id', filters.subjectId);
  if (filters.from) query = query.gte('date', filters.from);
  if (filters.to) query = query.lte('date', filters.to);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.manualOnly) query = query.eq('is_manual', true);
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getAttendancePaginated(filters = {}, page = 1, pageSize = 20) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('attendance')
    .select('*, subjects(name, code)', { count: 'exact' })
    .order('date', { ascending: false })
    .range(from, to);

  if (filters.subjectId) query = query.eq('subject_id', filters.subjectId);
  if (filters.from) query = query.gte('date', filters.from);
  if (filters.to) query = query.lte('date', filters.to);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.manualOnly) query = query.eq('is_manual', true);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) };
}

export async function updateAttendanceRecord(id, updates) {
  const { data, error } = await supabase
    .from('attendance')
    .update(updates)
    .eq('id', id)
    .select('*, subjects(name, code)')
    .single();
  if (error) throw error;
  return data;
}

export async function getAttendanceBySubject(subjectId) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('subject_id', subjectId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function markAttendance({ subjectId, date, status, notes }) {
  const userId = (await supabase.auth.getUser()).data.user.id;
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      {
        subject_id: subjectId,
        user_id: userId,
        date: date || new Date().toISOString().split('T')[0],
        status,
        is_manual: true,
        notes,
      },
      { onConflict: 'subject_id,date' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAttendance(id) {
  const { error } = await supabase.from('attendance').delete().eq('id', id);
  if (error) throw error;
}

/* ── Stats helpers (computed client-side) ─────────────────── */

export function computeSubjectStats(attendanceRecords, targetPct) {
  const total = attendanceRecords.filter((r) => r.status !== 'not_happened').length;
  const present = attendanceRecords.filter((r) => r.status === 'present').length;
  const absent = attendanceRecords.filter((r) => r.status === 'absent').length;
  const percentage = total > 0 ? (present / total) * 100 : 0;

  // How many more classes can be bunked while staying ≥ target
  // present / (total + x) >= target/100  →  x <= (present*100 - target*total) / target
  let canBunk = 0;
  if (total > 0 && percentage >= targetPct) {
    canBunk = Math.floor((present * 100 - targetPct * total) / targetPct);
  }

  // How many consecutive classes needed to reach target
  // (present + x) / (total + x) >= target/100  →  x >= (target*total - present*100) / (100 - target)
  let needToAttend = 0;
  if (total > 0 && percentage < targetPct && targetPct < 100) {
    needToAttend = Math.ceil(
      (targetPct * total - present * 100) / (100 - targetPct)
    );
  }

  // Color coding
  let status = 'green';
  if (total > 0) {
    if (percentage < targetPct - 5) status = 'red';
    else if (percentage < targetPct) status = 'yellow';
  }

  return { total, present, absent, percentage, canBunk, needToAttend, status };
}
