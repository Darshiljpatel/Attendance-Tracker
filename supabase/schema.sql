-- ============================================================
-- Attendance Tracker — Supabase Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 0. Enable UUID extension (usually already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  college_name  TEXT,
  target_attendance_pct NUMERIC(5, 2) NOT NULL DEFAULT 75.00
    CHECK (target_attendance_pct >= 0 AND target_attendance_pct <= 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.profiles IS 'Extended user profile linked 1-to-1 with auth.users';
COMMENT ON COLUMN public.profiles.target_attendance_pct IS 'Minimum attendance % the student wants to maintain (0–100)';

-- ============================================================
-- 2. SUBJECTS
-- ============================================================
CREATE TABLE public.subjects (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  code          TEXT,
  teacher_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, code)   -- prevent duplicate subject codes per user
);

COMMENT ON TABLE public.subjects IS 'Subjects/courses tracked by each user';

-- ============================================================
-- 3. ATTENDANCE
-- ============================================================
CREATE TYPE public.attendance_status AS ENUM (
  'present',
  'absent',
  'not_happened'
);

CREATE TABLE public.attendance (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id    UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  status        public.attendance_status NOT NULL DEFAULT 'present',
  is_manual     BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (subject_id, date)   -- one record per subject per day
);

COMMENT ON TABLE  public.attendance IS 'Daily attendance record per subject';
COMMENT ON COLUMN public.attendance.is_manual IS 'True when the record was entered/corrected manually';
COMMENT ON COLUMN public.attendance.status IS 'present = attended, absent = missed, not_happened = class cancelled / holiday';

-- ============================================================
-- 4. INDEXES
-- ============================================================
CREATE INDEX idx_subjects_user_id        ON public.subjects   (user_id);
CREATE INDEX idx_attendance_user_id      ON public.attendance  (user_id);
CREATE INDEX idx_attendance_subject_id   ON public.attendance  (subject_id);
CREATE INDEX idx_attendance_date         ON public.attendance  (date);
CREATE INDEX idx_attendance_user_date    ON public.attendance  (user_id, date);
CREATE INDEX idx_attendance_subject_date ON public.attendance  (subject_id, date);

-- ============================================================
-- 5. AUTOMATIC updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 6. AUTO-CREATE PROFILE ON SIGN-UP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, college_name, target_attendance_pct)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'college_name', ''),
    COALESCE((NEW.raw_user_meta_data ->> 'target_attendance_pct')::numeric, 75.00)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================

-- ---- Profiles ------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insert handled by the trigger (SECURITY DEFINER), but allow
-- explicit inserts from the owning user too.
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ---- Subjects ------------------------------------------------
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subjects"
  ON public.subjects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subjects"
  ON public.subjects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subjects"
  ON public.subjects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subjects"
  ON public.subjects FOR DELETE
  USING (auth.uid() = user_id);

-- ---- Attendance ----------------------------------------------
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendance"
  ON public.attendance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attendance"
  ON public.attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance"
  ON public.attendance FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own attendance"
  ON public.attendance FOR DELETE
  USING (auth.uid() = user_id);
