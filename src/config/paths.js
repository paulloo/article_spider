const path = require('path');
const rootDir = path.join(__dirname, '..', '..');

module.exports = {
    // 文章相关
    articles: {
        root: path.join(rootDir, 'storage', 'articles'),
        raw: path.join(rootDir, 'storage', 'articles', 'raw'),      // 原始爬取的文章数据
        processed: path.join(rootDir, 'storage', 'articles', 'processed'), // 处理后的文章数据
    },

    // 模板相关
    templates: {
        root: path.join(rootDir, 'storage', 'templates'),
        scraping: path.join(rootDir, 'storage', 'templates', 'scraping'),  // 爬虫配置模板
        rendering: path.join(rootDir, 'storage', 'templates', 'rendering'), // Handlebars渲染模板
        partials: path.join(rootDir, 'storage', 'templates', 'partials'),  // Handlebars部分模板
    },

    // 上传文件
    uploads: {
        root: path.join(rootDir, 'storage', 'uploads'),
        images: path.join(rootDir, 'storage', 'uploads', 'images'),
        temp: path.join(rootDir, 'storage', 'uploads', 'temp'),
    }
}; 