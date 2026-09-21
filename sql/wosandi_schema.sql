-- ====================================================================
-- Wosandi O/L Mission Control - Isolated Schema Definition
-- Strict Constraints:
-- 1. ZERO INTERFERENCE: Existing tables (e.g. daily_logs, routine_tasks, unit_papers) are untouched.
-- 2. MANDATORY PREFIX: All tables strictly use 'wosandi_' prefix.
-- ====================================================================

-- 1. Daily Logs & Historical Seasonality Baseline
CREATE TABLE IF NOT EXISTS public.wosandi_daily_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date DATE NOT NULL UNIQUE,
    grade VARCHAR(10) NOT NULL DEFAULT '11',
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday...
    earned_points NUMERIC(6, 2) NOT NULL DEFAULT 0,
    total_possible_points NUMERIC(6, 2) NOT NULL DEFAULT 0,
    percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    day_target_benchmark NUMERIC(6, 2) NOT NULL DEFAULT 120,
    completed_tasks JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_fully_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for historical day-of-week aggregation
CREATE INDEX IF NOT EXISTS idx_wosandi_daily_logs_dow ON public.wosandi_daily_logs (day_of_week, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_wosandi_daily_logs_grade ON public.wosandi_daily_logs (grade);

-- 2. Unit Paper Marks (Supports 0-score exclusion)
CREATE TABLE IF NOT EXISTS public.wosandi_unit_paper_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade VARCHAR(10) NOT NULL DEFAULT '11',
    subject_id VARCHAR(50) NOT NULL,
    unit_name VARCHAR(255) NOT NULL,
    sub_unit_name VARCHAR(255) NOT NULL,
    paper_no INT NOT NULL DEFAULT 1,
    marks NUMERIC(5, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wosandi_upm_grade_sub ON public.wosandi_unit_paper_marks (grade, subject_id);
CREATE INDEX IF NOT EXISTS idx_wosandi_upm_marks ON public.wosandi_unit_paper_marks (marks);

-- 3. Full Papers
CREATE TABLE IF NOT EXISTS public.wosandi_full_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade VARCHAR(10) NOT NULL DEFAULT '11',
    subject_id VARCHAR(50) NOT NULL,
    paper_title VARCHAR(255),
    marks NUMERIC(5, 2) NOT NULL DEFAULT 0,
    exam_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wosandi_fp_grade_sub ON public.wosandi_full_papers (grade, subject_id);
CREATE INDEX IF NOT EXISTS idx_wosandi_fp_date ON public.wosandi_full_papers (exam_date DESC);

-- 4. Spaced Repetition (For Priority 2 and Multi-Source Streak)
CREATE TABLE IF NOT EXISTS public.wosandi_space_repetition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade VARCHAR(10) NOT NULL DEFAULT '11',
    subject_id VARCHAR(50) NOT NULL,
    unit_name VARCHAR(255) NOT NULL,
    sub_unit_name VARCHAR(255) NOT NULL,
    stage INT NOT NULL DEFAULT 1,
    due_today BOOLEAN NOT NULL DEFAULT TRUE,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wosandi_sr_grade ON public.wosandi_space_repetition (grade, due_today);
CREATE INDEX IF NOT EXISTS idx_wosandi_sr_completed ON public.wosandi_space_repetition (completed_at);

-- 5. Lessons & Pending Test Papers
CREATE TABLE IF NOT EXISTS public.wosandi_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade VARCHAR(10) NOT NULL DEFAULT '11',
    subject_id VARCHAR(50) NOT NULL,
    unit_name VARCHAR(255) NOT NULL,
    sub_unit_name VARCHAR(255) NOT NULL,
    lesson_name VARCHAR(255) NOT NULL,
    lesson_done BOOLEAN NOT NULL DEFAULT FALSE,
    hw_done BOOLEAN NOT NULL DEFAULT FALSE,
    hw_days INT NOT NULL DEFAULT 0,
    attempts INT NOT NULL DEFAULT 0,
    needs_model_paper_1 BOOLEAN NOT NULL DEFAULT FALSE,
    unit_paper JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wosandi_lessons_grade_sub ON public.wosandi_lessons (grade, subject_id);

-- 6. Sub Units (For Least-Practiced Detector)
CREATE TABLE IF NOT EXISTS public.wosandi_sub_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade VARCHAR(10) NOT NULL DEFAULT '11',
    subject_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    lesson_done BOOLEAN NOT NULL DEFAULT FALSE,
    hw_done BOOLEAN NOT NULL DEFAULT FALSE,
    activity_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wosandi_subunits_grade ON public.wosandi_sub_units (grade, subject_id);

-- 7. Adaptive Questionnaire & Tasks (Weighted Academic Priority Schema)
CREATE TABLE IF NOT EXISTS public.wosandi_questionnaire_tasks (
    id VARCHAR(100) PRIMARY KEY,
    grade VARCHAR(10) NOT NULL,
    subject_id VARCHAR(50) NOT NULL,
    sub_unit_id VARCHAR(100),
    title_si TEXT NOT NULL,
    title_en TEXT NOT NULL,
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('core_academic', 'applied_basket', 'routine_baseline')),
    weight_points NUMERIC(5, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS and permissive policies for public anon access if required
ALTER TABLE public.wosandi_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wosandi_unit_paper_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wosandi_full_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wosandi_space_repetition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wosandi_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wosandi_sub_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wosandi_questionnaire_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wosandi_daily_logs_read" ON public.wosandi_daily_logs FOR SELECT USING (true);
CREATE POLICY "wosandi_daily_logs_write" ON public.wosandi_daily_logs FOR ALL USING (true);
CREATE POLICY "wosandi_upm_all" ON public.wosandi_unit_paper_marks FOR ALL USING (true);
CREATE POLICY "wosandi_fp_all" ON public.wosandi_full_papers FOR ALL USING (true);
CREATE POLICY "wosandi_sr_all" ON public.wosandi_space_repetition FOR ALL USING (true);
CREATE POLICY "wosandi_lessons_all" ON public.wosandi_lessons FOR ALL USING (true);
CREATE POLICY "wosandi_subunits_all" ON public.wosandi_sub_units FOR ALL USING (true);
CREATE POLICY "wosandi_tasks_all" ON public.wosandi_questionnaire_tasks FOR ALL USING (true);
