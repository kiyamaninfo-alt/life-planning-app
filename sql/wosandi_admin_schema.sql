-- ====================================================================
-- Wosandi Admin Panel - Isolated Schema Extension
-- Strict Constraints:
-- 1. ZERO INTERFERENCE: Existing tables are untouched.
-- 2. MANDATORY PREFIX: All tables use 'wosandi_' prefix.
-- 3. JSONB SCHEMA-DRIVEN: Dynamic configs stored in JSONB columns.
-- 4. DRAFT/PUBLISH: All configurable tables support status workflow.
-- ====================================================================

-- 1. Admin Configuration (Global settings, PIN hash, app preferences)
CREATE TABLE IF NOT EXISTS public.wosandi_admin_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default admin config
INSERT INTO public.wosandi_admin_config (config_key, config_data, description)
VALUES
  ('admin_pin', '{"pin_hash": "1234", "max_attempts": 5}', 'Admin access PIN configuration'),
  ('app_settings', '{"app_name": "Life Planning & Wosandi O/L", "theme": "pink", "language": "si"}', 'Global application settings')
ON CONFLICT (config_key) DO NOTHING;

-- 2. Admin-Managed Task Templates (CRUD with weighted points)
CREATE TABLE IF NOT EXISTS public.wosandi_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_si TEXT NOT NULL,
    title_en TEXT NOT NULL DEFAULT '',
    category VARCHAR(50) NOT NULL DEFAULT 'general'
        CHECK (category IN ('academic', 'physical', 'chores', 'habits', 'creative', 'general')),
    tier VARCHAR(30) NOT NULL DEFAULT 'routine_baseline'
        CHECK (tier IN ('core_academic', 'applied_basket', 'routine_baseline')),
    weight_points NUMERIC(6, 2) NOT NULL DEFAULT 5,
    icon VARCHAR(10) DEFAULT '📋',
    has_timer BOOLEAN NOT NULL DEFAULT FALSE,
    timer_seconds INT DEFAULT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    schema_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- schema_definition example:
    -- {
    --   "input_type": "checkbox",         -- checkbox | toggle | number_input
    --   "required": false,
    --   "linked_state_key": "maths_practice",
    --   "sub_tasks": [
    --     {"id": "sub_1", "label_si": "...", "points": 5}
    --   ],
    --   "visibility_rules": {"day_of_week": [1,2,3,4,5]}
    -- }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wosandi_tasks_status ON public.wosandi_tasks (status);
CREATE INDEX IF NOT EXISTS idx_wosandi_tasks_category ON public.wosandi_tasks (category, sort_order);

-- 3. Timer Configurations (Configurable presets with triggers)
CREATE TABLE IF NOT EXISTS public.wosandi_timers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label_si TEXT NOT NULL,
    label_en TEXT NOT NULL DEFAULT '',
    duration_hours INT NOT NULL DEFAULT 0 CHECK (duration_hours >= 0),
    duration_minutes INT NOT NULL DEFAULT 10 CHECK (duration_minutes >= 0 AND duration_minutes < 60),
    duration_seconds INT NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds < 60),
    icon VARCHAR(10) DEFAULT '⏱',
    sort_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- trigger_config example:
    -- {
    --   "auto_start": false,
    --   "pause_on_blur": true,
    --   "alert_intervals": [300, 60],     -- alert at 5min and 1min remaining
    --   "chime_on_complete": true,
    --   "linked_task_id": "uuid-of-task",
    --   "repeat_count": 1
    -- }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wosandi_timers_status ON public.wosandi_timers (status);

-- 4. Questionnaire Flows (Branching logic definitions)
CREATE TABLE IF NOT EXISTS public.wosandi_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_si TEXT NOT NULL,
    title_en TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    flow_type VARCHAR(30) NOT NULL DEFAULT 'questionnaire'
        CHECK (flow_type IN ('questionnaire', 'assessment', 'survey', 'checklist')),
    sort_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    flow_data JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
    -- flow_data structure:
    -- {
    --   "nodes": [
    --     {
    --       "id": "q1",
    --       "type": "question",           -- question | branch | end
    --       "question_si": "...",
    --       "question_en": "...",
    --       "input_type": "choice",        -- choice | text | scale | boolean
    --       "options": [
    --         {"key": "a", "label_si": "...", "value": "a"},
    --         {"key": "b", "label_si": "...", "value": "b"}
    --       ],
    --       "points": 10,
    --       "position": {"x": 100, "y": 50}
    --     }
    --   ],
    --   "edges": [
    --     {
    --       "from": "q1",
    --       "to": "q2",
    --       "condition": null              -- null = default path
    --     },
    --     {
    --       "from": "q1",
    --       "to": "q3",
    --       "condition": {"answer_equals": "b"}
    --     }
    --   ]
    -- }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wosandi_flows_status ON public.wosandi_flows (status);
