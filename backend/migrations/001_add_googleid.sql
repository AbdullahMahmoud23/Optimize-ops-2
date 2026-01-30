-- Migration: add GoogleID column to operators table
-- Run this against the `factory_db` database.
-- This safely adds the column (ignores error if it already exists)

ALTER TABLE operators
  ADD COLUMN GoogleID VARCHAR(255) NULL;

