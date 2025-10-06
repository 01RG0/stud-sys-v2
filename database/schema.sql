-- Student Lab System Database Schema
-- Created by setup script

CREATE DATABASE IF NOT EXISTS student_lab_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE student_lab_system;

-- Students table
CREATE TABLE IF NOT EXISTS students (
  internal_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  id VARCHAR(50) NULL,
  name VARCHAR(255) NOT NULL,
  center VARCHAR(255),
  grade VARCHAR(50),
  phone VARCHAR(20),
  parent_phone VARCHAR(20),
  subject VARCHAR(255),
  fees DECIMAL(10,2) DEFAULT 0,
  fees_1 DECIMAL(10,2) DEFAULT 0,
  email VARCHAR(255),
  address TEXT,
  session_sequence TEXT,
  guest_info TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_name (name),
  INDEX idx_id (id),
  INDEX idx_name (name),
  INDEX idx_center (center),
  INDEX idx_grade (grade)
);

-- Entry registrations table
CREATE TABLE IF NOT EXISTS entry_registrations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(50),
  student_name VARCHAR(255) NOT NULL,
  center VARCHAR(255),
  grade VARCHAR(50),
  phone VARCHAR(20),
  parent_phone VARCHAR(20),
  subject VARCHAR(255),
  fees DECIMAL(10,2) DEFAULT 0,
  fees_1 DECIMAL(10,2) DEFAULT 0,
  homework_score INT DEFAULT 0,
  exam_score INT DEFAULT 0,
  extra_sessions INT DEFAULT 0,
  comment TEXT,
  error_detail TEXT,
  payment_amount DECIMAL(10,2) DEFAULT 0,
  device_name VARCHAR(100),
  entry_method ENUM('qr_scan', 'manual') DEFAULT 'qr_scan',
  offline_mode BOOLEAN DEFAULT FALSE,
  from_offline_sync BOOLEAN DEFAULT FALSE,
  sync_timestamp TIMESTAMP NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_id (student_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_device_name (device_name),
  INDEX idx_offline_mode (offline_mode),
  INDEX idx_sync_timestamp (sync_timestamp)
);

-- Exit validations table
CREATE TABLE IF NOT EXISTS exit_validations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(50),
  student_name VARCHAR(255) NOT NULL,
  center VARCHAR(255),
  device_name VARCHAR(100),
  status ENUM('validated', 'rejected', 'pending') DEFAULT 'validated',
  validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_id (student_id),
  INDEX idx_validated_at (validated_at),
  INDEX idx_device_name (device_name)
);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  role ENUM('first_scan', 'last_scan', 'admin_dashboard', 'data_collection_manager') NOT NULL,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT,
  config_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
