#!/bin/bash

# ========================================
# Student Management System v2 - Launcher
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

echo
echo "========================================"
echo "  Student Management System v2"
echo "========================================"
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    echo "Please install Node.js from: https://nodejs.org/"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not available"
    echo "Please reinstall Node.js"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    print_warning "Dependencies not installed"
    print_status "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        print_error "Failed to install dependencies"
        exit 1
    fi
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found"
    print_status "Creating default .env file..."
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
    print_warning "Please edit .env file with your database credentials"
fi

# Check if MySQL is running
if command -v mysql &> /dev/null; then
    mysql -u root -e "SELECT 1" &> /dev/null
    if [ $? -ne 0 ]; then
        print_warning "MySQL is not running or not accessible"
        echo "Please start MySQL service:"
        echo "Ubuntu/Debian: sudo systemctl start mysql"
        echo "CentOS/RHEL: sudo systemctl start mysqld"
        echo "macOS: brew services start mysql"
        echo
    fi
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the server
print_status "Starting Student Management System v2..."
echo
echo "System URLs:"
echo "- Main Interface: http://localhost:3000"
echo "- Entry Scanner: http://localhost:3000/entry-scanner"
echo "- Exit Validator: http://localhost:3000/exit-validator"
echo "- Manager Dashboard: http://localhost:3000/manager"
echo
echo "Press Ctrl+C to stop the server"
echo

# Start the server
node System/server/main-server.js
