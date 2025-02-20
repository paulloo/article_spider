const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('./logService');
const { AppError } = require('../middleware/errorHandler');
const articleTemplateService = require('./articleTemplateService');
const https = require('https');

class WikiHowScraper {
    constructor() {
        // 创建自定义的 axios 实例
        this.client = axios.create({
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: (status) => status < 500, // 允许任何非 500 错误的响应
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
                keepAlive: true
            })
        });
    }

    async fetchArticle(url) {
        try {
            logger.debug(`Fetching article from: ${url}`);
            
            // 修正 URL
            const fixedUrl = this._fixUrl(url);
            logger.debug(`Using fixed URL: ${fixedUrl}`);

            // 重试逻辑
            let retries = 3;
            let lastError = null;

            while (retries > 0) {
                try {
                    logger.debug(`Attempt ${4 - retries}/3 to fetch article`);
                    
                    const config = {
                        proxy: false,
                        headers: {
                            ...this.client.defaults.headers,
                            'Referer': new URL(fixedUrl).origin,
                            'Host': new URL(fixedUrl).host
                        }
                    };

                    logger.debug('Request config:', {
                        url: fixedUrl,
                        headers: config.headers
                    });

                    const response = await this.client.get(fixedUrl, config);
                    
                    logger.debug('Response status:', {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });

                    if (response.status === 200) {
                        if (typeof response.data === 'string' && response.data.includes('<html')) {
                            return response.data;
                        }
                        throw new Error('Invalid response format: not HTML');
                    }

                    throw new Error(`HTTP ${response.status}`);
                } catch (error) {
                    lastError = error;
                    retries--;
                    
                    logger.warn(`Fetch attempt failed (${3 - retries}/3):`, {
                        url: fixedUrl,
                        error: error.message,
                        status: error.response?.status,
                        headers: error.response?.headers,
                        stack: error.stack
                    });

                    if (retries > 0) {
                        const delay = 2000 * (4 - retries);
                        logger.debug(`Waiting ${delay}ms before next attempt`);
                        await this._sleep(delay);
                    }
                }
            }

            this._handleFetchError(lastError);
        } catch (error) {
            logger.error('Error fetching article:', {
                error: error.message,
                stack: error.stack,
                url: url
            });
            if (error instanceof AppError) throw error;
            throw new AppError('Failed to fetch article', 500);
        }
    }

    // 修正 URL 格式
    _fixUrl(url) {
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol === 'http:') {
                urlObj.protocol = 'https:';
            }
            // 确保域名格式正确
            if (!urlObj.hostname.includes('wikihow')) {
                throw new AppError('Invalid domain: must be a WikiHow website', 400);
            }
            return urlObj.toString();
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError('Invalid URL format', 400);
        }
    }

    // 延迟函数
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async parseArticle(html, template) {
        try {
            if (!template?.xpath_rules) {
                throw new AppError('Invalid template: no xpath rules found', 400);
            }

            const $ = cheerio.load(html);
            const rules = template.xpath_rules;

            logger.debug('Template rules:', rules);

            // 直接获取标题
            const title = $(rules.title).first().text().trim();
            logger.debug('Title found:', {
                selector: rules.title,
                text: title || 'NOT FOUND'
            });

            if (!title) {
                throw new AppError('Could not find article title', 422);
            }

            // 直接获取简介
            const profile = $(rules.profile).first().text().trim();
            logger.debug('Profile found:', {
                selector: rules.profile,
                text: profile?.substring(0, 100)
            });

            // 获取所有步骤区域
            const steps = [];
            const stepSections = $(rules.steps);
            logger.debug('Step sections found:', {
                count: stepSections.length,
                firstStepHtml: stepSections.first().html()?.substring(0, 200)
            });

            // 遍历每个步骤区域
            stepSections.each((stepIndex, stepSection) => {
                const $step = $(stepSection);
                
                // 在步骤区域内查找标题
                const stepTitle = $step.find(rules.step_title_xpath).first().text().trim();
                logger.debug(`Step ${stepIndex + 1}:`, {
                    title: stepTitle || 'NOT FOUND',
                    id: $step.attr('id')
                });

                // 在步骤区域内查找所有步骤项
                const step_items = [];
                const stepItems = $step.find(rules.step_item_xpath);
                logger.debug(`Step ${stepIndex + 1} items:`, {
                    count: stepItems.length
                });

                // 处理每个步骤项
                stepItems.each((itemIndex, item) => {
                    const $item = $(item);

                    // 在步骤项内查找内容
                    const content = $item.find(rules.step_item_content_xpath).text().trim();
                    if (!content) return;

                    // 在步骤项内查找图片
                    const $img = $item.find(rules.step_item_img_xpath).first();
                    let img = $img.attr('data-src') || $img.attr('src') || '';
                    if (img && img.startsWith('//')) {
                        img = `https:${img}`;
                    }

                    // 获取子项（列表项）
                    const children = [];
                    $item.find('li').each((_, li) => {
                        const text = $(li).text().trim();
                        if (text) children.push(text);
                    });

                    step_items.push({
                        content: this._cleanText(content),
                        children,
                        img
                    });

                    logger.debug(`Step ${stepIndex + 1} item ${itemIndex + 1}:`, {
                        contentLength: content.length,
                        childrenCount: children.length,
                        hasImage: !!img
                    });
                });

                // 只添加有效的步骤
                if (step_items.length > 0) {
                    steps.push({
                        title: this._cleanText(stepTitle || `Step ${stepIndex + 1}`),
                        step_items
                    });
                }
            });

            // 验证结果
            if (steps.length === 0) {
                logger.error('No valid steps found:', {
                    stepsSelector: rules.steps,
                    stepCount: stepSections.length,
                    pageStructure: {
                        title: $('title').text(),
                        bodyClasses: $('body').attr('class'),
                        firstStepHtml: stepSections.first().html()?.substring(0, 200)
                    }
                });
                throw new AppError('No valid content found in article', 422);
            }

            const result = {
                title: this._cleanText(title),
                profile: this._cleanText(profile),
                steps
            };

            logger.debug('Article parsed successfully:', {
                title: result.title,
                stepsCount: steps.length,
                totalItems: steps.reduce((sum, step) => sum + step.step_items.length, 0)
            });

            return result;
        } catch (error) {
            logger.error('Error parsing article:', {
                error: error.message,
                stack: error.stack,
                template: template?.id
            });
            if (error instanceof AppError) throw error;
            throw new AppError('Failed to parse article', 500);
        }
    }

    _findContent($element, selector) {
        try {
            if (!$element || !selector) {
                logger.warn('Invalid parameters for _findContent:', {
                    hasElement: !!$element,
                    selector
                });
                return '';
            }

            const result = $element(selector);
            return result.text().trim();
        } catch (error) {
            logger.error('Error finding content:', {
                selector,
                error: error.message
            });
            return '';
        }
    }

    _findElements($element, selector) {
        try {
            if (!$element || !selector) {
                logger.warn('Invalid parameters for _findElements:', {
                    hasElement: !!$element,
                    selector
                });
                return [];
            }

            return $element(selector);
        } catch (error) {
            logger.error('Error finding elements:', {
                selector,
                error: error.message
            });
            return [];
        }
    }

    _xpathToCSS(xpath) {
        return xpath
            .replace(/\/\//g, '')
            .replace(/\//g, ' > ')
            .replace(/\[@/g, '[')
            .replace(/\=/g, '=')
            .replace(/\]/g, ']')
            .replace(/contains\((@class), ?["']([^"']+)["']\)/g, 'class*="$2"');
    }

    _cleanText(text) {
        if (!text) return '';
        return text
            .replace(/\s+/g, ' ')
            .replace(/\[\d+\]/g, '')  // 移除引用标记 [1], [2] 等
            .trim();
    }

    _handleFetchError(error) {
        if (error.response) {
            const status = error.response.status;
            if (status === 404) {
                throw new AppError('Article not found', 404);
            } else if (status === 403) {
                throw new AppError('Access denied', 403);
            } else if (status === 429) {
                throw new AppError('Too many requests', 429);
            }
            throw new AppError(`Failed to fetch article: ${status}`, 502);
        } else if (error.code === 'ECONNABORTED') {
            throw new AppError('Request timeout', 504);
        } else if (error.code === 'ENOTFOUND') {
            throw new AppError('DNS lookup failed', 503);
        }
        
        throw new AppError('Network error while fetching article', 503);
    }
}

module.exports = new WikiHowScraper(); 