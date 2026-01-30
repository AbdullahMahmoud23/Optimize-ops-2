-- Migration: Add shift metrics columns to recordings table
-- Purpose: Track shift time calculations for each recording session

-- Add columns for shift time tracking
ALTER TABLE recordings 
ADD COLUMN ShiftDeductedTime INT DEFAULT 0 COMMENT 'Total ALLOWED fault time deducted from shift (standard time only, in minutes)',
ADD COLUMN ShiftDelayTime INT DEFAULT 0 COMMENT 'Total delay time over allowed (for evaluation only, does NOT affect effective time)',
ADD COLUMN EffectiveWorkingTime INT DEFAULT 0 COMMENT 'Remaining working time after allowed deductions (in minutes)';

-- CALCULATION LOGIC:
-- ShiftDeductedTime = sum of ALLOWED/STANDARD time for each fault (NOT actual detected time)
--   Example: Color adjustment = 30 min even if it took 45 min
--   Example: 3 cylinders = 30 × 3 = 90 min even if it took 120 min
--   For variable faults (maintenance, power cut): full detected time is used
--
-- ShiftDelayTime = sum of (DetectedDuration - AllowedTime) for fixed faults
--   This is for evaluation/display only and does NOT reduce effective working time
--
-- EffectiveWorkingTime = 480 - ShiftDeductedTime
--   Delay time is NOT subtracted from effective working time
