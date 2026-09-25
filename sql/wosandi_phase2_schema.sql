-- ====================================================================
-- Wosandi Admin Panel & Flow Engine - Phase 2 Schema Extension
-- Strict Constraints:
-- 1. ZERO INTERFERENCE: Existing production tables (daily_logs, routine_tasks, etc.) are UNTOUCHED.
-- 2. MANDATORY PREFIX: Every table, view, or trigger strictly uses 'wosandi_' prefix.
-- 3. PER-OPTION SCORING MATRIX: Dynamic options JSONB array with positive/negative points.
-- 4. SCORE FLOOR SAFEGUARD: Configurable minimum score floor (Math.max(0, currentScore)).
-- 5. CONDITIONAL BRANCHING: Directed DAG edges with answer-dependent routing.
-- ====================================================================

-- 1. Schema Documentation & Reference for wosandi_flows (Phase 2 Enhanced)
-- The existing public.wosandi_flows table stores the complete DAG graph in flow_data JSONB:
-- {
--   "settings": {
--     "score_floor_zero": true,         -- Safeguard: clamp score to Math.max(0, score)
--     "allow_negative_score": false,
--     "auto_advance": true
--   },
--   "nodes": [
--     {
--       "id": "node_wake_up",
--       "type": "question",             -- question | branch | end
--       "text_si": "අද උදෑසන අවදි වූයේ කීයටද?",
--       "text_en": "What time did you wake up this morning?",
--       "input_type": "time-range",      -- choice | select | radio | time-range | boolean | text | scale
--       "options": [
--         { "id": "opt_1", "text_si": "05:30ට පෙර", "text_en": "Before 05:30", "points": 20 },
--         { "id": "opt_2", "text_si": "06:00ට පෙර", "text_en": "Before 06:00", "points": 15 },
--         { "id": "opt_3", "text_si": "06:30ට පෙර", "text_en": "Before 06:30", "points": 10 },
--         { "id": "opt_4", "text_si": "06:30ට පසු",  "text_en": "After 06:30",  "points": -20 }
--       ],
--       "points": 0,                    -- Static fallback when options matrix is not used
--       "position": { "x": 100, "y": 50 }
--     },
--     {
--       "id": "node_school_attend",
--       "type": "question",
--       "text_si": "අද දින ඔබ පාසල් ගියාද?",
--       "text_en": "Did you attend school today?",
--       "input_type": "boolean",
--       "options": [
--         { "id": "opt_yes", "text_si": "ඔව්", "text_en": "Yes", "points": 10 },
--         { "id": "opt_no",  "text_si": "නැත", "text_en": "No",  "points": 0 }
--       ]
--     },
--     {
--       "id": "node_study_subj",
--       "type": "question",
--       "text_si": "පාසලේදී වැඩිපුරම අවධානය යොමු කළ විෂය කුමක්ද?",
--       "text_en": "What did you study most at school?",
--       "input_type": "choice",
--       "options": [
--         { "id": "opt_math", "text_si": "ගණිතය", "text_en": "Mathematics", "points": 15 },
--         { "id": "opt_sci",  "text_si": "විද්‍යාව", "text_en": "Science", "points": 15 }
--       ]
--     },
--     {
--       "id": "node_home_reason",
--       "type": "question",
--       "text_si": "පාසල් නොගිය හේතුව සහ නිවසේ අධ්‍යයන කාර්යය කුමක්ද?",
--       "text_en": "Reason for staying home and self-study task?",
--       "input_type": "choice",
--       "options": [
--         { "id": "opt_sick", "text_si": "අසනීප තත්ත්වය / විවේකය", "text_en": "Sick / Rest", "points": 5 },
--         { "id": "opt_rev",  "text_si": "ස්වයං අධ්‍යයනය හා පුනරීක්ෂණය", "text_en": "Intensive Self-Study", "points": 20 }
--       ]
--     },
--     {
--       "id": "node_end",
--       "type": "end",
--       "text_si": "දවසේ ඇගයීම සාර්ථකව අවසන්!",
--       "text_en": "Daily Assessment Complete!"
--     }
--   ],
--   "edges": [
--     {
--       "fromId": "node_school_attend",
--       "toId": "node_study_subj",
--       "condition": "Yes",
--       "condition_value": "opt_yes"
--     },
--     {
--       "fromId": "node_school_attend",
--       "toId": "node_home_reason",
--       "condition": "No",
--       "condition_value": "opt_no"
--     },
--     {
--       "fromId": "node_study_subj",
--       "toId": "node_end",
--       "condition": null
--     },
--     {
--       "fromId": "node_home_reason",
--       "toId": "node_end",
--       "condition": null
--     }
--   ]
-- }

-- 2. Optional Relational Projection Tables for Normalized Flow Queries
-- (Strictly using wosandi_ prefix, isolated from legacy tables)

CREATE TABLE IF NOT EXISTS public.wosandi_flow_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES public.wosandi_flows(id) ON DELETE CASCADE,
    node_key VARCHAR(100) NOT NULL,
    node_type VARCHAR(30) NOT NULL DEFAULT 'question' CHECK (node_type IN ('question', 'task', 'branch', 'end')),
    task_id UUID DEFAULT NULL,
    task_payload JSONB DEFAULT NULL,
    text_si TEXT NOT NULL DEFAULT '',
    text_en TEXT NOT NULL DEFAULT '',
    input_type VARCHAR(50) DEFAULT 'choice',
    points_default NUMERIC(6, 2) DEFAULT 0,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (flow_id, node_key)
);

CREATE INDEX IF NOT EXISTS idx_wosandi_flow_nodes_flow ON public.wosandi_flow_nodes (flow_id, sort_order);

CREATE TABLE IF NOT EXISTS public.wosandi_flow_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES public.wosandi_flows(id) ON DELETE CASCADE,
    from_node_key VARCHAR(100) NOT NULL,
    to_node_key VARCHAR(100) NOT NULL,
    condition_label TEXT DEFAULT NULL,
    condition_value TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wosandi_flow_edges_flow ON public.wosandi_flow_edges (flow_id, from_node_key);

-- 3. Row Level Security for new wosandi_ tables
ALTER TABLE public.wosandi_flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wosandi_flow_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wosandi_flow_nodes_read" ON public.wosandi_flow_nodes FOR SELECT USING (true);
CREATE POLICY "wosandi_flow_nodes_write" ON public.wosandi_flow_nodes FOR ALL USING (true);

CREATE POLICY "wosandi_flow_edges_read" ON public.wosandi_flow_edges FOR SELECT USING (true);
CREATE POLICY "wosandi_flow_edges_write" ON public.wosandi_flow_edges FOR ALL USING (true);

-- 4. Updated-at triggers
CREATE TRIGGER trg_wosandi_flow_nodes_updated BEFORE UPDATE ON public.wosandi_flow_nodes
  FOR EACH ROW EXECUTE FUNCTION wosandi_update_updated_at();

CREATE TRIGGER trg_wosandi_flow_edges_updated BEFORE UPDATE ON public.wosandi_flow_edges
  FOR EACH ROW EXECUTE FUNCTION wosandi_update_updated_at();
