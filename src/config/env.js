require('dotenv').config();

module.exports = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 5508,
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
    UPLOAD_MAX_SIZE: process.env.UPLOAD_MAX_SIZE || 5 * 1024 * 1024, // 5MB
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : 
        ['http://localhost:3000']
}; 