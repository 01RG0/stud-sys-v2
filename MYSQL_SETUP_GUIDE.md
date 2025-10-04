# MySQL Setup Guide for Student Management System v2

This guide will help you set up MySQL on a fresh device for the Student Management System v2.

## 🚀 Quick Setup (Recommended)

### Windows
1. Run `setup.bat` - This will automatically install and configure everything
2. Follow the on-screen instructions
3. The script will handle MySQL installation and configuration

### Linux/Mac
1. Run `./setup.sh` - This will automatically install and configure everything
2. Follow the on-screen instructions
3. The script will handle MySQL installation and configuration

## 🛠️ Manual MySQL Installation

### Windows

#### Option 1: MySQL Installer (Recommended)
1. **Download MySQL Installer**
   - Go to [MySQL Downloads](https://dev.mysql.com/downloads/installer/)
   - Download "MySQL Installer for Windows"
   - Choose the web installer (smaller download)

2. **Run the Installer**
   - Run the downloaded `.msi` file
   - Choose "Developer Default" setup type
   - Click "Next" through the installation

3. **Configure MySQL Server**
   - Set root password (remember this!)
   - Choose "Standalone MySQL Server"
   - Use default port 3306
   - Complete the installation

#### Option 2: XAMPP (Alternative)
1. **Download XAMPP**
   - Go to [XAMPP Downloads](https://www.apachefriends.org/download.html)
   - Download XAMPP for Windows
   - Run the installer

2. **Start MySQL**
   - Open XAMPP Control Panel
   - Start MySQL service
   - Default root password is empty

### Linux (Ubuntu/Debian)

```bash
# Update package list
sudo apt update

# Install MySQL Server
sudo apt install mysql-server

# Secure the installation
sudo mysql_secure_installation

# Start MySQL service
sudo systemctl start mysql
sudo systemctl enable mysql

# Check status
sudo systemctl status mysql
```

### Linux (CentOS/RHEL)

```bash
# Install MySQL Server
sudo yum install mysql-server

# Start MySQL service
sudo systemctl start mysqld
sudo systemctl enable mysqld

# Get temporary password
sudo grep 'temporary password' /var/log/mysqld.log

# Secure the installation
sudo mysql_secure_installation
```

### macOS

#### Option 1: Homebrew (Recommended)
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install MySQL
brew install mysql

# Start MySQL service
brew services start mysql

# Secure the installation
mysql_secure_installation
```

#### Option 2: MySQL Installer
1. Download MySQL from [MySQL Downloads](https://dev.mysql.com/downloads/mysql/)
2. Run the `.dmg` installer
3. Follow the installation wizard
4. Set root password during installation

## 🔧 Database Configuration

### 1. Create Database and User

```sql
-- Connect to MySQL as root
mysql -u root -p

-- Create database
CREATE DATABASE student_management;

-- Create user (optional, for security)
CREATE USER 'student_user'@'localhost' IDENTIFIED BY 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON student_management.* TO 'student_user'@'localhost';

-- Flush privileges
FLUSH PRIVILEGES;

-- Exit MySQL
EXIT;
```

### 2. Import Database Schema

```bash
# Import schema
mysql -u root -p student_management < database/schema.sql

# Import sample data (optional)
mysql -u root -p student_management < database/sample_data.sql
```

### 3. Verify Installation

```sql
-- Connect to the database
mysql -u root -p student_management

-- Check tables
SHOW TABLES;

-- Check students table
DESCRIBE students;

-- Check registrations table
DESCRIBE registrations;

-- Check devices table
DESCRIBE devices;

-- Exit
EXIT;
```

## 🔐 Security Configuration

### 1. Create Application User (Recommended)

```sql
-- Connect as root
mysql -u root -p

-- Create application user
CREATE USER 'student_app'@'localhost' IDENTIFIED BY 'secure_app_password';

-- Grant only necessary privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON student_management.* TO 'student_app'@'localhost';

-- Flush privileges
FLUSH PRIVILEGES;
```

### 2. Update Environment Configuration

Edit `.env` file:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=student_management
DB_USER=student_app
DB_PASSWORD=secure_app_password
```

### 3. Firewall Configuration (Linux)

```bash
# Allow MySQL connections (if needed)
sudo ufw allow 3306/tcp

# Or for specific IP
sudo ufw allow from 192.168.1.0/24 to any port 3306
```

## 🧪 Testing the Installation

### 1. Test Connection

```bash
# Test connection with root
mysql -u root -p

# Test connection with application user
mysql -u student_app -p student_management
```

### 2. Test Database Operations

```sql
-- Insert test student
INSERT INTO students (id, name, center, grade, subject, phone, fees) 
VALUES ('TEST001', 'Test Student', 'Test Center', 'Grade 10', 'Mathematics', '01234567890', 500.00);

-- Insert test registration
INSERT INTO registrations (student_id, student_name, center, device_name, entry_method) 
VALUES ('TEST001', 'Test Student', 'Test Center', 'Test Device', 'manual');

-- Query data
SELECT * FROM students WHERE id = 'TEST001';
SELECT * FROM registrations WHERE student_id = 'TEST001';

-- Clean up test data
DELETE FROM registrations WHERE student_id = 'TEST001';
DELETE FROM students WHERE id = 'TEST001';
```

## 🔧 Troubleshooting

### Common Issues

#### 1. MySQL Service Not Starting

**Windows:**
```cmd
# Check service status
sc query mysql

# Start service
net start mysql

# Or use Services.msc
```

**Linux:**
```bash
# Check status
sudo systemctl status mysql

# Start service
sudo systemctl start mysql

# Check logs
sudo journalctl -u mysql
```

#### 2. Connection Refused

```bash
# Check if MySQL is listening
netstat -an | grep 3306

# Check MySQL configuration
sudo cat /etc/mysql/mysql.conf.d/mysqld.cnf | grep bind-address
```

#### 3. Access Denied

```sql
-- Reset root password (if needed)
ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';

-- Check user privileges
SHOW GRANTS FOR 'student_app'@'localhost';
```

#### 4. Database Not Found

```sql
-- List databases
SHOW DATABASES;

-- Create database if missing
CREATE DATABASE student_management;
```

### Performance Optimization

#### 1. MySQL Configuration

Edit `/etc/mysql/mysql.conf.d/mysqld.cnf` (Linux) or `my.ini` (Windows):

```ini
[mysqld]
# Basic settings
max_connections = 200
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2

# Query cache
query_cache_type = 1
query_cache_size = 64M

# Slow query log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
```

#### 2. Index Optimization

```sql
-- Add indexes for better performance
ALTER TABLE registrations ADD INDEX idx_student_id (student_id);
ALTER TABLE registrations ADD INDEX idx_registered_at (registered_at);
ALTER TABLE registrations ADD INDEX idx_device_name (device_name);
```

## 📊 Monitoring

### 1. Check Database Status

```sql
-- Show process list
SHOW PROCESSLIST;

-- Show status
SHOW STATUS;

-- Show variables
SHOW VARIABLES;
```

### 2. Monitor Performance

```sql
-- Check table sizes
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'student_management';

-- Check slow queries
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;
```

## 🔄 Backup and Recovery

### 1. Create Backup

```bash
# Full database backup
mysqldump -u root -p student_management > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup with compression
mysqldump -u root -p student_management | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 2. Restore Backup

```bash
# Restore from backup
mysql -u root -p student_management < backup_20231201_120000.sql

# Restore from compressed backup
gunzip < backup_20231201_120000.sql.gz | mysql -u root -p student_management
```

### 3. Automated Backup Script

Create `backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DB_NAME="student_management"
DB_USER="root"
DB_PASS="your_password"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
```

## ✅ Verification Checklist

- [ ] MySQL server is installed and running
- [ ] Database `student_management` is created
- [ ] Tables `students`, `registrations`, and `devices` exist
- [ ] Application user has proper privileges
- [ ] Environment variables are configured
- [ ] Connection test is successful
- [ ] Sample data is imported (optional)
- [ ] Backup strategy is in place

## 🆘 Getting Help

### Resources
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [MySQL Community Forums](https://forums.mysql.com/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/mysql)

### Support Commands
```bash
# Check MySQL version
mysql --version

# Check MySQL service status
sudo systemctl status mysql

# Check MySQL logs
sudo tail -f /var/log/mysql/error.log
```

---

**Need Help?** Check the troubleshooting section or contact support.

**Happy Database Setup!** 🎉
