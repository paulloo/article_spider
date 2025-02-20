const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./services/logService');
const cleanupService = require('./services/cleanupService');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { paths } = require('./config');

// 创建 Express 应用
const app = express();

// CORS 配置
app.use(cors({
    origin: '*',  // 在生产环境中应该设置具体的域名
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// 预检请求处理
app.options('*', cors());

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 请求日志
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`, {
        query: req.query,
        body: req.body,
        headers: {
            'user-agent': req.get('user-agent'),
            'content-type': req.get('content-type')
        }
    });
    next();
});

// 静态文件服务
app.use('/static', express.static(path.join(__dirname, '..', 'static')));

// API 文档
if (config.isDev) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: "WikiHow Service API Documentation"
    }));

    // API 文档 JSON 端点
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });

    logger.info('API documentation available at /api-docs');
}

// 初始化必要的目录
async function initializeDirectories() {
    try {
        // 使用 fs 直接创建目录
        const fs = require('fs').promises;
        
        const directories = [
            paths.articles.root,
            paths.articles.raw,
            paths.articles.processed,
            paths.templates.root,
            paths.templates.scraping,
            paths.templates.rendering,
            paths.templates.partials,
            paths.uploads.root,
            paths.uploads.images,
            paths.uploads.temp
        ];

        for (const dir of directories) {
            try {
                await fs.mkdir(dir, { recursive: true });
                console.debug(`Created directory: ${dir}`);
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    console.error(`Failed to create directory ${dir}:`, error);
                    throw error;
                }
            }
        }

        console.info('All required directories initialized');
    } catch (error) {
        console.error('Failed to initialize directories:', error);
        process.exit(1);
    }
}

// 在启动服务器前初始化目录
initializeDirectories().then(() => {
    // 路由模块
    const articleRoutes = require('./routes/article');
    const articleTemplateRoutes = require('./routes/articleTemplate');
    const handlebarsRoutes = require('./routes/template');
    const uploadRoutes = require('./routes/upload');

    // 注册路由
    app.use('/api/articles', articleRoutes);
    app.use('/api/article-templates', articleTemplateRoutes);
    app.use('/api/handlebars-templates', handlebarsRoutes);
    app.use('/api/upload', uploadRoutes);

    // 错误处理中间件
    app.use(errorHandler);

    // 404 处理
    app.use((req, res) => {
        res.status(404).json({
            status: 'error',
            message: 'Not Found',
            code: 404
        });
    });

    // 启动服务器
    const PORT = config.port;
    app.listen(PORT, () => {
        logger.info(`Server is running on port ${PORT}`);
        if (config.isDev) {
            logger.debug('Server running in development mode');
        }
    });

    // 启动清理服务
    if (!config.isDev) {
        cleanupService.start();
    }

    // 优雅关闭
    process.on('SIGTERM', () => {
        cleanupService.stop();
        // ... 其他清理工作
        process.exit(0);
    });
});

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    // 给进程一点时间来处理剩余的回调
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
    // 将未处理的 Promise 拒绝转换为未捕获的异常
    throw err;
});

module.exports = app;

