-- Student Lab System Database Schema
-- Created by setup script

CREATE DATABASE IF NOT EXISTS student_lab_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE student_lab_system;

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  center VARCHAR(255),
  grade VARCHAR(50),
  phone VARCHAR(20),
  parent_phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Entry registrations table
CREATE TABLE IF NOT EXISTS entry_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(50),
  student_name VARCHAR(255),
  center VARCHAR(255),
  device_name VARCHAR(100),
  entry_method ENUM('qr_scan', 'manual') DEFAULT 'qr_scan',
  offline_mode BOOLEAN DEFAULT FALSE,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_id (student_id),
  INDEX idx_registered_at (registered_at),
  INDEX idx_device_name (device_name)
);

-- Exit validations table
CREATE TABLE IF NOT EXISTS exit_validations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(50),
  student_name VARCHAR(255),
  center VARCHAR(255),
  device_name VARCHAR(100),
  validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_id (student_id),
  INDEX idx_validated_at (validated_at),
  INDEX idx_device_name (device_name)
);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  role ENUM('entry_scanner', 'exit_validator', 'manager') NOT NULL,
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
