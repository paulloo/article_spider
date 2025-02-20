const articleService = require('../services/articleService');
const articleTemplateService = require('../services/articleTemplateService');
const scraper = require('../services/scraper');
const logger = require('../services/logService');
const { AppError } = require('../middleware/errorHandler');
const { validate, schemas } = require('../utils/validator');
const ResponseFormatter = require('../utils/responseFormatter');

class ArticleController {
    async scrapeArticle(req, res, next) {
        try {
            // 验证请求数据
            const { url, template_id } = validate(schemas.scrapeArticle, req.body);
            
            logger.debug('Scraping article with params:', { url, template_id });

            // 获取模板配置
            logger.info(`Getting template with ID: ${template_id}`);
            const template = await articleTemplateService.getTemplate(template_id);
            if (!template) {
                throw new AppError('Template not found', 404);
            }

            // 验证模板格式
            validate(schemas.articleTemplate, {
                name: template.name,
                xpath_rules: template.xpath_rules
            });

            logger.info(`Using template "${template.name}" to scrape article from URL: ${url}`);

            // 抓取文章
            const html = await scraper.fetchArticle(url);
            
            // 使用模板解析文章
            const articleData = await scraper.parseArticle(html, template);
            
            // 添加 guide 字段
            articleData.guide = "点击上方蓝字关注我们";

            // 添加元数据
            articleData.url = url;
            articleData.source = {
                url,
                template_id: template.id,
                template_name: template.name,
                scraped_at: new Date().toISOString()
            };

            // 保存文章
            const article = await articleService.saveArticle({
                ...articleData,
                url,
                source: {
                    url,
                    template_id,
                    template_name: template.name,
                    scraped_at: new Date().toISOString()
                }
            });
            
            res.json(ResponseFormatter.success({
                article_id: article.id,
                message: 'Article scraped successfully'
            }));
        } catch (error) {
            logger.error('Error in scrapeArticle:', {
                error: error.message,
                stack: error.stack,
                template_id,
                url
            });
            next(error);
        }
    }

    async getArticleList(req, res, next) {
        try {
            const articles = await articleService.getArticleList();
            res.json(ResponseFormatter.list(articles));
        } catch (error) {
            next(error);
        }
    }

    async getArticle(req, res, next) {
        try {
            const { id } = req.params;
            const article = await articleService.getArticle(id);
            res.json(ResponseFormatter.success(article));
        } catch (error) {
            next(error);
        }
    }

    async createArticle(req, res, next) {
        try {
            const articleData = validate(schemas.article, req.body);
            const result = await articleService.saveArticle(articleData);
            res.status(201).json(ResponseFormatter.created(result));
        } catch (error) {
            next(error);
        }
    }

    async updateArticle(req, res, next) {
        try {
            const { id } = req.params;
            const articleData = validate(schemas.article, req.body);
            const result = await articleService.updateArticle(id, articleData);
            res.json(ResponseFormatter.updated(result));
        } catch (error) {
            next(error);
        }
    }

    async deleteArticle(req, res, next) {
        try {
            const { id } = req.params;
            await articleService.deleteArticle(id);
            res.json(ResponseFormatter.deleted());
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ArticleController(); 