CREATE INDEX IF NOT EXISTS idx_wosandi_flows_type ON public.wosandi_flows (flow_type);

-- 5. Dynamic UI Schema (Widget configurations for student app)
CREATE TABLE IF NOT EXISTS public.wosandi_ui_schema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    widget_type VARCHAR(30) NOT NULL
        CHECK (widget_type IN ('switch', 'checkbox', 'dropdown', 'action_button', 'number_input', 'text_input', 'radio_group')),
    label_si TEXT NOT NULL,
    label_en TEXT NOT NULL DEFAULT '',
    section VARCHAR(50) NOT NULL DEFAULT 'general',
    sort_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    schema_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- schema_definition examples by widget_type:
    --
    -- switch:
    -- {
    --   "default_value": false,
    --   "linked_state_key": "school_attended",
    --   "on_label_si": "ඔව්",
    --   "off_label_si": "නැත"
    -- }
    --
    -- checkbox:
    -- {
    --   "default_checked": false,
    --   "point_value": 5,
    --   "required": false,
    --   "linked_state_key": "clean_room"
    -- }
    --
    -- dropdown:
    -- {
    --   "options": [
    --     {"key": "05:00 - 05:30", "label_si": "05:00 - 05:30", "value": "05:00 - 05:30"},
    --     {"key": "05:30 - 06:00", "label_si": "05:30 - 06:00", "value": "05:30 - 06:00"}
    --   ],
    --   "default_selected": null,
    --   "linked_state_key": "wake_up"
    -- }
    --
    -- action_button:
    -- {
    --   "action_type": "start_timer",
    --   "action_params": {"timer_id": "uuid-of-timer"},
    --   "button_label_si": "Timer එක දමන්න",
    --   "button_style": "primary",
    --   "visibility_rules": {"show_when": {"task_key": "gemini_english", "is": true}}
    -- }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wosandi_ui_schema_status ON public.wosandi_ui_schema (status);
CREATE INDEX IF NOT EXISTS idx_wosandi_ui_schema_section ON public.wosandi_ui_schema (section, sort_order);
CREATE INDEX IF NOT EXISTS idx_wosandi_ui_schema_type ON public.wosandi_ui_schema (widget_type);

-- ====================================================================
-- Row Level Security
-- ====================================================================
ALTER TABLE public.wosandi_admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wosandi_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wosandi_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wosandi_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wosandi_ui_schema ENABLE ROW LEVEL SECURITY;

-- Read policies: Public read for published content (student app)
CREATE POLICY "wosandi_admin_config_read" ON public.wosandi_admin_config FOR SELECT USING (true);
CREATE POLICY "wosandi_tasks_read" ON public.wosandi_tasks FOR SELECT USING (true);
CREATE POLICY "wosandi_timers_read" ON public.wosandi_timers FOR SELECT USING (true);
CREATE POLICY "wosandi_flows_read" ON public.wosandi_flows FOR SELECT USING (true);
CREATE POLICY "wosandi_ui_schema_read" ON public.wosandi_ui_schema FOR SELECT USING (true);

-- Write policies: Permissive for admin operations (secured by client-side PIN)
CREATE POLICY "wosandi_admin_config_write" ON public.wosandi_admin_config FOR ALL USING (true);
CREATE POLICY "wosandi_tasks_write" ON public.wosandi_tasks FOR ALL USING (true);
CREATE POLICY "wosandi_timers_write" ON public.wosandi_timers FOR ALL USING (true);
CREATE POLICY "wosandi_flows_write" ON public.wosandi_flows FOR ALL USING (true);
CREATE POLICY "wosandi_ui_schema_write" ON public.wosandi_ui_schema FOR ALL USING (true);

-- ====================================================================
-- Updated-at trigger for all new admin tables
-- ====================================================================
CREATE OR REPLACE FUNCTION wosandi_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wosandi_admin_config_updated BEFORE UPDATE ON public.wosandi_admin_config
  FOR EACH ROW EXECUTE FUNCTION wosandi_update_updated_at();
CREATE TRIGGER trg_wosandi_tasks_updated BEFORE UPDATE ON public.wosandi_tasks
  FOR EACH ROW EXECUTE FUNCTION wosandi_update_updated_at();
CREATE TRIGGER trg_wosandi_timers_updated BEFORE UPDATE ON public.wosandi_timers
  FOR EACH ROW EXECUTE FUNCTION wosandi_update_updated_at();
CREATE TRIGGER trg_wosandi_flows_updated BEFORE UPDATE ON public.wosandi_flows
  FOR EACH ROW EXECUTE FUNCTION wosandi_update_updated_at();
CREATE TRIGGER trg_wosandi_ui_schema_updated BEFORE UPDATE ON public.wosandi_ui_schema
  FOR EACH ROW EXECUTE FUNCTION wosandi_update_updated_at();
