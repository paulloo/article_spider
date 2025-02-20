const uploadService = require('./uploadService');
const logger = require('./logService');

class CleanupService {
    constructor() {
        this.interval = null;
    }

    start(interval = 60 * 60 * 1000) { // 默认每小时运行一次
        if (this.interval) {
            this.stop();
        }

        this.interval = setInterval(async () => {
            try {
                logger.info('Starting cleanup job');
                await uploadService.cleanupOldFiles();
                logger.info('Cleanup job completed');
            } catch (error) {
                logger.error('Cleanup job failed:', error);
            }
        }, interval);

        logger.info('Cleanup service started');
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            logger.info('Cleanup service stopped');
        }
    }
}

module.exports = new CleanupService(); 