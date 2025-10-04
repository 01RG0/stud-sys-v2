-- ========================================
-- Student Management System v2 - Database Schema
-- ========================================

-- Create database
CREATE DATABASE IF NOT EXISTS student_management;
USE student_management;

-- ========================================
-- Students Table
-- ========================================
CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    center VARCHAR(255),
    grade VARCHAR(50),
    subject VARCHAR(255),
    phone VARCHAR(20),
    parent_phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    fees DECIMAL(10,2) DEFAULT 0,
    fees_1 DECIMAL(10,2) DEFAULT 0,
    session_sequence VARCHAR(255),
    guest_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for better performance
    INDEX idx_name (name),
    INDEX idx_center (center),
    INDEX idx_grade (grade),
    INDEX idx_subject (subject),
    INDEX idx_phone (phone),
    INDEX idx_email (email),
    INDEX idx_created_at (created_at)
);

-- ========================================
-- Registrations Table
-- ========================================
CREATE TABLE IF NOT EXISTS registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    center VARCHAR(255),
    fees DECIMAL(10,2) DEFAULT 0,
    homework_score DECIMAL(5,2) DEFAULT 0,
    exam_score DECIMAL(5,2),
    error VARCHAR(255),
    extra_sessions INT DEFAULT 0,
    comment TEXT,
    error_detail TEXT,
    fees_1 DECIMAL(10,2) DEFAULT 0,
    subject VARCHAR(255),
    grade VARCHAR(50),
    session_sequence VARCHAR(255),
    guest_info TEXT,
    phone VARCHAR(20),
    parent_phone VARCHAR(20),
    payment_amount DECIMAL(10,2) DEFAULT 0,
    device_name VARCHAR(100),
    entry_method ENUM('qr_scan', 'manual') DEFAULT 'qr_scan',
    offline_mode BOOLEAN DEFAULT FALSE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for better performance
    INDEX idx_student_id (student_id),
    INDEX idx_student_name (student_name),
    INDEX idx_center (center),
    INDEX idx_device_name (device_name),
    INDEX idx_entry_method (entry_method),
    INDEX idx_offline_mode (offline_mode),
    INDEX idx_registered_at (registered_at),
    INDEX idx_payment_amount (payment_amount),
    
    -- Foreign key constraint (optional)
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ========================================
-- Devices Table
-- ========================================
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    role ENUM('entry_scanner', 'exit_validator', 'manager') NOT NULL,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_online BOOLEAN DEFAULT FALSE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for better performance
    INDEX idx_name (name),
    INDEX idx_role (role),
    INDEX idx_is_online (is_online),
    INDEX idx_last_seen (last_seen),
    INDEX idx_created_at (created_at)
);

-- ========================================
-- Sync Queue Table (for offline sync)
-- ========================================
CREATE TABLE IF NOT EXISTS sync_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_name VARCHAR(100) NOT NULL,
    action_type ENUM('create_registration', 'update_registration', 'delete_registration') NOT NULL,
    data JSON NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    
    -- Indexes for better performance
    INDEX idx_device_name (device_name),
    INDEX idx_action_type (action_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_processed_at (processed_at)
);

-- ========================================
-- System Logs Table
-- ========================================
CREATE TABLE IF NOT EXISTS system_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    level ENUM('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL') NOT NULL,
    message TEXT NOT NULL,
    device_name VARCHAR(100),
    user_id VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    stack_trace TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for better performance
    INDEX idx_level (level),
    INDEX idx_device_name (device_name),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- ========================================
