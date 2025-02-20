const logger = require('../services/logService');

// 自定义错误类
class AppError extends Error {
    constructor(message, statusCode = 500, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        Error.captureStackTrace(this, this.constructor);
    }
}

// 异步处理包装器
const asyncHandler = fn => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// 错误处理中间件
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // 记录错误
    logger.error('Error:', {
        message: err.message,
        status: err.status,
        statusCode: err.statusCode,
        stack: err.stack,
        details: err.details,
        path: req.path,
        method: req.method
    });

    // 开发环境返回详细错误信息
    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack,
            details: err.details
        });
    } else {
        // 生产环境只返回基本错误信息
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
            ...(err.details && { details: err.details })
        });
    }
};

// 导出所有工具函数
module.exports = {
    AppError,
    asyncHandler,
    errorHandler
}; 