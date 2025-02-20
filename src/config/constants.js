module.exports = {
    DATA_DIR: 'data',
    TEMPLATES_DIR: 'templates',
    HANDLEBARS_TEMPLATES_DIR: 'handlebars_templates',
    CONFIG_FILE: 'config.json',
    UPLOAD_FOLDER: 'static/preview_images',
    ALLOWED_EXTENSIONS: ['png', 'jpg', 'jpeg', 'gif'],
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    CACHE_TTL: 300 // 5分钟缓存
}; 