-- Migration: Create tasks table for shift targets
-- Run this against the `factory_db` database.

CREATE TABLE IF NOT EXISTS tasks (
  TaskID INT AUTO_INCREMENT PRIMARY KEY,
  Date DATE NOT NULL,
  Shift VARCHAR(50) NOT NULL,
  TargetDescription LONGTEXT NOT NULL,
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_date_shift (Date, Shift)
);
