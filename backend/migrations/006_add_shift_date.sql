-- Migration: Add ShiftDate column to recordings table
-- Purpose: Store the actual shift date selected by technician (separate from CreatedAt)
-- This allows recordings for past/future dates to be properly linked to tasks

ALTER TABLE recordings 
ADD COLUMN ShiftDate DATE NULL COMMENT 'The actual shift date selected by technician (can be different from CreatedAt)';

-- Create index for faster lookups by date and shift
CREATE INDEX idx_shift_date ON recordings (ShiftDate, Shift);

-- Update existing records: set ShiftDate = DATE(CreatedAt) for records that don't have it
UPDATE recordings SET ShiftDate = DATE(CreatedAt) WHERE ShiftDate IS NULL;
