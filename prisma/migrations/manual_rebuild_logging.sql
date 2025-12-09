-- ========================================
-- MANUAL MIGRATION: Rebuild Logging System
-- Date: 2025-12-08
-- ========================================

-- Step 1: Backup existing ChangeLog table
CREATE TABLE IF NOT EXISTS ChangeLog_backup AS SELECT * FROM ChangeLog;

-- Step 2: Drop old ChangeLog table
DROP TABLE IF EXISTS ChangeLog;

-- Step 3: Create new AuditLog table with optimized structure
CREATE TABLE AuditLog (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity VARCHAR(50) NOT NULL,
  entityId VARCHAR(50) NULL,
  operation VARCHAR(30) NOT NULL,
  userId VARCHAR(50) NULL,
  username VARCHAR(100) NULL,
  changes JSON NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 4: Create indexes for performance
CREATE INDEX idx_entity_time ON AuditLog(entity, createdAt);
CREATE INDEX idx_user_time ON AuditLog(userId, createdAt);
CREATE INDEX idx_operation_time ON AuditLog(operation, createdAt);
CREATE INDEX idx_recent ON AuditLog(createdAt DESC);

-- Step 5: Verify migration
SELECT 
  'ChangeLog_backup' as table_name, 
  COUNT(*) as record_count 
FROM ChangeLog_backup
UNION ALL
SELECT 
  'AuditLog' as table_name, 
  COUNT(*) as record_count 
FROM AuditLog;

-- Migration complete!
-- Old data preserved in: ChangeLog_backup
-- New logging table ready: AuditLog
