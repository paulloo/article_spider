const Joi = require('joi');
const { AppError } = require('../middleware/errorHandler');

const schemas = {
    article: Joi.object({
        title: Joi.string().required(),
        profile: Joi.string().required(),
        guide: Joi.string().default("点击上方蓝字关注我们"),
        steps: Joi.array().items(
            Joi.object({
                title: Joi.string().required(),
                step_items: Joi.array().items(
                    Joi.object({
                        content: Joi.string().required(),
                        children: Joi.array().items(Joi.string()),
                        img: Joi.string().allow('')
                    })
                )
            })
        ).required(),
        url: Joi.string().uri(),
        source: Joi.object({
            url: Joi.string().uri().required(),
            template_id: Joi.string().required(),
            template_name: Joi.string().required(),
            scraped_at: Joi.string().isoDate().required()
        })
    }),

    template: Joi.object({
        name: Joi.string().required(),
        template_content: Joi.string().required(),
        helpers: Joi.object().pattern(
            Joi.string(),
            Joi.string()
        )
    }),

    articleTemplate: Joi.object({
        name: Joi.string().required(),
        xpath_rules: Joi.object({
            title: Joi.string().required(),
            profile: Joi.string().required(),
            steps: Joi.string().required(),
            step_title_xpath: Joi.string().required(),
            step_item_xpath: Joi.string().required(),
            step_item_content_xpath: Joi.string().required(),
            step_item_img_xpath: Joi.string().allow('')
        }).required(),
        description: Joi.string(),
        preview_image: Joi.string().uri(),
        created_at: Joi.string().isoDate(),
        updated_at: Joi.string().isoDate(),
        id: Joi.string().guid(),
        template_content: Joi.object({
            type: Joi.string(),
            version: Joi.string(),
            style: Joi.string(),
            sections: Joi.array()
        }),
        html_template: Joi.object({
            version: Joi.string(),
            content: Joi.string(),
            helpers: Joi.object()
        })
    }),

    scrapeArticle: Joi.object({
        url: Joi.string()
            .uri()
            .required()
            .pattern(/^https?:\/\/([\w-]+\.)?wikihow\.\w+\/[^\/]+$/)
            .message('URL must be a valid WikiHow article URL'),
        template_id: Joi.string()
            .required()
            .description('Template ID for scraping article')
    }),

    renderTemplate: Joi.object({
        template_id: Joi.string()
            .required()
            .description('Template ID to use for rendering'),
        article_id: Joi.string()
            .optional()
            .description('Article ID for reference'),
        article_data: Joi.alternatives().try(
            // 直接的文章数据结构
            Joi.object({
                title: Joi.string().required(),
                profile: Joi.string().required(),
                guide: Joi.string().default("点击上方蓝字关注我们"),
                steps: Joi.array().items(
                    Joi.object({
                        title: Joi.string().required(),
                        step_items: Joi.array().items(
                            Joi.object({
                                content: Joi.string().required(),
                                children: Joi.array().items(Joi.string()),
                                img: Joi.string().allow('')
                            })
                        )
                    })
                ).required(),
                history: Joi.array().items(
                    Joi.object({
                        title: Joi.string().required(),
                        url: Joi.string().uri().required()
                    })
                ).default([])
            }),
            // 带分页的文章列表结构
            Joi.object({
                items: Joi.array().items(
                    Joi.object({
                        id: Joi.string().required(),
                        title: Joi.string().required(),
                        url: Joi.string().uri().required(),
                        slug: Joi.string().required(),
                        created_at: Joi.string().isoDate(),
                        updated_at: Joi.string().isoDate()
                    })
                ).required(),
                pagination: Joi.object({
                    total: Joi.number(),
                    page: Joi.number(),
                    limit: Joi.number()
                }).allow(null),
                guide: Joi.string().default("点击上方蓝字关注我们"),
                history: Joi.array().items(
                    Joi.object({
                        title: Joi.string().required(),
                        url: Joi.string().uri().required()
                    })
                ).default([])
            })
        ).required()
    }).required()
};

const validate = (schema, data) => {
    try {
        const { error, value } = schema.validate(data, {
            abortEarly: false,
            stripUnknown: true
        });
        
        if (error) {
            logger.error('Validation error:', {
                details: error.details.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
            
            throw new AppError('Validation error', 400, error.details);
        }
        
        return value;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('Validation failed', 500);
    }
};

module.exports = {
    schemas,
    validate
}; 