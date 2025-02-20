const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;
const { paths } = require('../config');

// 确保日志目录存在
(async () => {
    try {
        await fs.mkdir(paths.logs, { recursive: true });
    } catch (error) {
        console.error('Failed to create logs directory:', error);
    }
})();

// 日志格式
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
);

// 创建 logger 实例
const logger = winston.createLogger({
    level: 'debug',
    format: logFormat,
    transports: [
        // 控制台输出
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // 错误日志文件
        new winston.transports.File({
            filename: path.join(paths.logs, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // 所有日志文件
        new winston.transports.File({
            filename: path.join(paths.logs, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// 添加日志级别方法
const logLevels = ['error', 'warn', 'info', 'debug'];
logLevels.forEach(level => {
    logger[level] = (...args) => {
        if (typeof args[0] === 'object') {
            logger.log({ level, ...args[0] });
        } else {
            logger.log({ level, message: args[0], ...args[1] });
        }
    };
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', {
        error: error.message,
        stack: error.stack
    });
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Rejection:', {
        error: error.message,
        stack: error.stack
    });
});

module.exports = logger; 