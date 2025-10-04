-- ========================================
-- Student Management System v2 - Sample Data
-- ========================================

USE student_management;

-- ========================================
-- Sample Students Data
-- ========================================
INSERT IGNORE INTO students (id, name, center, grade, subject, phone, parent_phone, email, address, fees, fees_1, session_sequence, guest_info) VALUES
-- Main Center Students
('STU001', 'Ahmed Ali Hassan', 'Main Center', 'Grade 10', 'Mathematics', '01234567890', '01234567891', 'ahmed.ali@example.com', '123 Main Street, Cairo', 500.00, 500.00, 'MATH-10-001', ''),
('STU002', 'Fatima Mohamed Ibrahim', 'Main Center', 'Grade 11', 'Physics', '01234567892', '01234567893', 'fatima.mohamed@example.com', '456 Oak Avenue, Cairo', 600.00, 600.00, 'PHYS-11-001', ''),
('STU003', 'Mohamed Omar Khalil', 'Main Center', 'Grade 9', 'Chemistry', '01234567894', '01234567895', 'mohamed.omar@example.com', '789 Pine Road, Cairo', 450.00, 450.00, 'CHEM-09-001', ''),
('STU004', 'Aisha Hassan Ali', 'Main Center', 'Grade 12', 'Biology', '01234567896', '01234567897', 'aisha.hassan@example.com', '321 Elm Street, Cairo', 700.00, 700.00, 'BIO-12-001', ''),
('STU005', 'Omar Khalil Mohamed', 'Main Center', 'Grade 10', 'English', '01234567898', '01234567899', 'omar.khalil@example.com', '654 Maple Drive, Cairo', 550.00, 550.00, 'ENG-10-001', ''),

-- Branch Center Students
('STU006', 'Mariam Ahmed Hassan', 'Branch Center', 'Grade 11', 'Mathematics', '01234567900', '01234567901', 'mariam.ahmed@example.com', '987 Cedar Lane, Alexandria', 600.00, 600.00, 'MATH-11-002', ''),
('STU007', 'Youssef Ibrahim Ali', 'Branch Center', 'Grade 9', 'Physics', '01234567902', '01234567903', 'youssef.ibrahim@example.com', '147 Birch Street, Alexandria', 450.00, 450.00, 'PHYS-09-002', ''),
('STU008', 'Nour Mohamed Omar', 'Branch Center', 'Grade 10', 'Chemistry', '01234567904', '01234567905', 'nour.mohamed@example.com', '258 Spruce Avenue, Alexandria', 500.00, 500.00, 'CHEM-10-002', ''),
('STU009', 'Khaled Hassan Khalil', 'Branch Center', 'Grade 12', 'Biology', '01234567906', '01234567907', 'khaled.hassan@example.com', '369 Willow Road, Alexandria', 700.00, 700.00, 'BIO-12-002', ''),
('STU010', 'Layla Ali Mohamed', 'Branch Center', 'Grade 11', 'English', '01234567908', '01234567909', 'layla.ali@example.com', '741 Poplar Drive, Alexandria', 600.00, 600.00, 'ENG-11-002', ''),

-- Additional Students for Testing
('STU011', 'Hassan Youssef Ibrahim', 'Main Center', 'Grade 9', 'Mathematics', '01234567910', '01234567911', 'hassan.youssef@example.com', '852 Oak Street, Cairo', 450.00, 450.00, 'MATH-09-003', ''),
('STU012', 'Sara Mohamed Ali', 'Main Center', 'Grade 10', 'Physics', '01234567912', '01234567913', 'sara.mohamed@example.com', '963 Pine Avenue, Cairo', 500.00, 500.00, 'PHYS-10-003', ''),
('STU013', 'Tarek Omar Hassan', 'Branch Center', 'Grade 11', 'Chemistry', '01234567914', '01234567915', 'tarek.omar@example.com', '159 Elm Road, Alexandria', 600.00, 600.00, 'CHEM-11-003', ''),
('STU014', 'Dina Khalil Mohamed', 'Main Center', 'Grade 12', 'Biology', '01234567916', '01234567917', 'dina.khalil@example.com', '357 Maple Lane, Cairo', 700.00, 700.00, 'BIO-12-003', ''),
('STU015', 'Amr Ibrahim Ali', 'Branch Center', 'Grade 9', 'English', '01234567918', '01234567919', 'amr.ibrahim@example.com', '468 Cedar Street, Alexandria', 450.00, 450.00, 'ENG-09-003', ''),

