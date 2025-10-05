# Student Management System v2

A comprehensive student management system with QR code scanning, manual entry, offline support, and real-time synchronization.

# Custom MySQL password
.\setup.ps1 -MySQLPassword "MyCustomPassword"

## 🚀 Features

- **QR Code Scanning**: Quick student registration using QR codes
- **Manual Entry**: Manual student registration with bulletproof data protection
- **Offline Support**: Works offline with automatic sync when reconnected
- **Real-time Sync**: WebSocket-based real-time data synchronization
- **Massive Data Handling**: Supports 1M+ students with chunked storage
- **Zero Data Loss**: Multiple backup layers ensure no data loss
- **Multi-device Support**: Multiple devices can connect and sync
- **Excel Import**: Import student data from Excel files with intelligent column mapping

## 📋 System Requirements

- **Node.js**: Version 16 or higher
- **MySQL**: Version 8.0 or higher
- **Modern Web Browser**: Chrome, Firefox, Safari, or Edge
- **Camera Access**: For QR code scanning
- **Internet Connection**: For real-time sync (works offline too)

## 🛠️ Installation & Setup

### Option 1: Quick Setup (Recommended)
1. Download and run `setup.bat` (Windows) or `setup.sh` (Linux/Mac)
2. Follow the on-screen instructions
3. The script will automatically install and configure everything

### Option 2: Manual Setup

