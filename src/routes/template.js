const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');

/**
 * @swagger
 * /api/handlebars-templates:
 *   get:
 *     summary: Get all Handlebars templates
 *     tags: [Handlebars Templates]
 *     responses:
 *       200:
 *         description: List of templates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Template'
 */
router.get('/', templateController.getTemplateList);

/**
 * @swagger
 * /api/handlebars-templates/{id}:
 *   get:
 *     summary: Get template by ID
 *     tags: [Handlebars Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template details
 *       404:
 *         description: Template not found
 */
router.get('/:id', templateController.getTemplateById);

/**
 * @swagger
 * /api/handlebars-templates:
 *   post:
 *     summary: Create new template
 *     tags: [Handlebars Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Template'
 *     responses:
 *       200:
 *         description: Template created successfully
 */
router.post('/', templateController.createTemplate);

/**
 * @swagger
 * /api/handlebars-templates/{id}:
 *   put:
 *     summary: Update template
 *     tags: [Handlebars Templates]
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
 *             type: object
 *             required:
 *               - template_content
 *             properties:
 *               template_content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Template updated successfully
 */
router.put('/:id', templateController.updateTemplate);

/**
 * @swagger
 * /api/handlebars-templates/render:
 *   post:
 *     summary: Render article with template
 *     tags: [Handlebars Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - template_id
 *               - article_data
 *             properties:
 *               template_id:
 *                 type: string
 *                 description: ID of the template to use
 *               article_id:
 *                 type: string
 *                 description: ID of the article (optional)
 *               article_data:
 *                 type: object
 *                 description: Article data for template rendering
 *     responses:
 *       200:
 *         description: Template rendered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 html:
 *                   type: string
 *                   description: Rendered HTML content
 *                 template_name:
 *                   type: string
 *                   description: Name of the template used
 *                 article_id:
 *                   type: string
 *                   description: ID of the article
 */
router.post('/render', templateController.renderTemplate);

/**
 * @swagger
 * /api/handlebars-templates/batch-render:
 *   post:
 *     summary: Render multiple templates
 *     tags: [Handlebars Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templates
 *               - data
 *             properties:
 *               templates:
 *                 type: object
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Templates rendered successfully
 */
router.post('/batch-render', templateController.batchRender);

/**
 * @swagger
 * /api/handlebars-templates/partials:
 *   post:
 *     summary: Import partial template
 *     tags: [Handlebars Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - content
 *             properties:
 *               name:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Partial template imported successfully
 */
router.post('/partials', templateController.importPartial);

/**
 * @swagger
 * /api/handlebars-templates/partials:
 *   get:
 *     summary: Get list of partial templates
 *     tags: [Handlebars Templates]
 *     responses:
 *       200:
 *         description: List of partial templates
 */
router.get('/partials', templateController.getPartialsList);

/**
 * @swagger
 * /api/handlebars-templates/{id}:
 *   delete:
 *     summary: Delete template
 *     tags: [Handlebars Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template deleted successfully
 */
router.delete('/:id', templateController.deleteTemplate);

/**
 * @swagger
 * /api/handlebars-templates/{id}/precompiled:
 *   get:
 *     summary: Get precompiled template
 *     tags: [Handlebars Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Precompiled template
 */
router.get('/:id/precompiled', templateController.getPrecompiledTemplate);

module.exports = router; 