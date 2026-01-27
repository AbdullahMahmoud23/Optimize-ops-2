-- Migration: Add columns for Target Rollover System
-- Run this against the `factory_db` database.

ALTER TABLE tasks 
ADD COLUMN is_rollover BOOLEAN DEFAULT FALSE,
ADD COLUMN original_task_id INT NULL,
ADD COLUMN production_rate DECIMAL(10,2) NULL,
ADD COLUMN priority INT DEFAULT 0,
ADD COLUMN adjustment_source VARCHAR(50) NULL;

-- Index for faster queries on rollover status
CREATE INDEX idx_rollover ON tasks (is_rollover);
