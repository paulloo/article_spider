const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const config = require('../config');
const path = require('path');

// 配置 multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, config.paths.uploads.temp);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: config.MAX_FILE_SIZE
    },
    fileFilter: function (req, file, cb) {
        if (config.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
        }
    }
});

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload a file
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: File uploaded successfully
 */
router.post('/', upload.single('file'), uploadController.uploadFile);

/**
 * @swagger
 * /api/upload/{filename}:
 *   get:
 *     summary: Get file info
 *     tags: [Upload]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File information
 */
router.get('/:filename', uploadController.getFileInfo);

/**
 * @swagger
 * /api/upload/{filename}:
 *   delete:
 *     summary: Delete file
 *     tags: [Upload]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File deleted successfully
 */
router.delete('/:filename', uploadController.deleteFile);

module.exports = router; 