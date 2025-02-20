const fileHelper = require('../utils/fileHelper');
const config = require('../config');
const path = require('path');
const fs = require('fs').promises;

class UploadService {
    async saveUploadedFile(file) {
        const filename = file.filename;
        const filepath = path.join(config.UPLOAD_FOLDER, filename);

        // 确保文件已经被 multer 保存
        if (!await fileHelper.fileExists(filepath)) {
            throw new Error('File upload failed');
        }

        return {
            filename,
            url: `/static/preview_images/${filename}`,
            size: file.size,
            mimetype: file.mimetype
        };
    }

    async getFileInfo(filename) {
        const filepath = path.join(config.UPLOAD_FOLDER, filename);
        
        if (!await fileHelper.fileExists(filepath)) {
            return null;
        }

        const stats = await fs.stat(filepath);
        return {
            filename,
            url: `/static/preview_images/${filename}`,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
        };
    }

    async deleteUploadedFile(filename) {
        const filepath = path.join(config.UPLOAD_FOLDER, filename);
        if (await fileHelper.fileExists(filepath)) {
            await fs.unlink(filepath);
            return true;
        }
        return false;
    }

    // 清理过期文件
    async cleanupOldFiles(maxAge = 24 * 60 * 60 * 1000) { // 默认24小时
        const files = await fs.readdir(config.UPLOAD_FOLDER);
        const now = Date.now();
        
        for (const file of files) {
            const filepath = path.join(config.UPLOAD_FOLDER, file);
            try {
                const stats = await fs.stat(filepath);
                const age = now - stats.mtimeMs;
                
                if (age > maxAge) {
                    await fs.unlink(filepath);
                    logger.info(`Deleted old file: ${file}`);
                }
            } catch (error) {
                logger.error(`Error cleaning up file ${file}:`, error);
            }
        }
    }
}

module.exports = new UploadService(); 