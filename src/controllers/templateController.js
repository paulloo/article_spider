const templateService = require('../services/templateService');
const logger = require('../services/logService');
const { AppError } = require('../middleware/errorHandler');
const { validate, schemas } = require('../utils/validator');
const ResponseFormatter = require('../utils/responseFormatter');

class TemplateController {
    async getTemplateList(req, res, next) {
        try {
            const templates = await templateService.getTemplateList();
            res.json(ResponseFormatter.list(templates));
        } catch (error) {
            next(error);
        }
    }

    async getTemplate(req, res, next) {
        try {
            const { filename } = req.params;
            const template = await templateService.getTemplate(filename);
            res.json(ResponseFormatter.success(template));
        } catch (error) {
            next(error);
        }
    }

    async createTemplate(req, res, next) {
        try {
            const { name, template_content } = req.body;
            const filename = await templateService.saveTemplate(name, template_content);
            res.status(201).json(ResponseFormatter.created({ filename }));
        } catch (error) {
            next(error);
        }
    }

    async updateTemplate(req, res, next) {
        try {
            const { filename } = req.params;
            const { template_content } = req.body;
            await templateService.saveTemplate(filename, template_content);
            res.json(ResponseFormatter.updated());
        } catch (error) {
            next(error);
        }
    }

    async deleteTemplate(req, res, next) {
        try {
            const { filename } = req.params;
            await templateService.deleteTemplate(filename);
            res.json(ResponseFormatter.deleted());
        } catch (error) {
            next(error);
        }
    }

    async renderTemplate(req, res, next) {
        try {
            // 验证请求数据
            const { template_id, article_data, article_id } = validate(schemas.renderTemplate, req.body);

            // 获取模板
            const template = await templateService.getTemplateById(template_id);
            
            // 添加调试日志
            logger.debug('Template found:', {
                template_id,
                template: {
                    name: template?.name,
                    hasContent: !!template?.html_template?.content,
                    contentLength: template?.html_template?.content?.length
                }
            });

            // 修改模板内容检查逻辑
            let templateContent;
            if (template?.html_template?.content) {
                templateContent = template.html_template.content;
            } else if (template?.template_content) {
                templateContent = template.template_content;
            } else {
                throw new AppError('Template content not found', 404, {
                    template_id,
                    template_name: template?.name
                });
            }

            // 转换数据结构（如果是列表结构）
            let renderData = article_data;
            if (article_data.items) {
                // 如果是列表结构，转换为单文章结构
                const article = article_data.items[0];
                renderData = {
                    title: article.title,
                    profile: article.description || '',
                    guide: article_data.guide,
                    steps: article.steps || [],
                    history: article_data.history || []
                };
            }

            // 渲染模板
            const renderedHtml = await templateService.renderTemplateWithData(
                templateContent,
                renderData,
                {
                    helpers: template?.html_template?.helpers || template?.helpers
                }
            );

            res.json(ResponseFormatter.success({
                html: renderedHtml,
                template_name: template.name,
                article_id: article_id
            }));
        } catch (error) {
            logger.error('Error rendering template:', {
                error: error.message,
                stack: error.stack,
                template_id: req.body?.template_id,
                data: req.body?.article_data
            });
            next(error);
        }
    }

    async importPartial(req, res, next) {
        try {
            const { name, content } = req.body;
            const filename = await templateService.importPartial(name, content);
            res.status(201).json(ResponseFormatter.created({ filename }));
        } catch (error) {
            next(error);
        }
    }

    async batchRender(req, res, next) {
        try {
            const { templates, data } = req.body;
            const results = await templateService.batchRender(templates, data);
            res.json(ResponseFormatter.success(results));
        } catch (error) {
            next(error);
        }
    }

    async getPartialsList(req, res, next) {
        try {
            const partials = await templateService.getPartialsList();
            res.json(partials);
        } catch (error) {
            next(error);
        }
    }

    async getTemplateById(req, res, next) {
        try {
            const { id } = req.params;
            const template = await templateService.getTemplateById(id);
            res.json(ResponseFormatter.success(template));
        } catch (error) {
            next(error);
        }
    }

    async getPrecompiledTemplate(req, res, next) {
        try {
            const { id } = req.params;
            const template = await templateService.getTemplateById(id);
            
            if (!template?.template_content) {
                throw new AppError('Template content not found', 404);
            }

            const precompiled = await templateService.renderTemplateWithData(
                template.template_content,
                {},  // 空数据
                { precompile: true }  // 指示只预编译
            );

            res.json(ResponseFormatter.success({
                precompiled,
                template: template.template_content
            }));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new TemplateController(); 