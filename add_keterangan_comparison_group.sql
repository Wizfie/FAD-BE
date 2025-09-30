-- Manual migration to add keterangan field to ComparisonGroup
-- Run this SQL directly on your database

ALTER TABLE comparisongroup ADD COLUMN keterangan VARCHAR(500) NULL;