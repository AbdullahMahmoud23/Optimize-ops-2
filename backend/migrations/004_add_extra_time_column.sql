-- Migration: Add ExtraTime column to evaluations table
-- Purpose: Track minutes of machine downtime that exceed the allowed fault duration

ALTER TABLE evaluations ADD COLUMN ExtraTime INT DEFAULT 0 AFTER AI_Summary;

-- ExtraTime = detected_duration - standard_duration (for fixed faults)
-- ExtraTime = 0 for variable faults (maintenance, power cut)
-- This tracks how much time the technician will be "charged" against their 8-hour shift
