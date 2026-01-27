-- Migration: Add order_number column to tasks table
-- This stores the job order number (رقم امر الشغل) like "R-22"

ALTER TABLE tasks ADD COLUMN order_number VARCHAR(50);

-- Index for faster searches by order number
CREATE INDEX idx_tasks_order_number ON tasks (order_number);
