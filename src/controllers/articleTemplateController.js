const articleTemplateService = require('../services/articleTemplateService');
const logger = require('../services/logService');
const { AppError } = require('../middleware/errorHandler');
const { validate, schemas } = require('../utils/validator');
const ResponseFormatter = require('../utils/responseFormatter');

class ArticleTemplateController {
    async getTemplateList(req, res, next) {
        try {
            const templates = await articleTemplateService.getTemplateList();
            res.json(ResponseFormatter.list(templates));
        } catch (error) {
            next(error);
        }
    }

    async getTemplate(req, res, next) {
        try {
            const { filename } = req.params;
            const template = await articleTemplateService.getTemplate(filename);
            res.json(ResponseFormatter.success(template));
        } catch (error) {
            next(error);
        }
    }

    async createTemplate(req, res, next) {
        try {
            const templateData = validate(schemas.articleTemplate, req.body);
            const filename = await articleTemplateService.saveTemplate(
                templateData.name,
                templateData
            );
            res.status(201).json(ResponseFormatter.created({ filename }));
        } catch (error) {
            next(error);
        }
    }

    async updateTemplate(req, res, next) {
        try {
            const { filename } = req.params;
            const templateData = validate(schemas.articleTemplate, req.body);
            await articleTemplateService.saveTemplate(filename, templateData);
            res.json(ResponseFormatter.updated());
        } catch (error) {
            next(error);
        }
    }

    async deleteTemplate(req, res, next) {
        try {
            const { filename } = req.params;
            await articleTemplateService.deleteTemplate(filename);
            res.json(ResponseFormatter.deleted());
        } catch (error) {
            next(error);
        }
    }

    async testTemplate(req, res, next) {
        try {
            const { filename } = req.params;
            const { url } = req.body;
            const result = await articleTemplateService.testTemplate(filename, url);
            res.json(ResponseFormatter.success(result));
        } catch (error) {
            next(error);
        }
    }

    async validateTemplate(req, res, next) {
        try {
            const templateData = req.body;
            await articleTemplateService.validateTemplate(templateData);
            res.json(ResponseFormatter.success(null, 'Template validation successful'));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ArticleTemplateController(); 