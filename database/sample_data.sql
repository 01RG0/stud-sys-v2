-- Sample data for testing
USE student_lab_system;

-- Insert sample students
INSERT IGNORE INTO students (id, name, center, grade, phone, parent_phone, subject, fees, email) VALUES
('STU001', 'Ahmed Ali', 'Main Center', 'Grade 10', '01234567890', '01234567891', 'Mathematics', 500.00, 'ahmed@example.com'),
('STU002', 'Fatima Hassan', 'Main Center', 'Grade 11', '01234567892', '01234567893', 'Physics', 600.00, 'fatima@example.com'),
('STU003', 'Mohamed Omar', 'Branch Center', 'Grade 9', '01234567894', '01234567895', 'Chemistry', 450.00, 'mohamed@example.com'),
('STU004', 'Aisha Ibrahim', 'Main Center', 'Grade 12', '01234567896', '01234567897', 'Biology', 700.00, 'aisha@example.com'),
('STU005', 'Omar Khalil', 'Branch Center', 'Grade 10', '01234567898', '01234567899', 'English', 550.00, 'omar@example.com'),
('STU006', 'Sara Ahmed', 'Main Center', 'Grade 11', '01234567900', '01234567901', 'Mathematics', 600.00, 'sara@example.com'),
('STU007', 'Youssef Hassan', 'Branch Center', 'Grade 9', '01234567902', '01234567903', 'Physics', 450.00, 'youssef@example.com'),
('STU008', 'Layla Mohamed', 'Main Center', 'Grade 12', '01234567904', '01234567905', 'Chemistry', 700.00, 'layla@example.com');

-- Insert sample entry registrations (for testing offline sync)
INSERT IGNORE INTO entry_registrations (student_id, student_name, center, grade, phone, parent_phone, subject, fees, homework_score, exam_score, device_name, entry_method, offline_mode, from_offline_sync, timestamp) VALUES
('STU001', 'Ahmed Ali', 'Main Center', 'Grade 10', '01234567890', '01234567891', 'Mathematics', 500.00, 85, 90, 'Entry-Scanner-01', 'qr_scan', FALSE, FALSE, NOW()),
('STU002', 'Fatima Hassan', 'Main Center', 'Grade 11', '01234567892', '01234567893', 'Physics', 600.00, 92, 88, 'Entry-Scanner-01', 'qr_scan', FALSE, FALSE, NOW()),
('STU003', 'Mohamed Omar', 'Branch Center', 'Grade 9', '01234567894', '01234567895', 'Chemistry', 450.00, 78, 85, 'Entry-Scanner-02', 'manual', TRUE, TRUE, NOW());

-- Insert system configuration
INSERT IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES
('setup_completed', 'true', 'boolean', 'Setup completion flag'),
('system_version', '2.0.0', 'string', 'System version'),
('database_initialized', 'true', 'boolean', 'Database initialization flag'),
('offline_sync_enabled', 'true', 'boolean', 'Offline synchronization enabled'),
('real_ip_detection', 'true', 'boolean', 'Real IP detection enabled'),
('live_logs_enabled', 'true', 'boolean', 'Live server logs enabled');
