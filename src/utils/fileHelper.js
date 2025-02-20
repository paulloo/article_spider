const fs = require('fs').promises;
const path = require('path');

class FileHelper {
    async ensureDir(dirPath) {
        try {
            await fs.access(dirPath);
        } catch {
            try {
                await fs.mkdir(dirPath, { recursive: true });
                console.debug(`Created directory: ${dirPath}`);
            } catch (error) {
                console.error(`Failed to create directory ${dirPath}:`, error);
                throw error;
            }
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async saveFile(filePath, data) {
        try {
            // 确保目录存在
            await this.ensureDir(path.dirname(filePath));
            
            // 如果数据是对象，转换为 JSON
            const content = typeof data === 'object' ? 
                JSON.stringify(data, null, 2) : 
                data;

            await fs.writeFile(filePath, content, 'utf8');
            console.debug(`Saved file: ${filePath}`);
        } catch (error) {
            console.error(`Failed to save file ${filePath}:`, error);
            throw error;
        }
    }

    async readFile(filePath, parseJson = false) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return parseJson ? JSON.parse(content) : content;
        } catch (error) {
            console.error(`Failed to read file ${filePath}:`, error);
            throw error;
        }
    }

    async deleteFile(filePath) {
        try {
            if (await this.fileExists(filePath)) {
                await fs.unlink(filePath);
                console.debug(`Deleted file: ${filePath}`);
            }
        } catch (error) {
            console.error(`Failed to delete file ${filePath}:`, error);
            throw error;
        }
    }

    sanitizeFilename(title) {
        if (!title) {
            return new Date().toISOString().replace(/[:.]/g, '-');
        }
        
        // 转换为 URL 友好的格式
        return title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-') // 所有非字母数字字符替换为连字符
            .replace(/^-+|-+$/g, '')     // 移除首尾连字符
            .substring(0, 100);           // 限制长度
    }

    // 从 slug 还原为可读的标题
    slugToTitle(slug) {
        return slug
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
}

module.exports = new FileHelper(); 