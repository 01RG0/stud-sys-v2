-- Sample data for testing
USE student_lab_system;

-- Insert sample students
INSERT IGNORE INTO students (id, name, center, grade, phone, parent_phone) VALUES
('STU001', 'Ahmed Ali', 'Main Center', 'Grade 10', '01234567890', '01234567891'),
('STU002', 'Fatima Hassan', 'Main Center', 'Grade 11', '01234567892', '01234567893'),
('STU003', 'Mohamed Omar', 'Branch Center', 'Grade 9', '01234567894', '01234567895'),
('STU004', 'Aisha Ibrahim', 'Main Center', 'Grade 12', '01234567896', '01234567897'),
('STU005', 'Omar Khalil', 'Branch Center', 'Grade 10', '01234567898', '01234567899');

-- Insert system configuration
INSERT IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES
('setup_completed', 'true', 'boolean', 'Setup completion flag'),
('system_version', '2.0.0', 'string', 'System version'),
('database_initialized', 'true', 'boolean', 'Database initialization flag');
