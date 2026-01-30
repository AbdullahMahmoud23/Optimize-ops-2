-- Migration: Add missing columns for rollover system
-- Run this against the database

-- Add target_hours column for time-based calculations
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS target_hours DECIMAL(10,2);

-- Add version_number column for optimistic locking (prevent race conditions)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS version_number INT DEFAULT 0;

-- Create index for faster version checks
CREATE INDEX IF NOT EXISTS idx_tasks_version ON tasks (version_number);

-- Update existing rows to have default values
UPDATE tasks 
SET target_hours = 8, 
    version_number = 0 
WHERE target_hours IS NULL OR version_number IS NULL;