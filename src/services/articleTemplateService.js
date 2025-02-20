const fileHelper = require('../utils/fileHelper');
const config = require('../config');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logService');
const { AppError } = require('../middleware/errorHandler');
const cacheService = require('./cacheService');
const { paths, fileNames } = require('../config');
const { v4: uuidv4 } = require('uuid');

class ArticleTemplateService {
    constructor() {
        this.defaultTemplate = {
            id: 'default-template',  // 默认模板ID
            name: "WikiHow Article",
            description: "Default template for scraping WikiHow articles",
            preview_image: "https://cdn.ddp.life/cqFPb0Tk72cpDx84HlvvNSmE.png",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            xpath_rules: {
                title_xpath: "//h1[contains(@class, 'article-title') or contains(@class, 'whb')]",
                profile_xpath: "//*[contains(@class, 'method-intro') or contains(@class, 'summary')]",
                step_xpath: "//*[contains(@class, 'method')]",
                step_title_xpath: ".//*[contains(@class, 'method-title')]",
                step_item_xpath: ".//*[contains(@class, 'step')]",
                step_item_content_xpath: ".//*[contains(@class, 'step-content')]",
                step_item_img_xpath: ".//img[contains(@class, 'whcdn')]"
            }
        };
    }

    async getTemplateList() {
        try {
            return await cacheService.get('article_templates:list', async () => {
                await fileHelper.ensureDir(paths.templates.scraping);
                const files = await fs.readdir(paths.templates.scraping);
                
                // 只处理 .json 文件
                const jsonFiles = files.filter(f => f.endsWith('.json'));
                logger.debug(`Found ${jsonFiles.length} template files`);

                const templates = [];
                for (const filename of jsonFiles) {
                    try {
                        const filepath = path.join(paths.templates.scraping, filename);
                        const content = await fs.readFile(filepath, 'utf8');
                        const stats = await fs.stat(filepath);
                        
                        let template = JSON.parse(content);
                        
                        // 如果是默认模板，使用内存中的版本
                        if (template.id === this.defaultTemplate.id) {
                            template = { ...this.defaultTemplate };
                        }
                        // 如果没有 ID，生成一个
                        else if (!template.id) {
                            template.id = uuidv4();
                            // 更新文件
                            await fileHelper.saveFile(filepath, JSON.stringify(template, null, 2));
                        }

                        templates.push({
                            ...template,
                            filename,
                            created_at: template.created_at || stats.birthtime.toISOString(),
                            updated_at: template.updated_at || stats.mtime.toISOString()
                        });
                    } catch (error) {
                        logger.error(`Error reading template ${filename}:`, error);
                        // 继续处理下一个文件
                        continue;
                    }
                }
                
                return templates;
            }, 300);
        } catch (error) {
            logger.error('Error getting template list:', error);
            throw new AppError('Failed to get template list', 500);
        }
    }

    async getTemplate(idOrName) {
        try {
            return await cacheService.get(`template:${idOrName}`, async () => {
                // 如果是默认模板请求
                if (idOrName === 'default-template') {
                    await this._ensureDefaultTemplate();
                    return this.defaultTemplate;
                }

                // 从文件系统加载模板
                const templates = await this.getTemplateList();
                const template = templates.find(t => 
                    t.id === idOrName || 
                    t.name === idOrName || 
                    t.filename === idOrName
                );

                if (template) {
                    return template;
                }

                throw new AppError(`Template "${idOrName}" not found`, 404);
            }, 300);
        } catch (error) {
            logger.error(`Error getting template ${idOrName}:`, error);
            if (error instanceof AppError) throw error;
            throw new AppError('Failed to get template', 500);
        }
    }

    async _ensureDefaultTemplate() {
        const filename = 'default-template.json';
        const filepath = path.join(paths.templates.scraping, filename);

        try {
            // 检查文件是否存在
            const exists = await fileHelper.fileExists(filepath);
            if (!exists) {
                // 创建默认模板文件
                await fileHelper.saveFile(filepath, JSON.stringify(this.defaultTemplate, null, 2));
                logger.info('Created default scraping template');
            } else {
                // 更新现有的默认模板
                await fileHelper.saveFile(filepath, JSON.stringify(this.defaultTemplate, null, 2));
                logger.debug('Updated default scraping template');
            }
        } catch (error) {
            logger.error('Error ensuring default template:', error);
            // 不抛出错误，因为我们仍然可以使用内存中的默认模板
        }
    }

    async saveTemplate(name, template) {
        try {
            // 验证模板格式
            this._validateArticleTemplate(template);

            const filename = fileNames.scrapingTemplate(name);
            const filepath = path.join(paths.templates.scraping, filename);
            
            await fileHelper.saveFile(filepath, {
                name,
                ...template,
                updated_at: new Date().toISOString()
            });

            await this._clearTemplateCache(filename);
            return filename;
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error('Error saving article template:', error);
            throw new AppError('Failed to save article template', 500);
        }
    }

    async deleteTemplate(filename) {
        try {
            const filepath = path.join(paths.templates.scraping, filename);
            if (!await fileHelper.fileExists(filepath)) {
                throw new AppError('Article template not found', 404);
            }

            await fs.unlink(filepath);
            await this._clearTemplateCache(filename);
            return true;
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error(`Error deleting article template ${filename}:`, error);
            throw new AppError('Failed to delete article template', 500);
        }
    }

    _validateArticleTemplate(template) {
        const requiredFields = ['xpaths'];
        const requiredXPaths = [
            'title_xpath',
            'profile_xpath',
            'step_xpath',
            'step_title_xpath',
            'step_item_xpath'
        ];

        // 检查必需字段
        for (const field of requiredFields) {
            if (!template[field]) {
                throw new AppError(`Missing required field: ${field}`, 400);
            }
        }

        // 检查必需的 XPath
        for (const xpath of requiredXPaths) {
            if (!template.xpaths[xpath]) {
                throw new AppError(`Missing required xpath: ${xpath}`, 400);
            }
        }

        // 验证 XPath 语法
        for (const [key, value] of Object.entries(template.xpaths)) {
            if (typeof value !== 'string' || !value.trim()) {
                throw new AppError(`Invalid xpath for ${key}`, 400);
            }
            try {
                // 简单的 XPath 语法检查
                if (!/^\/\/|\.\/\//.test(value)) {
                    throw new Error('Invalid XPath syntax');
                }
            } catch (error) {
                throw new AppError(`Invalid xpath syntax for ${key}: ${value}`, 400);
            }
        }
    }

    async _clearTemplateCache(filename) {
        await Promise.all([
            cacheService.del('article_templates:list'),
            cacheService.del(`article_template:${filename}`)
        ]);
    }
}

module.exports = new ArticleTemplateService(); 