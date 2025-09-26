const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_lab_system',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Database initialization and schema creation
async function initializeDatabase() {
  try {
    console.log('🔗 Connecting to MySQL database...');
    
    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ MySQL connection established');
    connection.release();
    
    // Create database if it doesn't exist
    await createDatabase();
    
    // Create tables
    await createTables();
    
    console.log('✅ Database initialization completed');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    return false;
  }
}

async function createDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port
    });
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
    await connection.query(`USE \`${dbConfig.database}\``);
    await connection.end();
    
    console.log(`✅ Database '${dbConfig.database}' ready`);
  } catch (error) {
    console.error('❌ Database creation failed:', error.message);
    throw error;
  }
}

async function createTables() {
  try {
    // Students table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(50) DEFAULT '',
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
        PRIMARY KEY (id, name),
        INDEX idx_name (name),
        INDEX idx_center (center),
        INDEX idx_grade (grade)
      )
    `);
    
    // Entry registrations table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS entry_registrations (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        student_id VARCHAR(50) NOT NULL,
        student_name VARCHAR(255) NOT NULL,
        center VARCHAR(255),
        fees DECIMAL(10,2) DEFAULT 0,
        homework_score INT DEFAULT 0,
        exam_score INT DEFAULT NULL,
        error TEXT,
        extra_sessions INT DEFAULT 0,
        comment TEXT,
        error_detail TEXT,
        fees_1 DECIMAL(10,2) DEFAULT 0,
        subject VARCHAR(255),
        grade VARCHAR(50),
        session_sequence TEXT,
        guest_info TEXT,
        phone VARCHAR(20),
        parent_phone VARCHAR(20),
        payment_amount DECIMAL(10,2) DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        device_name VARCHAR(255),
        registered BOOLEAN DEFAULT TRUE,
        entry_method ENUM('qr_scan', 'manual') DEFAULT 'qr_scan',
        offline_mode BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_student_id (student_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_device_name (device_name),
        INDEX idx_offline_mode (offline_mode),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);
    
    // Exit validations table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS exit_validations (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        student_id VARCHAR(50) NOT NULL,
        student_name VARCHAR(255) NOT NULL,
        center VARCHAR(255),
        fees DECIMAL(10,2) DEFAULT 0,
        homework_score INT DEFAULT 0,
        exam_score INT DEFAULT NULL,
        error TEXT,
        extra_sessions INT DEFAULT 0,
        comment TEXT,
        error_detail TEXT,
        fees_1 DECIMAL(10,2) DEFAULT 0,
        subject VARCHAR(255),
        grade VARCHAR(50),
        session_sequence TEXT,
        guest_info TEXT,
        phone VARCHAR(20),
        parent_phone VARCHAR(20),
        payment_amount DECIMAL(10,2) DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        device_name VARCHAR(255),
        validated BOOLEAN DEFAULT TRUE,
        validation_method ENUM('qr_scan', 'manual') DEFAULT 'qr_scan',
        offline_mode BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_student_id (student_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_device_name (device_name),
        INDEX idx_offline_mode (offline_mode),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);
    
    // System logs table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        level ENUM('info', 'success', 'warning', 'error') NOT NULL,
        message TEXT NOT NULL,
        data JSON,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_level (level),
        INDEX idx_timestamp (timestamp)
      )
    `);
    
    // Device sessions table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS device_sessions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_name VARCHAR(255) NOT NULL,
        device_type ENUM('entry_scanner', 'exit_validator', 'admin_dashboard') NOT NULL,
        session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        session_end TIMESTAMP NULL,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        INDEX idx_device_name (device_name),
        INDEX idx_device_type (device_type),
        INDEX idx_is_active (is_active)
      )
    `);
    
    // Offline queue table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS offline_queue (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_name VARCHAR(255) NOT NULL,
        data_type ENUM('entry_registration', 'exit_validation', 'new_student') NOT NULL,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMP NULL,
        INDEX idx_device_name (device_name),
        INDEX idx_processed (processed),
        INDEX idx_created_at (created_at)
      )
    `);
    
    console.log('✅ All database tables created successfully');
  } catch (error) {
    console.error('❌ Table creation failed:', error.message);
    throw error;
  }
}

