-- Migration: Add rollover_logs table for admin notifications
-- Run this against the `factory_db` database.

CREATE TABLE IF NOT EXISTS rollover_logs (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    task_id INT NOT NULL,
    original_task_description VARCHAR(255),
    achievement INT,
    target_amount INT,
    difference INT,
    action_type VARCHAR(20) NOT NULL, -- 'rollover' or 'balancing'
    next_shift VARCHAR(50),
    next_date DATE,
    time_affected DECIMAL(10,2), -- hours affected
    details TEXT
);

-- Index for faster queries by date
CREATE INDEX idx_rollover_logs_date ON rollover_logs (created_at);
CREATE INDEX idx_rollover_logs_action ON rollover_logs (action_type);
