// Database Configuration
// Copy this file to .env and update with your MySQL credentials

module.exports = {
  // MySQL Database Configuration
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'student_lab_system',
  DB_PORT: process.env.DB_PORT || 3306,
  
  // Server Configuration
  HTTP_PORT: process.env.HTTP_PORT || 3000,
  HTTPS_PORT: process.env.HTTPS_PORT || 3443,
  WS_PORT: process.env.WS_PORT || 3001,
  WSS_PORT: process.env.WSS_PORT || 3444,
  
  // Application Configuration
  NODE_ENV: process.env.NODE_ENV || 'development'
};
