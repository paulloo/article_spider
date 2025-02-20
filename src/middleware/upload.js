const multer = require('multer');
const config = require('../config');
const fileHelper = require('../utils/fileHelper');
const path = require('path');

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await fileHelper.ensureDir(config.UPLOAD_FOLDER);
            cb(null, config.UPLOAD_FOLDER);
        } catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
        const ext = path.extname(file.originalname.toLowerCase());
        const filename = `preview_${timestamp}${ext}`;
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = config.ALLOWED_EXTENSIONS.map(ext => `image/${ext}`);
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

module.exports = {
    upload,
    handleUploadError: (err, req, res, next) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    error: 'File too large. Maximum size is 5MB'
                });
            }
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
}; 