#!/bin/bash

# ========================================
# Student Management System v2 - Setup Script
# ========================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "\n${BLUE}[STEP $1/8]${NC} $2"
}

# Function to wait for user input
wait_for_user() {
    echo
    echo "Press Enter to continue..."
    read
}

echo
echo "========================================"
echo "  Student Management System v2 Setup"
echo "========================================"
echo

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    print_warning "Running as root. Some operations may require sudo."
else
    print_status "Running as regular user. Some operations may require sudo."
fi

# Check if Node.js is installed
print_step "1/8" "Checking Node.js installation..."
if command -v node &> /dev/null; then
    print_success "Node.js is already installed"
    node --version
else
    print_error "Node.js is not installed"
    echo
    echo "Please install Node.js:"
    echo "Ubuntu/Debian: sudo apt update && sudo apt install nodejs npm"
    echo "CentOS/RHEL: sudo yum install nodejs npm"
    echo "macOS: brew install node"
    echo "Or download from: https://nodejs.org/"
    echo
    wait_for_user
    exit 1
fi

# Check if npm is available
echo
print_step "2/8" "Checking npm installation..."
if command -v npm &> /dev/null; then
    print_success "npm is available"
    npm --version
else
    print_error "npm is not available"
    echo "Please reinstall Node.js"
    wait_for_user
    exit 1
fi

# Check if MySQL is installed
echo
print_step "3/8" "Checking MySQL installation..."
if command -v mysql &> /dev/null; then
    print_success "MySQL is already installed"
    mysql --version
    MYSQL_INSTALLED=1
else
    print_warning "MySQL is not installed or not in PATH"
    echo
    echo "Please install MySQL:"
    echo "Ubuntu/Debian: sudo apt update && sudo apt install mysql-server"
    echo "CentOS/RHEL: sudo yum install mysql-server"
    echo "macOS: brew install mysql"
    echo "Or download from: https://dev.mysql.com/downloads/mysql/"
    echo
    echo "After installation, restart this script"
    MYSQL_INSTALLED=0
    wait_for_user
fi

# Install Node.js dependencies
echo
print_step "4/8" "Installing Node.js dependencies..."
if [ -f "package.json" ]; then
    print_status "Installing dependencies from package.json..."
    npm install
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        echo "Please check your internet connection and try again"
        wait_for_user
        exit 1
    fi
else
    print_warning "package.json not found"
    print_status "Creating basic package.json..."
    cat > package.json << EOF
{
  "name": "student-management-system",
  "version": "2.0.0",
  "description": "Student Management System with QR Scanning",
  "main": "System/server/main-server.js",
  "scripts": {
    "start": "node System/server/main-server.js",
    "dev": "nodemon System/server/main-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.13.0",
    "mysql2": "^3.6.0",
    "multer": "^1.4.5-lts.1",
    "xlsx": "^0.18.5",
    "cors": "^2.8.5"
  }
}
EOF
    
    print_status "Installing dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        wait_for_user
        exit 1
    fi
fi

# Create database directory and files
echo
print_step "5/8" "Setting up database files..."
mkdir -p database

# Create database schema
print_status "Creating database schema..."
cat > database/schema.sql << 'EOF'
-- Student Management System Database Schema
-- Created by setup script

CREATE DATABASE IF NOT EXISTS student_management;
USE student_management;

-- Students table
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Registrations table
CREATE TABLE IF NOT EXISTS registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  center VARCHAR(255),
  fees DECIMAL(10,2) DEFAULT 0,
  homework_score DECIMAL(5,2) DEFAULT 0,
  exam_score DECIMAL(5,2),
  extra_sessions INT DEFAULT 0,
  comment TEXT,
  payment_amount DECIMAL(10,2) DEFAULT 0,
  device_name VARCHAR(100),
  entry_method ENUM('qr_scan', 'manual') DEFAULT 'qr_scan',
  offline_mode BOOLEAN DEFAULT FALSE,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_id (student_id),
  INDEX idx_registered_at (registered_at),
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
EOF

# Create sample data
print_status "Creating sample data..."
cat > database/sample_data.sql << 'EOF'
-- Sample data for testing
USE student_management;

