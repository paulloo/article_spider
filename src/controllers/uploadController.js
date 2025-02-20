const uploadService = require('../services/uploadService');
const logger = require('../services/logService');
const { AppError } = require('../middleware/errorHandler');
const ResponseFormatter = require('../utils/responseFormatter');

class UploadController {
    async uploadFile(req, res, next) {
        try {
            if (!req.file) {
                throw new AppError('No file uploaded', 400);
            }

            const result = await uploadService.processUpload(req.file);
            res.status(201).json(ResponseFormatter.created(result));
        } catch (error) {
            // 如果上传失败，清理已上传的文件
            if (req.file) {
                await uploadService.deleteUploadedFile(req.file.filename)
                    .catch(err => logger.error('Failed to cleanup uploaded file', err));
            }
            next(error);
        }
    }

    async getFileInfo(req, res, next) {
        try {
            const { filename } = req.params;
            const fileInfo = await uploadService.getFileInfo(filename);
            res.json(ResponseFormatter.success(fileInfo));
        } catch (error) {
            next(error);
        }
    }

    async deleteFile(req, res, next) {
        try {
            const { filename } = req.params;
            await uploadService.deleteFile(filename);
            res.json(ResponseFormatter.deleted());
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new UploadController(); 