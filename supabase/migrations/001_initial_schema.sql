-- ============================================
-- Supabase Migration: Initial Schema
-- Converted from MySQL (Railway) to PostgreSQL
-- ============================================

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE severity_level AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE performance_status AS ENUM ('Excellent', 'Good', 'Late', 'Critical', 'Variable');

-- ============================================
-- TABLES
-- ============================================

-- Admins table
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supervisors table
CREATE TABLE supervisors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Operators (Technicians) table
CREATE TABLE operators (
    operator_id SERIAL PRIMARY KEY,
    email VARCHAR(255),
    password VARCHAR(255),
    name TEXT,
    google_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Defects limits reference table
CREATE TABLE defects_limits (
    defect_id SERIAL PRIMARY KEY,
    defect_name VARCHAR(255) NOT NULL UNIQUE,
    max_duration_minutes INT NOT NULL,
    severity severity_level DEFAULT 'Medium',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Targets table
CREATE TABLE targets (
    target_id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    target_value INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table (shift assignments)
CREATE TABLE tasks (
    task_id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    shift VARCHAR(50) NOT NULL,
    target_description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recordings table (main data)
CREATE TABLE recordings (
    recording_id SERIAL PRIMARY KEY,
    operator_id INT REFERENCES operators(operator_id) ON DELETE SET NULL,
    shift VARCHAR(50),
    type VARCHAR(50),
    transcript TEXT,
    audio_path VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    detected_defects JSONB,
    defect_analysis TEXT,
    transcription_text TEXT,
    performance_percentage DECIMAL(5,2),
    final_evaluation_score DECIMAL(5,2),
    evaluation_details JSONB,
    shift_deducted_time INT DEFAULT 0,
    shift_delay_time INT DEFAULT 0,
    effective_working_time INT DEFAULT 0,
    shift_date DATE
);

-- Evaluations table
CREATE TABLE evaluations (
    evaluation_id SERIAL PRIMARY KEY,
    recording_id INT NOT NULL REFERENCES recordings(recording_id) ON DELETE CASCADE,
    fault_code VARCHAR(10),
    fault_name VARCHAR(100),
    detected_duration INT,
    standard_duration INT,
    time_difference INT,
    performance_status performance_status,
    score INT,
    ai_summary TEXT,
    extra_time INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stops table (downtime tracking)
CREATE TABLE stops (
    stop_id SERIAL PRIMARY KEY,
    operator_id INT REFERENCES operators(operator_id) ON DELETE SET NULL,
    reason TEXT,
    stop_timestamp TIME,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Target achievements table
CREATE TABLE targetachievements (
    achievement_id SERIAL PRIMARY KEY,
    target_id INT NOT NULL REFERENCES targets(target_id) ON DELETE CASCADE,
    operator_id INT NOT NULL REFERENCES operators(operator_id) ON DELETE CASCADE,
    achievement VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(target_id, operator_id)
);

-- ============================================
-- INDEXES
-- ============================================

-- Tasks: frequently queried by date and shift
CREATE INDEX idx_tasks_date_shift ON tasks(date, shift);

-- Recordings: frequently filtered by operator, shift, and date
CREATE INDEX idx_recordings_operator ON recordings(operator_id);
CREATE INDEX idx_recordings_shift_date ON recordings(shift_date, shift);
CREATE INDEX idx_recordings_created ON recordings(created_at);

-- Evaluations: always joined with recordings
CREATE INDEX idx_evaluations_recording ON evaluations(recording_id);

-- Target achievements: composite lookups
CREATE INDEX idx_achievements_target_operator ON targetachievements(target_id, operator_id);

-- Operators: email lookups for auth
CREATE INDEX idx_operators_email ON operators(email);
CREATE INDEX idx_operators_google ON operators(google_id);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tasks table
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
