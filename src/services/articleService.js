const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fileHelper = require('../utils/fileHelper');
const logger = require('./logService');
const { AppError } = require('../middleware/errorHandler');
const cacheService = require('./cacheService');
const { paths, fileNames } = require('../config');

class ArticleService {
    async getArticleList() {
        try {
            return await cacheService.get('articles:list', async () => {
                await fileHelper.ensureDir(paths.articles.processed);
                const files = await fs.readdir(paths.articles.processed);
                
                const articles = await Promise.all(
                    files.filter(f => f.endsWith('.json'))
                        .map(async filename => {
                            try {
                                const content = await fs.readFile(
                                    path.join(paths.articles.processed, filename),
                                    'utf8'
                                );
                                const article = JSON.parse(content);
                                return {
                                    id: article.id,
                                    title: article.title,
                                    url: article.url,
                                    slug: article.slug,
                                    created_at: article.created_at,
                                    updated_at: article.updated_at
                                };
                            } catch (error) {
                                logger.error(`Error reading article ${filename}:`, error);
                                return null;
                            }
                        })
                );
                
                return articles.filter(Boolean);
            }, 300);
        } catch (error) {
            logger.error('Error getting article list:', error);
            throw new AppError('Failed to get article list', 500);
        }
    }

    async getArticle(id) {
        try {
            const cacheKey = `article:${id}`;
            return await cacheService.get(cacheKey, async () => {
                await fileHelper.ensureDir(paths.articles.processed);
                
                // 通过 ID 查找文章
                const articles = await this.getArticleList();
                const article = articles.find(a => a.id === id);
                
                if (!article) {
                    throw new AppError('Article not found', 404);
                }

                const filepath = path.join(paths.articles.processed, `${article.slug}.json`);
                const content = await fs.readFile(filepath, 'utf8');
                return JSON.parse(content);
            }, 300);
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error(`Error getting article ${id}:`, error);
            throw new AppError('Failed to get article', 500);
        }
    }

    async saveArticle(article) {
        try {
            // 生成 UUID 和 slug
            const id = uuidv4();
            const slug = fileHelper.sanitizeFilename(article.title);
            const timestamp = new Date().toISOString();

            // 添加元数据
            const enrichedArticle = {
                ...article,
                id,
                slug,
                created_at: timestamp,
                updated_at: timestamp
            };

            // 保存原始数据
            await fileHelper.saveFile(
                path.join(paths.articles.raw, `${id}_raw.json`),
                enrichedArticle
            );

            // 处理并保存文章
            const processedArticle = await this._processArticle(enrichedArticle);
            await fileHelper.saveFile(
                path.join(paths.articles.processed, `${slug}.json`),
                processedArticle
            );

            await this._clearArticleCache();
            return {
                id,
                slug,
                title: article.title,
                created_at: timestamp
            };
        } catch (error) {
            logger.error('Error saving article:', error);
            throw new AppError('Failed to save article', 500);
        }
    }

    async updateArticle(id, articleData) {
        try {
            const existingArticle = await this.getArticle(id);
            if (!existingArticle) {
                throw new AppError('Article not found', 404);
            }

            const timestamp = new Date().toISOString();
            const updatedArticle = {
                ...existingArticle,
                ...articleData,
                id,  // 保持原有 ID
                slug: existingArticle.slug, // 保持原有 slug
                updated_at: timestamp
            };

            // 更新处理后的文章
            const processedArticle = await this._processArticle(updatedArticle);
            await fileHelper.saveFile(
                path.join(paths.articles.processed, `${updatedArticle.slug}.json`),
                processedArticle
            );

            await this._clearArticleCache();
            return {
                id,
                slug: updatedArticle.slug,
                title: updatedArticle.title,
                updated_at: timestamp
            };
        } catch (error) {
            logger.error(`Error updating article ${id}:`, error);
            throw new AppError('Failed to update article', 500);
        }
    }

    async _processArticle(article) {
        return {
            ...article,
            processed_at: new Date().toISOString()
        };
    }

    async _clearArticleCache() {
        await cacheService.del('articles:list');
    }
}

module.exports = new ArticleService(); 