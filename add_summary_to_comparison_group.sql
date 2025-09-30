-- Add summary field to ComparisonGroup table
-- Migration: Add summary field for group comparison summary/conclusion

ALTER TABLE ComparisonGroup 
ADD COLUMN summary TEXT;

-- Optional: Add some sample data or update existing records
-- UPDATE ComparisonGroup SET summary = 'Sample summary text' WHERE id = 1;