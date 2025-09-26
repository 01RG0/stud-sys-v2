// Test Database Configuration
// This configuration is for testing without password

module.exports = {
  // MySQL Database Configuration
  DB_HOST: 'localhost',
  DB_USER: 'root',
  DB_PASSWORD: '',
  DB_NAME: 'student_lab_system',
  DB_PORT: 3306,
  
  // Server Configuration
  HTTP_PORT: 3000,
  HTTPS_PORT: 3443,
  WS_PORT: 3001,
  WSS_PORT: 3444,
  
  // Application Configuration
  NODE_ENV: 'development'
};