-- Guest Students
('GUEST001', 'Guest Student 1', 'Main Center', 'Grade 10', 'Mathematics', '01234567920', '01234567921', 'guest1@example.com', 'Temporary Address', 500.00, 500.00, 'GUEST-001', 'Guest student for testing'),
('GUEST002', 'Guest Student 2', 'Branch Center', 'Grade 11', 'Physics', '01234567922', '01234567923', 'guest2@example.com', 'Temporary Address', 600.00, 600.00, 'GUEST-002', 'Guest student for testing');

-- ========================================
-- Sample Devices Data
-- ========================================
INSERT IGNORE INTO devices (name, role, is_online, ip_address, user_agent) VALUES
('Scanner-01', 'entry_scanner', TRUE, '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
('Scanner-02', 'entry_scanner', TRUE, '192.168.1.101', 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15'),
('Validator-01', 'exit_validator', TRUE, '192.168.1.102', 'Mozilla/5.0 (Android 10; Mobile; rv:68.0) Gecko/68.0 Firefox/88.0'),
('Manager-01', 'manager', TRUE, '192.168.1.103', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'),
('Tablet-01', 'entry_scanner', FALSE, '192.168.1.104', 'Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36'),
('Mobile-01', 'entry_scanner', FALSE, '192.168.1.105', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15');

-- ========================================
-- Sample Registrations Data
-- ========================================
INSERT IGNORE INTO registrations (student_id, student_name, center, fees, homework_score, exam_score, extra_sessions, comment, payment_amount, device_name, entry_method, offline_mode, registered_at) VALUES
-- Recent registrations (today)
('STU001', 'Ahmed Ali Hassan', 'Main Center', 500.00, 85.5, 92.0, 0, 'Excellent performance', 500.00, 'Scanner-01', 'qr_scan', FALSE, NOW()),
('STU002', 'Fatima Mohamed Ibrahim', 'Main Center', 600.00, 78.0, 88.5, 1, 'Good progress', 600.00, 'Scanner-01', 'qr_scan', FALSE, NOW()),
('STU003', 'Mohamed Omar Khalil', 'Main Center', 450.00, 92.0, 95.0, 0, 'Outstanding work', 450.00, 'Scanner-02', 'qr_scan', FALSE, NOW()),
('STU004', 'Aisha Hassan Ali', 'Main Center', 700.00, 88.5, 90.0, 0, 'Very good', 700.00, 'Scanner-02', 'qr_scan', FALSE, NOW()),
('STU005', 'Omar Khalil Mohamed', 'Main Center', 550.00, 75.0, 82.0, 2, 'Needs improvement', 550.00, 'Scanner-01', 'manual', FALSE, NOW()),

-- Branch center registrations
('STU006', 'Mariam Ahmed Hassan', 'Branch Center', 600.00, 90.0, 94.0, 0, 'Excellent', 600.00, 'Tablet-01', 'qr_scan', TRUE, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
('STU007', 'Youssef Ibrahim Ali', 'Branch Center', 450.00, 82.5, 87.0, 1, 'Good work', 450.00, 'Tablet-01', 'qr_scan', TRUE, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
('STU008', 'Nour Mohamed Omar', 'Branch Center', 500.00, 95.0, 98.0, 0, 'Perfect score', 500.00, 'Mobile-01', 'manual', TRUE, DATE_SUB(NOW(), INTERVAL 3 HOUR)),
('STU009', 'Khaled Hassan Khalil', 'Branch Center', 700.00, 87.0, 91.0, 0, 'Very good', 700.00, 'Mobile-01', 'qr_scan', TRUE, DATE_SUB(NOW(), INTERVAL 4 HOUR)),
('STU010', 'Layla Ali Mohamed', 'Branch Center', 600.00, 89.5, 93.0, 0, 'Excellent', 600.00, 'Tablet-01', 'qr_scan', TRUE, DATE_SUB(NOW(), INTERVAL 5 HOUR)),

-- Additional registrations
('STU011', 'Hassan Youssef Ibrahim', 'Main Center', 450.00, 80.0, 85.0, 1, 'Good progress', 450.00, 'Scanner-01', 'qr_scan', FALSE, DATE_SUB(NOW(), INTERVAL 1 DAY)),
('STU012', 'Sara Mohamed Ali', 'Main Center', 500.00, 93.0, 96.0, 0, 'Outstanding', 500.00, 'Scanner-02', 'qr_scan', FALSE, DATE_SUB(NOW(), INTERVAL 1 DAY)),
('STU013', 'Tarek Omar Hassan', 'Branch Center', 600.00, 85.5, 89.0, 0, 'Very good', 600.00, 'Tablet-01', 'manual', TRUE, DATE_SUB(NOW(), INTERVAL 2 DAY)),
('STU014', 'Dina Khalil Mohamed', 'Main Center', 700.00, 91.0, 94.5, 0, 'Excellent', 700.00, 'Scanner-01', 'qr_scan', FALSE, DATE_SUB(NOW(), INTERVAL 2 DAY)),
('STU015', 'Amr Ibrahim Ali', 'Branch Center', 450.00, 77.0, 83.0, 2, 'Needs more practice', 450.00, 'Mobile-01', 'qr_scan', TRUE, DATE_SUB(NOW(), INTERVAL 3 DAY)),

-- Guest student registrations
('GUEST001', 'Guest Student 1', 'Main Center', 500.00, 0.0, NULL, 0, 'Guest student registration', 500.00, 'Scanner-01', 'manual', FALSE, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
('GUEST002', 'Guest Student 2', 'Branch Center', 600.00, 0.0, NULL, 0, 'Guest student registration', 600.00, 'Tablet-01', 'manual', TRUE, DATE_SUB(NOW(), INTERVAL 2 HOUR));

-- ========================================
-- Sample Sync Queue Data (for testing offline sync)
-- ========================================
INSERT IGNORE INTO sync_queue (device_name, action_type, data, status, retry_count) VALUES
('Tablet-01', 'create_registration', '{"student_id":"STU016","student_name":"Test Student","center":"Branch Center","fees":500.00,"device_name":"Tablet-01","entry_method":"manual"}', 'pending', 0),
('Mobile-01', 'create_registration', '{"student_id":"STU017","student_name":"Another Test Student","center":"Main Center","fees":600.00,"device_name":"Mobile-01","entry_method":"qr_scan"}', 'pending', 0);

-- ========================================
-- Sample System Logs
-- ========================================
INSERT IGNORE INTO system_logs (level, message, device_name, ip_address, created_at) VALUES
('INFO', 'System started successfully', 'SYSTEM', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
('INFO', 'Device Scanner-01 connected', 'Scanner-01', '192.168.1.100', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
('INFO', 'Device Scanner-02 connected', 'Scanner-02', '192.168.1.101', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
('INFO', 'Device Validator-01 connected', 'Validator-01', '192.168.1.102', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
('INFO', 'Device Manager-01 connected', 'Manager-01', '192.168.1.103', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
('WARN', 'Device Tablet-01 disconnected', 'Tablet-01', '192.168.1.104', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
('WARN', 'Device Mobile-01 disconnected', 'Mobile-01', '192.168.1.105', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
('INFO', 'Student STU001 registered successfully', 'Scanner-01', '192.168.1.100', DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
('INFO', 'Student STU002 registered successfully', 'Scanner-01', '192.168.1.100', DATE_SUB(NOW(), INTERVAL 25 MINUTE)),
('INFO', 'Student STU003 registered successfully', 'Scanner-02', '192.168.1.101', DATE_SUB(NOW(), INTERVAL 20 MINUTE));

-- ========================================
-- Sample Data Integrity Checks
-- ========================================
INSERT IGNORE INTO data_integrity (check_type, check_name, status, message, details) VALUES
('database', 'Database Connection', 'PASS', 'Database is accessible and responding', '{"response_time": "5ms", "connection_count": 1}'),
('tables', 'Students Table', 'PASS', 'Students table is accessible and has data', '{"row_count": 17, "table_size": "2.5KB"}'),
('tables', 'Registrations Table', 'PASS', 'Registrations table is accessible and has data', '{"row_count": 17, "table_size": "3.2KB"}'),
('tables', 'Devices Table', 'PASS', 'Devices table is accessible and has data', '{"row_count": 6, "table_size": "1.8KB"}'),
('sync', 'Sync Queue', 'PASS', 'Sync queue is working properly', '{"pending_items": 2, "completed_items": 0}'),
('devices', 'Online Devices', 'WARNING', 'Some devices are offline', '{"online_count": 4, "offline_count": 2}'),
('data', 'Student Data Quality', 'PASS', 'All student data is valid', '{"valid_students": 17, "invalid_students": 0}'),
('performance', 'Query Performance', 'PASS', 'Database queries are performing well', '{"average_query_time": "15ms", "slow_queries": 0}');

-- ========================================
-- Sample Backup History
-- ========================================
INSERT IGNORE INTO backup_history (backup_type, backup_name, file_path, file_size, status, created_at, completed_at) VALUES
('full', 'Initial Database Backup', '/backups/backup_20231201_120000.sql', 1024000, 'success', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
('incremental', 'Daily Backup', '/backups/backup_20231202_120000.sql', 512000, 'success', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR)),
('manual', 'Manual Backup Before Update', '/backups/backup_20231202_150000.sql', 768000, 'success', DATE_SUB(NOW(), INTERVAL 30 MINUTE), DATE_SUB(NOW(), INTERVAL 30 MINUTE));

-- ========================================
-- Sample User Sessions (for future authentication)
-- ========================================
INSERT IGNORE INTO user_sessions (session_id, user_id, device_name, ip_address, user_agent, is_active, expires_at) VALUES
('sess_abc123def456', 'admin', 'Manager-01', '192.168.1.103', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', TRUE, DATE_ADD(NOW(), INTERVAL 24 HOUR)),
('sess_xyz789uvw012', 'scanner_user', 'Scanner-01', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', TRUE, DATE_ADD(NOW(), INTERVAL 8 HOUR)),
('sess_mno345pqr678', 'validator_user', 'Validator-01', '192.168.1.102', 'Mozilla/5.0 (Android 10; Mobile; rv:68.0) Gecko/68.0 Firefox/88.0', TRUE, DATE_ADD(NOW(), INTERVAL 8 HOUR));

-- ========================================
-- Update Statistics
-- ========================================

-- Update table statistics for better performance
ANALYZE TABLE students;
ANALYZE TABLE registrations;
ANALYZE TABLE devices;
ANALYZE TABLE sync_queue;
ANALYZE TABLE system_logs;
ANALYZE TABLE data_integrity;
ANALYZE TABLE backup_history;
ANALYZE TABLE user_sessions;
ANALYZE TABLE system_config;

-- ========================================
-- Show Sample Data Summary
-- ========================================
SELECT 'Sample data imported successfully!' as message;
SELECT 'Data summary:' as info;
SELECT 
    'Students' as table_name,
    COUNT(*) as record_count
FROM students
UNION ALL
SELECT 
    'Registrations' as table_name,
    COUNT(*) as record_count
FROM registrations
UNION ALL
SELECT 
    'Devices' as table_name,
    COUNT(*) as record_count
FROM devices
UNION ALL
SELECT 
    'Sync Queue' as table_name,
    COUNT(*) as record_count
FROM sync_queue
UNION ALL
SELECT 
    'System Logs' as table_name,
    COUNT(*) as record_count
FROM system_logs
UNION ALL
SELECT 
    'Data Integrity' as table_name,
    COUNT(*) as record_count
FROM data_integrity
UNION ALL
SELECT 
    'Backup History' as table_name,
    COUNT(*) as record_count
FROM backup_history
UNION ALL
SELECT 
    'User Sessions' as table_name,
    COUNT(*) as record_count
FROM user_sessions;
