-- ====================================================================
-- Wosandi O/L Mission Control - Isolated Schema Definition
-- Strict Constraints:
-- 1. ZERO INTERFERENCE: Existing tables (e.g. daily_logs, routine_tasks, unit_papers) are untouched.
-- 2. MANDATORY PREFIX: All tables strictly use 'wosandi_' prefix.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.wosandi_daily_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date DATE NOT NULL UNIQUE,
    grade VARCHAR(10) NOT NULL DEFAULT '11',
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    earned_points NUMERIC(6, 2) NOT NULL DEFAULT 0,
    total_possible_points NUMERIC(6, 2) NOT NULL DEFAULT 0,
    percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    day_target_benchmark NUMERIC(6, 2) NOT NULL DEFAULT 120,
    completed_tasks JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_fully_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
