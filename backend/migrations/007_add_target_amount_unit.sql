-- Migration: Add amount and unit columns to tasks table
-- This adds support for structured target data instead of just text description

ALTER TABLE tasks 
ADD COLUMN target_amount DECIMAL(10,2),
ADD COLUMN target_unit VARCHAR(20);

-- Update existing rows to have default values
UPDATE tasks 
SET target_amount = 0, 
    target_unit = 'كيلو' 
WHERE target_amount IS NULL;