-- Insert sample students
INSERT IGNORE INTO students (id, name, center, grade, subject, phone, parent_phone, email, fees) VALUES
('STU001', 'Ahmed Ali', 'Main Center', 'Grade 10', 'Mathematics', '01234567890', '01234567891', 'ahmed@example.com', 500.00),
('STU002', 'Fatima Hassan', 'Main Center', 'Grade 11', 'Physics', '01234567892', '01234567893', 'fatima@example.com', 600.00),
('STU003', 'Mohamed Omar', 'Branch Center', 'Grade 9', 'Chemistry', '01234567894', '01234567895', 'mohamed@example.com', 450.00),
('STU004', 'Aisha Ibrahim', 'Main Center', 'Grade 12', 'Biology', '01234567896', '01234567897', 'aisha@example.com', 700.00),
('STU005', 'Omar Khalil', 'Branch Center', 'Grade 10', 'English', '01234567898', '01234567899', 'omar@example.com', 550.00);
EOF

print_success "Database files created"

# Create environment file
echo
print_step "6/8" "Creating environment configuration..."
if [ ! -f ".env" ]; then
    print_status "Creating .env file..."
    cat > .env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=student_management
DB_USER=root
DB_PASSWORD=

# Server Configuration
PORT=3000
NODE_ENV=development

# WebSocket Configuration
WS_PORT=3000
EOF
    print_success ".env file created"
else
    print_status ".env file already exists"
fi

# Database setup
echo
print_step "7/8" "Setting up database..."
if [ $MYSQL_INSTALLED -eq 1 ]; then
    echo -n "Please enter your MySQL root password: "
    read -s MYSQL_PASSWORD
    echo
    
    print_status "Creating database and tables..."
    mysql -u root -p$MYSQL_PASSWORD < database/schema.sql
    if [ $? -eq 0 ]; then
        print_success "Database created successfully"
        
        print_status "Importing sample data..."
        mysql -u root -p$MYSQL_PASSWORD < database/sample_data.sql
        if [ $? -eq 0 ]; then
            print_success "Sample data imported successfully"
        else
            print_warning "Failed to import sample data (this is optional)"
        fi
        
        print_status "Updating .env file with database password..."
        sed -i "s/DB_PASSWORD=/DB_PASSWORD=$MYSQL_PASSWORD/" .env
        
    else
        print_error "Failed to create database"
        echo "Please check your MySQL password and try again"
        wait_for_user
        exit 1
    fi
else
    print_warning "MySQL not available, skipping database setup"
    echo "Please run this script again after installing MySQL"
fi

# Create logs directory
echo
print_step "8/8" "Creating logs directory..."
mkdir -p logs
print_success "Logs directory created"

# Final setup
echo
echo "========================================"
echo "   Setup Complete!"
echo "========================================"
echo
print_success "Student Management System v2 has been set up successfully!"
echo
echo "Next steps:"
echo "1. Edit .env file if needed (database password, etc.)"
echo "2. Run ./LAUNCHER.sh to start the system"
echo "3. Open http://localhost:3000 in your browser"
echo "4. Start using the system!"
echo
echo "System URLs:"
echo "- Main Interface: http://localhost:3000"
echo "- Entry Scanner: http://localhost:3000/entry-scanner"
echo "- Exit Validator: http://localhost:3000/exit-validator"
echo "- Manager Dashboard: http://localhost:3000/manager"
echo
echo "Debug Commands:"
echo "- Ctrl+Shift+D: Show debug status"
echo "- Ctrl+Shift+S: Force sync all students"
echo
echo "For support, check the README.md file"
echo

# Ask if user wants to start the system
echo -n "Do you want to start the system now? (y/n): "
read START_NOW
if [[ $START_NOW == "y" || $START_NOW == "Y" ]]; then
    echo
    print_status "Starting the system..."
    echo
    chmod +x LAUNCHER.sh
    ./LAUNCHER.sh
else
    echo
    print_status "You can start the system later by running ./LAUNCHER.sh"
fi

echo
print_success "Setup completed successfully!"
echo
