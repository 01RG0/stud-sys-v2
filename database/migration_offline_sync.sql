-- Migration script for offline sync functionality
-- Run this if you have an existing database that needs the new fields

USE student_lab_system;

-- Add new columns to entry_registrations table if they don't exist
ALTER TABLE entry_registrations 
ADD COLUMN IF NOT EXISTS from_offline_sync BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sync_timestamp TIMESTAMP NULL;

-- Add new indexes for better performance
ALTER TABLE entry_registrations 
ADD INDEX IF NOT EXISTS idx_offline_mode (offline_mode),
ADD INDEX IF NOT EXISTS idx_sync_timestamp (sync_timestamp);

-- Update system configuration
INSERT IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES
('offline_sync_enabled', 'true', 'boolean', 'Offline synchronization enabled'),
('real_ip_detection', 'true', 'boolean', 'Real IP detection enabled'),
('live_logs_enabled', 'true', 'boolean', 'Live server logs enabled'),
('migration_completed', 'true', 'boolean', 'Offline sync migration completed');

-- Show migration status
SELECT 'Migration completed successfully' as status;
SELECT COUNT(*) as total_registrations FROM entry_registrations;
SELECT COUNT(*) as offline_registrations FROM entry_registrations WHERE offline_mode = TRUE;
SELECT COUNT(*) as sync_registrations FROM entry_registrations WHERE from_offline_sync = TRUE;
