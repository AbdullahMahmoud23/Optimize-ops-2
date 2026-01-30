-- ============================================
-- Supabase Migration: Row Level Security (RLS)
-- Fixed version - uses public schema for helpers
-- ============================================

-- Enable RLS on all tables
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE defects_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE targetachievements ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS (in public schema)
-- ============================================

-- Get current user's role from JWT
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::json->>'role',
        'anon'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's ID from JWT
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS INT AS $$
BEGIN
    RETURN COALESCE(
        (current_setting('request.jwt.claims', true)::json->>'id')::INT,
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ADMINS POLICIES
-- ============================================

CREATE POLICY "admins_read_own" ON admins
    FOR SELECT USING (public.get_user_role() = 'admin');

-- ============================================
-- SUPERVISORS POLICIES
-- ============================================

CREATE POLICY "supervisors_read_own" ON supervisors
    FOR SELECT USING (public.get_user_role() IN ('admin', 'supervisor'));

-- ============================================
-- OPERATORS POLICIES
-- ============================================

CREATE POLICY "operators_read_own" ON operators
    FOR SELECT USING (
        public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'technician' AND operator_id = public.get_user_id())
    );

-- ============================================
-- DEFECTS_LIMITS POLICIES
-- ============================================

CREATE POLICY "defects_limits_read" ON defects_limits
    FOR SELECT USING (public.get_user_role() IN ('admin', 'supervisor', 'technician'));

CREATE POLICY "defects_limits_admin_write" ON defects_limits
    FOR ALL USING (public.get_user_role() = 'admin');

-- ============================================
-- TARGETS POLICIES
-- ============================================

CREATE POLICY "targets_read" ON targets
    FOR SELECT USING (public.get_user_role() IN ('admin', 'supervisor', 'technician'));

CREATE POLICY "targets_admin_write" ON targets
    FOR ALL USING (public.get_user_role() = 'admin');

-- ============================================
-- TASKS POLICIES
-- ============================================

CREATE POLICY "tasks_read" ON tasks
    FOR SELECT USING (public.get_user_role() IN ('admin', 'supervisor', 'technician'));

CREATE POLICY "tasks_admin_supervisor_write" ON tasks
    FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "tasks_admin_supervisor_update" ON tasks
    FOR UPDATE USING (public.get_user_role() IN ('admin', 'supervisor'));

-- ============================================
-- RECORDINGS POLICIES
-- ============================================

CREATE POLICY "recordings_technician_read_own" ON recordings
    FOR SELECT USING (
        public.get_user_role() = 'technician' AND operator_id = public.get_user_id()
    );

CREATE POLICY "recordings_admin_read_all" ON recordings
    FOR SELECT USING (public.get_user_role() = 'admin');

CREATE POLICY "recordings_technician_insert" ON recordings
    FOR INSERT WITH CHECK (
        public.get_user_role() = 'technician' AND operator_id = public.get_user_id()
    );

CREATE POLICY "recordings_technician_update" ON recordings
    FOR UPDATE USING (
        public.get_user_role() = 'technician' AND operator_id = public.get_user_id()
    );

-- ============================================
-- EVALUATIONS POLICIES
-- ============================================

CREATE POLICY "evaluations_technician_read" ON evaluations
    FOR SELECT USING (
        public.get_user_role() = 'technician'
        AND recording_id IN (
            SELECT recording_id FROM recordings WHERE operator_id = public.get_user_id()
        )
    );

CREATE POLICY "evaluations_admin_read" ON evaluations
    FOR SELECT USING (public.get_user_role() = 'admin');

CREATE POLICY "evaluations_service_insert" ON evaluations
    FOR INSERT WITH CHECK (true);

-- ============================================
-- STOPS POLICIES
-- ============================================

CREATE POLICY "stops_technician_read" ON stops
    FOR SELECT USING (
        public.get_user_role() = 'technician' AND operator_id = public.get_user_id()
    );

CREATE POLICY "stops_admin_read" ON stops
    FOR SELECT USING (public.get_user_role() = 'admin');

-- ============================================
-- TARGETACHIEVEMENTS POLICIES
-- ============================================

CREATE POLICY "achievements_technician_read" ON targetachievements
    FOR SELECT USING (
        public.get_user_role() = 'technician' AND operator_id = public.get_user_id()
    );

CREATE POLICY "achievements_technician_write" ON targetachievements
    FOR INSERT WITH CHECK (
        public.get_user_role() = 'technician' AND operator_id = public.get_user_id()
    );

CREATE POLICY "achievements_technician_update" ON targetachievements
    FOR UPDATE USING (
        public.get_user_role() = 'technician' AND operator_id = public.get_user_id()
    );

CREATE POLICY "achievements_admin_read" ON targetachievements
    FOR SELECT USING (public.get_user_role() = 'admin');
