const Handlebars = require('handlebars');
const path = require('path');
const fs = require('fs').promises;
const fileHelper = require('../utils/fileHelper');
const config = require('../config');
const logger = require('./logService');
const { AppError } = require('../middleware/errorHandler');
const cacheService = require('./cacheService');
const { paths, fileNames } = require('../config');

class TemplateService {
    constructor() {
        this.registerDefaultHelpers();
    }

    registerDefaultHelpers() {
        // 数字增加1
        Handlebars.registerHelper('addOne', function(value) {
            return parseInt(value) + 1;
        });

        // 加粗第一句话
        Handlebars.registerHelper('boldFirstSentence', function(text) {
            if (!text) return '';
            const pattern = /(^[^。！？.!?]+[。！？.!?])/;
            return text.replace(pattern, '<strong>$1</strong>');
        });

        // 条件判断
        Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
            return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
        });

        // 日期格式化
        Handlebars.registerHelper('formatDate', function(date) {
            if (!date) return '';
            return new Date(date).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        });
    }

    async getTemplateList() {
        try {
            return await cacheService.get('templates:list', async () => {
                await fileHelper.ensureDir(paths.templates.rendering);
                const files = await fs.readdir(paths.templates.rendering);
                
                const templates = await Promise.all(
                    files.filter(f => f.endsWith('.hbs'))
                        .map(async filename => {
                            try {
                                const content = await fs.readFile(
                                    path.join(paths.templates.rendering, filename),
                                    'utf8'
                                );
                                const stats = await fs.stat(
                                    path.join(paths.templates.rendering, filename)
                                );
                                
                                return {
                                    filename: filename.replace('.hbs', ''),
                                    template_content: content,
                                    created: stats.birthtime,
                                    modified: stats.mtime,
                                    size: stats.size
                                };
                            } catch (error) {
                                logger.error(`Error reading template ${filename}:`, error);
                                return null;
                            }
                        })
                );
                
                return templates.filter(Boolean);
            }, 300);
        } catch (error) {
            logger.error('Error getting template list:', error);
            throw new AppError('Failed to get template list', 500);
        }
    }

    async getTemplate(filename) {
        try {
            const cacheKey = `template:${filename}`;
            return await cacheService.get(cacheKey, async () => {
                const filepath = path.join(paths.templates.rendering, `${filename}.hbs`);
                if (!await fileHelper.fileExists(filepath)) {
                    throw new AppError('Template not found', 404);
                }
                return fs.readFile(filepath, 'utf8');
            }, 300);
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error(`Error getting template ${filename}:`, error);
            throw new AppError('Failed to get template', 500);
        }
    }

    async saveTemplate(name, content) {
        try {
            // 验证模板语法
            try {
                Handlebars.compile(content);
            } catch (error) {
                throw new AppError('Invalid template syntax', 400, error.message);
            }

            const filename = fileNames.renderingTemplate(name);
            const filepath = path.join(paths.templates.rendering, filename);
            
            await fileHelper.saveFile(filepath, content);

            // 清除相关缓存
            await this._clearTemplateCache(filename);
            
            return filename;
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error('Error saving template:', error);
            throw new AppError('Failed to save template', 500);
        }
    }

    async deleteTemplate(filename) {
        try {
            const filepath = path.join(paths.templates.rendering, `${filename}.hbs`);
            if (!await fileHelper.fileExists(filepath)) {
                throw new AppError('Template not found', 404);
            }

            await fs.unlink(filepath);
            await this._clearTemplateCache(filename);

            return true;
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error(`Error deleting template ${filename}:`, error);
            throw new AppError('Failed to delete template', 500);
        }
    }

    async renderTemplateWithData(templateContent, data, options = {}) {
        try {
            // 创建独立的 Handlebars 实例
            const handlebars = Handlebars.create();
            
            // 注册默认的辅助函数
            this._registerDefaultHelpers(handlebars);
            
            // 注册自定义辅助函数
            if (options.helpers) {
                Object.entries(options.helpers).forEach(([name, helperFunc]) => {
                    try {
                        handlebars.registerHelper(name, 
                            typeof helperFunc === 'string' ? 
                            eval(`(${helperFunc})`) : helperFunc
                        );
                    } catch (error) {
                        logger.error(`Error registering helper ${name}:`, error);
                    }
                });
            }

            try {
                if (options.precompile) {
                    // 只预编译模板
                    return handlebars.precompile(templateContent, {
                        strict: true,
                        assumeObjects: true,
                        preventIndent: true,
                        ...options
                    });
                }

                // 编译并渲染模板
                const template = handlebars.compile(templateContent, {
                    strict: true,
                    assumeObjects: true,
                    preventIndent: true,
                    ...options
                });
                
                return template(data);
            } finally {
                // 清理注册的辅助函数
                if (options.helpers) {
                    Object.keys(options.helpers).forEach(name => {
                        handlebars.unregisterHelper(name);
                    });
                }
            }
        } catch (error) {
            logger.error('Error rendering template:', error);
            throw new AppError('Template rendering failed', 400, error.message);
        }
    }

    async getTemplateById(id) {
        try {
            const cacheKey = `template:${id}`;
            return await cacheService.get(cacheKey, async () => {
                // 如果是默认模板ID，直接读取文件
                if (id === 'default') {
                    const content = await fs.readFile(
                        path.join(paths.templates.rendering, 'default.hbs'),
                        'utf8'
                    );
                    return {
                        id: 'default',
                        name: 'Default Template',
                        html_template: {
                            content,
                            helpers: {
                                addOne: "function(value) { return parseInt(value) + 1; }",
                                boldFirstSentence: "function(text) { if (!text) return ''; const pattern = /(^[^。！？.!?]+[。！？.!?])/; return text.replace(pattern, '<strong>$1</strong>'); }"
                            }
                        }
                    };
                }

                // 否则从模板列表中查找
                const templates = await this.getTemplateList();
                const template = templates.find(t => t.id === id || t.filename === id);
                
                if (!template) {
                    throw new AppError('Template not found', 404);
                }
                
                return template;
            }, 300);
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error(`Error getting template ${id}:`, error);
            throw new AppError('Failed to get template', 500);
        }
    }

    async _clearTemplateCache(id) {
        await Promise.all([
            cacheService.del('templates:list'),
            cacheService.del(`template:${id}`),
            cacheService.del(`template:${id}:rendered`)
        ]);
    }

    async validateTemplate(content) {
        try {
            Handlebars.compile(content);

            // 检查模板大小
            if (content.length > 1024 * 1024) { // 1MB限制
                throw new AppError('Template too large', 400);
            }

            // 检查模板复杂度
            const complexity = this._calculateTemplateComplexity(content);
            if (complexity > 100) { // 自定义复杂度限制
                throw new AppError('Template too complex', 400);
            }

            return true;
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError('Invalid template', 400, error.message);
        }
    }

    _calculateTemplateComplexity(content) {
        // 简单的复杂度计算
        const helperCount = (content.match(/{{[^}]+}}/g) || []).length;
        const blockCount = (content.match(/{{#[^}]+}}/g) || []).length;
        const partialCount = (content.match(/{{>[^}]+}}/g) || []).length;
        
        return helperCount + (blockCount * 2) + (partialCount * 3);
    }

    async renderTemplate(filename, data, helpers = {}) {
        try {
            const template = await this.getTemplate(filename);
            const compiledTemplate = Handlebars.compile(template);

            // 创建独立的 Handlebars 实例以避免全局污染
            const handlebars = Handlebars.create();
            
            // 注册自定义辅助函数
            Object.entries(helpers).forEach(([name, helperFunc]) => {
                try {
                    handlebars.registerHelper(name, eval(`(${helperFunc})`));
                } catch (error) {
                    logger.error(`Error registering helper ${name}:`, error);
                }
            });

            try {
                return compiledTemplate(data);
            } finally {
                // 清理注册的辅助函数
                Object.keys(helpers).forEach(name => {
                    handlebars.unregisterHelper(name);
                });
            }
        } catch (error) {
            logger.error(`Error rendering template ${filename}:`, error);
            throw new AppError('Template rendering failed', 500);
        }
    }

    async importPartial(name, content) {
        try {
            // 验证部分模板
            await this.validateTemplate(content);
            
            // 保存部分模板到新的路径
            const filename = fileHelper.sanitizeFilename(name);
            const filepath = path.join(paths.templates.partials, `${filename}.hbs`);
            
            await fileHelper.saveFile(filepath, content);
            
            // 注册为 Handlebars 部分模板
            Handlebars.registerPartial(name, content);
            
            return filename;
        } catch (error) {
            logger.error(`Error importing partial ${name}:`, error);
            throw new AppError('Failed to import partial', 500);
        }
    }

    async getPartialsList() {
        try {
            await fileHelper.ensureDir(paths.templates.partials);
            
            const files = await fs.readdir(paths.templates.partials);
            return files
                .filter(f => f.endsWith('.hbs'))
                .map(f => f.replace('.hbs', ''));
        } catch (error) {
            logger.error('Error getting partials list:', error);
            throw new AppError('Failed to get partials list', 500);
        }
    }

    async validateTemplateData(template, data) {
        try {
            // 提取模板中使用的变量
            const variables = this._extractTemplateVariables(template);
            
            // 检查必需变量是否存在
            const missingVars = variables.filter(v => !this._hasProperty(data, v));
            if (missingVars.length > 0) {
                throw new AppError(
                    'Missing required variables',
                    400,
                    `Missing variables: ${missingVars.join(', ')}`
                );
            }

            return true;
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError('Template data validation failed', 400);
        }
    }

    _extractTemplateVariables(template) {
        const matches = template.match(/{{[^#/>]+?}}/g) || [];
        return [...new Set(
            matches.map(m => m.replace(/[{}]/g, '').trim())
                .filter(v => !v.startsWith('if') && !v.startsWith('each'))
        )];
    }

    _hasProperty(obj, path) {
        return path.split('.').reduce((obj, prop) => {
            return obj && obj[prop];
        }, obj) !== undefined;
    }

    async batchRender(templates, data) {
        const results = {};
        const errors = [];

        for (const [name, content] of Object.entries(templates)) {
            try {
                // 验证数据
                await this.validateTemplateData(content, data);
                
                // 编译并渲染模板
                const template = Handlebars.compile(content);
                results[name] = template(data);
            } catch (error) {
                logger.error(`Error rendering template ${name}:`, error);
                errors.push({
                    template: name,
                    error: error.message
                });
                results[name] = null;
            }
        }

        return {
            results,
            errors: errors.length > 0 ? errors : null
        };
    }

    _registerDefaultHelpers(handlebars) {
        // 数字增加1
        handlebars.registerHelper('addOne', function(value) {
            return parseInt(value) + 1;
        });

        // 加粗第一句话
        handlebars.registerHelper('boldFirstSentence', function(text) {
            if (!text) return '';
            const pattern = /(^[^。！？.!?]+[。！？.!?])/;
            return text.replace(pattern, '<strong>$1</strong>');
        });

        // 条件判断
        handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
            return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
        });

        // 日期格式化
        handlebars.registerHelper('formatDate', function(date) {
            if (!date) return '';
            return new Date(date).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        });
    }
}

module.exports = new TemplateService(); 