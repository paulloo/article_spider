const NodeCache = require('node-cache');
const logger = require('./logService');

class CacheService {
    constructor() {
        this.cache = new NodeCache({
            stdTTL: 300, // 默认缓存时间 5 分钟
            checkperiod: 60 // 每分钟检查过期的缓存
        });
    }

    // 获取缓存，如果不存在则使用 getter 函数获取并缓存
    async get(key, getter, ttl = 300) {
        try {
            // 尝试从缓存获取
            let data = this.cache.get(key);
            
            // 如果缓存不存在，使用 getter 函数获取
            if (data === undefined && getter) {
                logger.debug(`Cache miss for key: ${key}`);
                data = await getter();
                
                // 只缓存非空值
                if (data !== undefined && data !== null) {
                    this.cache.set(key, data, ttl);
                    logger.debug(`Cached data for key: ${key}`);
                }
            } else {
                logger.debug(`Cache hit for key: ${key}`);
            }
            
            return data;
        } catch (error) {
            logger.error(`Cache error for key ${key}:`, error);
            // 如果缓存操作失败，直接使用 getter 函数
            return getter ? getter() : undefined;
        }
    }

    // 设置缓存
    set(key, value, ttl = 300) {
        try {
            this.cache.set(key, value, ttl);
            logger.debug(`Set cache for key: ${key}`);
            return true;
        } catch (error) {
            logger.error(`Failed to set cache for key ${key}:`, error);
            return false;
        }
    }

    // 删除缓存
    del(key) {
        try {
            this.cache.del(key);
            logger.debug(`Deleted cache for key: ${key}`);
            return true;
        } catch (error) {
            logger.error(`Failed to delete cache for key ${key}:`, error);
            return false;
        }
    }

    // 清空所有缓存
    flush() {
        try {
            this.cache.flushAll();
            logger.debug('Flushed all cache');
            return true;
        } catch (error) {
            logger.error('Failed to flush cache:', error);
            return false;
        }
    }
}

module.exports = new CacheService(); 