-- Data Integrity Table
-- ========================================
CREATE TABLE IF NOT EXISTS data_integrity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    check_type VARCHAR(100) NOT NULL,
    check_name VARCHAR(255) NOT NULL,
    status ENUM('PASS', 'FAIL', 'WARNING') NOT NULL,
    message TEXT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for better performance
    INDEX idx_check_type (check_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- ========================================
-- Backup History Table
-- ========================================
CREATE TABLE IF NOT EXISTS backup_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    backup_type ENUM('full', 'incremental', 'manual') NOT NULL,
    backup_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_size BIGINT,
    status ENUM('success', 'failed', 'in_progress') NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    -- Indexes for better performance
    INDEX idx_backup_type (backup_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_completed_at (completed_at)
);

-- ========================================
-- User Sessions Table (for future authentication)
-- ========================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(50),
    device_name VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    -- Indexes for better performance
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_device_name (device_name),
    INDEX idx_is_active (is_active),
    INDEX idx_expires_at (expires_at)
);

-- ========================================
-- Configuration Table
-- ========================================
CREATE TABLE IF NOT EXISTS system_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT,
    config_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for better performance
    INDEX idx_config_key (config_key),
    INDEX idx_config_type (config_type)
);

-- ========================================
-- Insert Default Configuration
-- ========================================
INSERT IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES
('system_name', 'Student Management System v2', 'string', 'Name of the system'),
('system_version', '2.0.0', 'string', 'Current system version'),
('max_devices', '100', 'number', 'Maximum number of connected devices'),
('sync_interval', '5000', 'number', 'Sync interval in milliseconds'),
('backup_interval', '86400', 'number', 'Backup interval in seconds (24 hours)'),
('max_backup_files', '30', 'number', 'Maximum number of backup files to keep'),
('enable_logging', 'true', 'boolean', 'Enable system logging'),
('log_level', 'INFO', 'string', 'Logging level (DEBUG, INFO, WARN, ERROR, FATAL)'),
('auto_cleanup_days', '90', 'number', 'Days to keep old logs and data'),
('enable_offline_mode', 'true', 'boolean', 'Enable offline mode support');

-- ========================================
-- Create Views for Common Queries
-- ========================================

-- View for student statistics
CREATE OR REPLACE VIEW student_stats AS
SELECT 
    COUNT(*) as total_students,
    COUNT(DISTINCT center) as total_centers,
    COUNT(DISTINCT grade) as total_grades,
    COUNT(DISTINCT subject) as total_subjects,
    SUM(fees) as total_fees,
    AVG(fees) as average_fees,
    MAX(created_at) as last_student_added,
    MIN(created_at) as first_student_added
FROM students;

-- View for registration statistics
CREATE OR REPLACE VIEW registration_stats AS
SELECT 
    COUNT(*) as total_registrations,
    COUNT(DISTINCT student_id) as unique_students,
    COUNT(DISTINCT device_name) as unique_devices,
    COUNT(CASE WHEN entry_method = 'qr_scan' THEN 1 END) as qr_scans,
    COUNT(CASE WHEN entry_method = 'manual' THEN 1 END) as manual_entries,
    COUNT(CASE WHEN offline_mode = TRUE THEN 1 END) as offline_registrations,
    SUM(payment_amount) as total_payments,
    AVG(payment_amount) as average_payment,
    MAX(registered_at) as last_registration,
    MIN(registered_at) as first_registration
FROM registrations;

-- View for device statistics
CREATE OR REPLACE VIEW device_stats AS
SELECT 
    COUNT(*) as total_devices,
    COUNT(CASE WHEN is_online = TRUE THEN 1 END) as online_devices,
    COUNT(CASE WHEN is_online = FALSE THEN 1 END) as offline_devices,
    COUNT(CASE WHEN role = 'entry_scanner' THEN 1 END) as entry_scanners,
    COUNT(CASE WHEN role = 'exit_validator' THEN 1 END) as exit_validators,
    COUNT(CASE WHEN role = 'manager' THEN 1 END) as managers,
    MAX(last_seen) as last_device_activity,
    MIN(created_at) as first_device_created
FROM devices;

-- ========================================
-- Create Stored Procedures
-- ========================================

