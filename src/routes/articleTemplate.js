const express = require('express');
const router = express.Router();
const articleTemplateController = require('../controllers/articleTemplateController');

/**
 * @swagger
 * /api/article-templates:
 *   get:
 *     summary: Get all article scraping templates
 *     tags: [Article Templates]
 *     responses:
 *       200:
 *         description: List of article templates
 */
router.get('/', articleTemplateController.getTemplateList);

/**
 * @swagger
 * /api/article-templates/{filename}:
 *   get:
 *     summary: Get article template by filename
 *     tags: [Article Templates]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Article template details
 */
router.get('/:filename', articleTemplateController.getTemplate);

/**
 * @swagger
 * /api/article-templates:
 *   post:
 *     summary: Create new article template
 *     tags: [Article Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - xpaths
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               xpaths:
 *                 type: object
 *     responses:
 *       200:
 *         description: Template created successfully
 */
router.post('/', articleTemplateController.createTemplate);

/**
 * @swagger
 * /api/article-templates/{filename}:
 *   put:
 *     summary: Update article template
 *     tags: [Article Templates]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ArticleTemplate'
 *     responses:
 *       200:
 *         description: Template updated successfully
 */
router.put('/:filename', articleTemplateController.updateTemplate);

/**
 * @swagger
 * /api/article-templates/{filename}:
 *   delete:
 *     summary: Delete article template
 *     tags: [Article Templates]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template deleted successfully
 */
router.delete('/:filename', articleTemplateController.deleteTemplate);

/**
 * @swagger
 * /api/article-templates/{filename}/test:
 *   post:
 *     summary: Test article template with URL
 *     tags: [Article Templates]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Template test results
 */
router.post('/:filename/test', articleTemplateController.testTemplate);

/**
 * @swagger
 * /api/article-templates/validate:
 *   post:
 *     summary: Validate article template
 *     tags: [Article Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ArticleTemplate'
 *     responses:
 *       200:
 *         description: Template validation results
 */
router.post('/validate', articleTemplateController.validateTemplate);

// ... 其他路由

module.exports = router; 