// Database helper functions
class Database {
  // Student operations
  static async getAllStudents() {
    try {
      const [rows] = await pool.execute('SELECT * FROM students ORDER BY name');
      return rows;
    } catch (error) {
      console.error('Error getting all students:', error);
      throw error;
    }
  }
  
  static async getStudentById(studentId) {
    try {
      const [rows] = await pool.execute('SELECT * FROM students WHERE id = ?', [studentId]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error getting student by ID:', error);
      throw error;
    }
  }
  
  static async createStudent(studentData) {
    try {
      const {
        id, name, center, grade, phone, parent_phone, subject, fees, email, address
      } = studentData;
      
      const result = await pool.execute(`
        INSERT INTO students (id, name, center, grade, phone, parent_phone, subject, fees, email, address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        center = VALUES(center),
        grade = VALUES(grade),
        phone = VALUES(phone),
        parent_phone = VALUES(parent_phone),
        subject = VALUES(subject),
        fees = VALUES(fees),
        email = VALUES(email),
        address = VALUES(address),
        updated_at = CURRENT_TIMESTAMP
      `, [
        id, 
        name || null, 
        center || null,
        grade || null,
        phone || null,
        parent_phone || null,
        subject || null,
        fees || 0,
        email || null,
        address || null
      ]);
      
      return result[0];
    } catch (error) {
      console.error('Error creating student:', error);
      throw error;
    }
  }
  
  // Entry registration operations
  static async createEntryRegistration(registrationData) {
    try {
      const {
        student_id, student_name, class: studentClass, section, roll_number, 
        device_name, homework_score, exam_score, timestamp
      } = registrationData;
      
      const [result] = await pool.execute(`
        INSERT INTO entry_registrations (
          student_id, student_name, class, section, roll_number, 
          device_name, homework_score, exam_score, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        student_id || null,
        student_name || null,
        studentClass || null,
        section || null,
        roll_number || null,
        device_name || null,
        homework_score || 0,
        exam_score || 0,
        timestamp ? new Date(timestamp) : new Date()
      ]);
      
      return result.insertId;
    } catch (error) {
      console.error('Error creating entry registration:', error);
      throw error;
    }
  }
  
  // Exit validation operations
  static async createExitValidation(validationData) {
    try {
      const {
        student_id, student_name, status, timestamp
      } = validationData;
      
      const [result] = await pool.execute(`
        INSERT INTO exit_validations (
          student_id, student_name, status, timestamp
        ) VALUES (?, ?, ?, ?)
      `, [
        student_id || null,
        student_name || null,
        status || null,
        timestamp ? new Date(timestamp) : new Date()
      ]);
      
      return result.insertId;
    } catch (error) {
      console.error('Error creating exit validation:', error);
      throw error;
    }
  }
  
  // System logs operations
  static async createSystemLog(level, message, data = null) {
    try {
      await pool.execute(
        'INSERT INTO system_logs (level, message, data) VALUES (?, ?, ?)',
        [level, message, data ? JSON.stringify(data) : null]
      );
    } catch (error) {
      console.error('Error creating system log:', error);
      throw error;
    }
  }
  
  // Device session operations
  static async createDeviceSession(deviceName, deviceType) {
    try {
      const [result] = await pool.execute(`
        INSERT INTO device_sessions (device_name, device_type, is_active)
        VALUES (?, ?, TRUE)
        ON DUPLICATE KEY UPDATE
        session_start = CURRENT_TIMESTAMP,
        last_activity = CURRENT_TIMESTAMP,
        is_active = TRUE
      `, [deviceName, deviceType]);
      
      return result.insertId;
    } catch (error) {
      console.error('Error creating device session:', error);
      throw error;
    }
  }
  
  static async updateDeviceActivity(deviceName) {
    try {
      await pool.execute(
        'UPDATE device_sessions SET last_activity = CURRENT_TIMESTAMP WHERE device_name = ? AND is_active = TRUE',
        [deviceName]
      );
    } catch (error) {
      console.error('Error updating device activity:', error);
      throw error;
    }
  }
  
  static async endDeviceSession(deviceName) {
    try {
      await pool.execute(
        'UPDATE device_sessions SET session_end = CURRENT_TIMESTAMP, is_active = FALSE WHERE device_name = ? AND is_active = TRUE',
        [deviceName]
      );
    } catch (error) {
      console.error('Error ending device session:', error);
      throw error;
    }
  }
  
  // Offline queue operations
  static async addToOfflineQueue(deviceName, dataType, data) {
    try {
      await pool.execute(
        'INSERT INTO offline_queue (device_name, data_type, data) VALUES (?, ?, ?)',
        [deviceName, dataType, JSON.stringify(data)]
      );
    } catch (error) {
      console.error('Error adding to offline queue:', error);
      throw error;
    }
  }
  
  static async getOfflineQueue(deviceName) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM offline_queue WHERE device_name = ? AND processed = FALSE ORDER BY created_at',
        [deviceName]
      );
      return rows;
    } catch (error) {
      console.error('Error getting offline queue:', error);
      throw error;
    }
  }
  
  static async markOfflineQueueProcessed(queueId) {
    try {
      await pool.execute(
        'UPDATE offline_queue SET processed = TRUE, processed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [queueId]
      );
    } catch (error) {
      console.error('Error marking offline queue as processed:', error);
      throw error;
    }
  }
  
  // Statistics operations
  static async getRegistrationStats() {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          COUNT(*) as total_registrations,
          COUNT(CASE WHEN offline_mode = TRUE THEN 1 END) as offline_registrations,
          COUNT(CASE WHEN DATE(timestamp) = CURDATE() THEN 1 END) as today_registrations
        FROM entry_registrations
      `);
      return rows[0];
    } catch (error) {
      console.error('Error getting registration stats:', error);
      throw error;
    }
  }
  
  static async getValidationStats() {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          COUNT(*) as total_validations,
          COUNT(CASE WHEN offline_mode = TRUE THEN 1 END) as offline_validations,
          COUNT(CASE WHEN DATE(timestamp) = CURDATE() THEN 1 END) as today_validations
        FROM exit_validations
      `);
      return rows[0];
    } catch (error) {
      console.error('Error getting validation stats:', error);
      throw error;
    }
  }
  
  // Get registrations by date
  static async getEntryRegistrationsByDate(date) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM entry_registrations WHERE DATE(timestamp) = ? ORDER BY timestamp DESC',
        [date]
      );
      return rows;
    } catch (error) {
      console.error('Error getting entry registrations by date:', error);
      throw error;
    }
  }

  // Get all registrations
  static async getAllEntryRegistrations() {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM entry_registrations ORDER BY timestamp DESC'
      );
      return rows;
    } catch (error) {
      console.error('Error getting all entry registrations:', error);
      throw error;
    }
  }

  // Get all exit validations
  static async getAllExitValidations() {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM exit_validations ORDER BY timestamp DESC'
      );
      return rows;
    } catch (error) {
      console.error('Error getting all exit validations:', error);
      throw error;
    }
  }
  
  // Get validations by date
  static async getExitValidationsByDate(date) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM exit_validations WHERE DATE(timestamp) = ? ORDER BY timestamp DESC',
        [date]
      );
      return rows;
    } catch (error) {
      console.error('Error getting exit validations by date:', error);
      throw error;
    }
  }
  
  // Delete student
  static async deleteStudent(id) {
    try {
      await pool.execute('DELETE FROM students WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting student:', error);
      throw error;
    }
  }
  
  // Close connection pool
  static async close() {
    try {
      await pool.end();
      console.log('✅ Database connection pool closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
}

module.exports = {
  initializeDatabase,
  Database,
  pool
};
