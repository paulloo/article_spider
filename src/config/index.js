const path = require('path');

const rootDir = path.resolve(__dirname, '../..');

const paths = {
    root: rootDir,
    logs: path.join(rootDir, 'logs'),
    storage: path.join(rootDir, 'storage'),
    templates: {
        root: path.join(rootDir, 'storage', 'templates'),
        scraping: path.join(rootDir, 'storage', 'templates', 'scraping'),
        rendering: path.join(rootDir, 'storage', 'templates', 'rendering'),
        partials: path.join(rootDir, 'storage', 'templates', 'partials')
    },
    articles: {
        root: path.join(rootDir, 'storage', 'articles'),
        raw: path.join(rootDir, 'storage', 'articles', 'raw'),
        processed: path.join(rootDir, 'storage', 'articles', 'processed')
    },
    uploads: {
        root: path.join(rootDir, 'storage', 'uploads'),
        images: path.join(rootDir, 'storage', 'uploads', 'images'),
        temp: path.join(rootDir, 'storage', 'uploads', 'temp')
    }
};

module.exports = {
    port: process.env.PORT || 5508,
    isDev: process.env.NODE_ENV !== 'production',
    logLevel: process.env.LOG_LEVEL || 'debug',
    paths,
    fileNames: {
        scrapingTemplate: (name) => `${name.toLowerCase().replace(/\s+/g, '_')}.json`,
        renderingTemplate: (name) => `${name.toLowerCase().replace(/\s+/g, '_')}.hbs`,
        article: (id) => `${id}.json`
    },

    // API 配置
    api: {
        baseUrl: process.env.API_BASE_URL || 'http://localhost:5508',
        timeout: parseInt(process.env.API_TIMEOUT) || 30000,
        retries: parseInt(process.env.API_RETRIES) || 3
    },

    // CORS 配置
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
}; 