#### 1. Install MySQL
- Download MySQL from [mysql.com](https://dev.mysql.com/downloads/mysql/)
- Install with default settings
- Remember the root password you set during installation

#### 2. Install Node.js
- Download Node.js from [nodejs.org](https://nodejs.org/)
- Install with default settings

#### 3. Clone/Download Project
```bash
git clone <repository-url>
cd stud-sys-v2
```

#### 4. Install Dependencies
```bash
npm install
```

#### 5. Database Setup
```bash
# Create database
mysql -u root -p < database/schema.sql

# Import sample data (optional)
mysql -u root -p < database/sample_data.sql
```

#### 6. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your database credentials
```

#### 7. Start the System
```bash
# Start the server
npm start

# Or use the launcher
./LAUNCHER.bat  # Windows
./LAUNCHER.sh   # Linux/Mac
```

## 🗄️ Database Configuration

### MySQL Setup
1. **Install MySQL Server**
2. **Create Database**:
   ```sql
   CREATE DATABASE student_management;
   USE student_management;
   ```
3. **Import Schema**:
   ```sql
   SOURCE database/schema.sql;
   ```
4. **Create User** (Optional):
   ```sql
   CREATE USER 'student_user'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON student_management.* TO 'student_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Environment Variables
Create a `.env` file in the project root:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=student_management
DB_USER=root
DB_PASSWORD=your_mysql_password

# Server Configuration
PORT=3000
NODE_ENV=development

# WebSocket Configuration
WS_PORT=3000
```

## 🚀 Usage

### 1. Start the System
```bash
# Windows
LAUNCHER.bat

# Linux/Mac
./LAUNCHER.sh

# Or manually
npm start
```

### 2. Access the System
- **Main Interface**: http://localhost:3000
- **Entry Scanner**: http://localhost:3000/entry-scanner
- **Exit Validator**: http://localhost:3000/exit-validator
- **Manager Dashboard**: http://localhost:3000/manager

### 3. Device Setup
1. Open Entry Scanner in your browser
2. Enter device name (e.g., "Scanner-1", "Tablet-2")
3. Allow camera access for QR scanning
4. Start scanning or manual entry

## 📱 Device Management

### Entry Scanner
- **QR Code Scanning**: Point camera at student QR codes
- **Manual Entry**: Add students manually with form
- **Offline Mode**: Works without internet connection
- **Auto Sync**: Automatically syncs when connected

### Exit Validator
- **Student Validation**: Verify student exit
- **Real-time Updates**: Receives student data from scanners
- **Status Monitoring**: Shows connection and sync status

### Manager Dashboard
- **Overview**: System status and statistics
- **Device Management**: Monitor connected devices
- **Data Export**: Export student data
- **Settings**: Configure system parameters

## 🔧 Advanced Features

### Offline Support
- **Automatic Detection**: Detects when offline
- **Local Storage**: Stores data locally when offline
- **Auto Sync**: Syncs when connection restored
- **Zero Data Loss**: Multiple backup layers

### Massive Data Handling
- **Chunked Storage**: Handles 1M+ students
- **Batch Processing**: Efficient data processing
- **Progress Tracking**: Real-time sync progress
- **Memory Optimization**: Optimized for large datasets

### Excel Import
- **Intelligent Mapping**: Auto-detects column names
- **Case Insensitive**: Handles any column name format
- **Data Validation**: Validates and cleans data
- **Quality Assessment**: Analyzes data quality

## 🛡️ Data Protection

### Bulletproof Manual Entry
- **Instant Backup**: Immediate backup of form data
- **Emergency Backup**: Fallback on errors
- **Last Resort Backup**: Memory-based final backup
- **Data Validation**: Comprehensive data validation

### Sync Protection
- **Duplicate Prevention**: Prevents duplicate entries
- **Retry Logic**: Automatic retry on failures
- **Progress Recovery**: Resumes from last position
- **Integrity Checks**: Data integrity verification

## 🔍 Troubleshooting

### Common Issues

#### 1. MySQL Connection Error
```bash
# Check MySQL service
sudo systemctl status mysql  # Linux
net start mysql              # Windows

# Test connection
mysql -u root -p
```

#### 2. Port Already in Use
```bash
# Find process using port 3000
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Linux/Mac

# Kill process
taskkill /PID <PID> /F        # Windows
kill -9 <PID>                 # Linux/Mac
```

#### 3. Camera Not Working
- Check browser permissions
- Ensure camera is not used by another application
- Try different browser
- Check camera drivers

#### 4. Offline Sync Issues
- Check network connection
- Verify WebSocket connection
- Check browser console for errors
- Use debug mode: `Ctrl+Shift+D`

### Debug Commands
- **`Ctrl+Shift+D`**: Show debug status
- **`Ctrl+Shift+S`**: Force sync all students
- **Right-click sync button**: Show sync details

## 📊 Performance

### System Capacity
- **Students**: 1,000,000+ supported
- **Devices**: Unlimited concurrent devices
- **Sync Speed**: ~2000 records/minute
- **Storage**: Unlimited with chunked storage
- **Memory**: Optimized for large datasets

### Browser Support
- **Chrome**: 90+ (Recommended)
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

## 🔐 Security

### Data Protection
- **Local Storage**: Encrypted local storage
- **Backup Layers**: Multiple backup systems
- **Validation**: Input validation and sanitization
- **Error Handling**: Secure error handling

### Network Security
- **WebSocket**: Secure WebSocket connections
- **HTTPS**: SSL/TLS encryption support
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request rate limiting

## 📈 Monitoring

### System Status
- **Connection Status**: Real-time connection monitoring
- **Sync Status**: Data synchronization status
- **Device Status**: Connected device monitoring
- **Performance Metrics**: System performance tracking

### Logs
- **Server Logs**: `logs/server.log`
- **Error Logs**: `logs/error.log`
- **Access Logs**: `logs/access.log`
- **Debug Logs**: Browser console

## 🤝 Support

### Getting Help
1. Check this README
2. Review troubleshooting section
3. Check browser console for errors
4. Use debug commands
5. Contact support team

### Contributing
1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🎯 Quick Start Checklist

- [ ] Install MySQL
- [ ] Install Node.js
- [ ] Run setup script
- [ ] Configure database
- [ ] Start the system
- [ ] Test with sample data
- [ ] Configure devices
- [ ] Start using the system

## 🔄 Updates

### Version History
- **v2.0**: Complete rewrite with offline support
- **v1.5**: Added Excel import
- **v1.0**: Initial release

### Update Process
1. Backup your data
2. Download new version
3. Run update script
4. Test functionality
5. Restore data if needed

---

**Need Help?** Check the troubleshooting section or contact support.

**Happy Scanning!** 🎉