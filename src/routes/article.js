const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @swagger
 * /api/articles:
 *   get:
 *     summary: Get all articles
 *     tags: [Articles]
 *     responses:
 *       200:
 *         description: List of articles
 */
router.get('/', asyncHandler(async (req, res) => {
    return await articleController.getArticleList(req, res);
}));

/**
 * @swagger
 * /api/articles/{id}:
 *   get:
 *     summary: Get article by ID
 *     tags: [Articles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Article details
 */
router.get('/:id', asyncHandler(async (req, res) => {
    return await articleController.getArticle(req, res);
}));

/**
 * @swagger
 * /api/articles:
 *   post:
 *     summary: Create new article
 *     tags: [Articles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Article'
 *     responses:
 *       201:
 *         description: Article created successfully
 */
router.post('/', asyncHandler(async (req, res) => {
    return await articleController.createArticle(req, res);
}));

/**
 * @swagger
 * /api/articles/{id}:
 *   put:
 *     summary: Update article
 *     tags: [Articles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Article'
 *     responses:
 *       200:
 *         description: Article updated successfully
 */
router.put('/:id', asyncHandler(async (req, res) => {
    return await articleController.updateArticle(req, res);
}));

/**
 * @swagger
 * /api/articles/{id}:
 *   delete:
 *     summary: Delete article
 *     tags: [Articles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Article deleted successfully
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    return await articleController.deleteArticle(req, res);
}));

/**
 * @swagger
 * /api/articles/scrape:
 *   post:
 *     summary: Scrape article from URL
 *     tags: [Articles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Article scraped successfully
 */
router.post('/scrape', asyncHandler(articleController.scrapeArticle.bind(articleController)));

module.exports = router; 