-- Migration number: 0003 	 2026-01-24T00:00:00.000Z
ALTER TABLE setting RENAME COLUMN auto_refresh_time TO auto_refresh;
UPDATE setting SET auto_refresh = 1 WHERE auto_refresh != 0;
