# MySQL Setup Guide for Student Lab System

## Prerequisites
- MySQL Server 8.0+ is installed (✅ Detected on your system)
- Node.js and npm are installed

## Quick Setup

### Option 1: Use MySQL without password (Recommended for testing)

1. **Start MySQL Service:**
   ```bash
   # Windows (Run as Administrator)
   net start mysql80
   ```

2. **Connect to MySQL:**
   ```bash
   mysql -u root
   ```

3. **Create Database:**
   ```sql
   CREATE DATABASE IF NOT EXISTS student_lab_system;
   USE student_lab_system;
   ```

4. **Run the Test:**
   ```bash
   TEST_MYSQL_INTEGRATION.bat
   ```

### Option 2: Use MySQL with password

1. **Set MySQL root password:**
   ```bash
   mysql -u root
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'your_password';
   FLUSH PRIVILEGES;
   ```

2. **Update configuration:**
   - Edit `System/server/.env` (create if it doesn't exist)
   - Set `DB_PASSWORD=your_password`

3. **Run the Test:**
   ```bash
   TEST_MYSQL_INTEGRATION.bat
   ```

## Troubleshooting

### MySQL Service Not Running
```bash
# Check if MySQL service is running
sc query mysql80

# Start MySQL service
net start mysql80
```

### Access Denied Error
- Make sure MySQL service is running
- Check if root user has password set
- Try connecting manually: `mysql -u root -p`

### Database Already Exists
The system will automatically create the database and tables if they don't exist.

## Database Schema

The system will automatically create these tables:
- `students` - Student information
- `entry_registrations` - Entry scanning records  
- `exit_validations` - Exit validation records
- `offline_queue` - Offline operation queue

## Testing

Run the integration test to verify everything works:
```bash
TEST_MYSQL_INTEGRATION.bat
```

Expected output:
- ✅ Database initialized successfully
- ✅ Student created successfully
- ✅ Retrieved X students
- ✅ Registration created successfully
- ✅ Retrieved X registrations for today
- ✅ Validation created successfully
- ✅ Retrieved X validations for today
- ✅ Test data cleaned up

## Production Setup

For production use:
1. Set a strong MySQL root password
2. Create a dedicated database user
3. Update `System/server/.env` with production credentials
4. Enable SSL connections if needed

## Support

If you encounter issues:
1. Check MySQL service status
2. Verify database credentials
3. Check firewall settings (port 3306)
4. Review MySQL error logs
