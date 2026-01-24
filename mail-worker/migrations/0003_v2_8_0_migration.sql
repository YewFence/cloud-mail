-- Migration number: 0003 	 2026-01-24T00:00:00.000Z
-- IMPORTANT: This migration converts auto_refresh_time (INTEGER) to auto_refresh (BOOLEAN/INTEGER FLAG).
-- Original specific time values will be lost and converted to 1 (enabled).
-- This is an intentional simplification of the feature.
ALTER TABLE setting RENAME COLUMN auto_refresh_time TO auto_refresh;
UPDATE setting SET auto_refresh = 1 WHERE auto_refresh != 0;