-- Procedure to clean up old data
DELIMITER //
CREATE PROCEDURE CleanupOldData(IN days_to_keep INT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Clean up old system logs
    DELETE FROM system_logs 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL days_to_keep DAY);
    
    -- Clean up old sync queue items
    DELETE FROM sync_queue 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL days_to_keep DAY)
    AND status IN ('completed', 'failed');
    
    -- Clean up old backup history
    DELETE FROM backup_history 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL days_to_keep DAY)
    AND status = 'success';
    
    -- Clean up expired user sessions
    DELETE FROM user_sessions 
    WHERE expires_at < NOW();
    
    COMMIT;
    
    SELECT CONCAT('Cleaned up data older than ', days_to_keep, ' days') as result;
END //
DELIMITER ;

-- Procedure to get system health
DELIMITER //
CREATE PROCEDURE GetSystemHealth()
BEGIN
    SELECT 
        'Database' as component,
        'OK' as status,
        'Database is accessible' as message
    UNION ALL
    SELECT 
        'Students Table' as component,
        CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'WARNING' END as status,
        CONCAT('Total students: ', COUNT(*)) as message
    FROM students
    UNION ALL
    SELECT 
        'Registrations Table' as component,
        CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'WARNING' END as status,
        CONCAT('Total registrations: ', COUNT(*)) as message
    FROM registrations
    UNION ALL
    SELECT 
        'Devices Table' as component,
        CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'WARNING' END as status,
        CONCAT('Total devices: ', COUNT(*)) as message
    FROM devices
    UNION ALL
    SELECT 
        'Sync Queue' as component,
        CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END as status,
        CONCAT('Pending sync items: ', COUNT(*)) as message
    FROM sync_queue
    WHERE status = 'pending';
END //
DELIMITER ;

-- ========================================
-- Create Triggers
-- ========================================

-- Trigger to update device last_seen when registrations are created
DELIMITER //
CREATE TRIGGER update_device_last_seen
AFTER INSERT ON registrations
FOR EACH ROW
BEGIN
    UPDATE devices 
    SET last_seen = NOW() 
    WHERE name = NEW.device_name;
END //
DELIMITER ;

-- Trigger to log data integrity checks
DELIMITER //
CREATE TRIGGER log_data_integrity_check
AFTER INSERT ON data_integrity
FOR EACH ROW
BEGIN
    IF NEW.status = 'FAIL' THEN
        INSERT INTO system_logs (level, message, device_name, created_at)
        VALUES ('ERROR', CONCAT('Data integrity check failed: ', NEW.check_name), 'SYSTEM', NOW());
    END IF;
END //
DELIMITER ;

-- ========================================
-- Create Indexes for Performance
-- ========================================

-- Additional composite indexes for better query performance
CREATE INDEX idx_registrations_student_date ON registrations(student_id, registered_at);
CREATE INDEX idx_registrations_device_date ON registrations(device_name, registered_at);
CREATE INDEX idx_registrations_center_date ON registrations(center, registered_at);
CREATE INDEX idx_students_center_grade ON students(center, grade);
CREATE INDEX idx_students_grade_subject ON students(grade, subject);

-- ========================================
-- Final Setup
-- ========================================

-- Update table statistics
ANALYZE TABLE students;
ANALYZE TABLE registrations;
ANALYZE TABLE devices;
ANALYZE TABLE sync_queue;
ANALYZE TABLE system_logs;
ANALYZE TABLE data_integrity;
ANALYZE TABLE backup_history;
ANALYZE TABLE user_sessions;
ANALYZE TABLE system_config;

-- Show completion message
SELECT 'Database schema created successfully!' as message;
SELECT 'Tables created:' as info;
SHOW TABLES;
SELECT 'Views created:' as info;
SHOW FULL TABLES WHERE Table_type = 'VIEW';
SELECT 'Procedures created:' as info;
SHOW PROCEDURE STATUS WHERE Db = 'student_management';
