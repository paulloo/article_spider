const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'WikiHow Article Service API',
            version: '1.0.0',
            description: 'API documentation for WikiHow article scraping and template service',
            contact: {
                name: 'API Support',
                email: 'support@example.com'
            }
        },
        servers: [
            {
                url: process.env.API_BASE_URL || 'http://localhost:5508',
                description: 'API Server'
            }
        ],
        tags: [
            {
                name: 'Article Templates',
                description: 'Article scraping template operations'
            },
            {
                name: 'Handlebars Templates',
                description: 'Handlebars rendering template operations'
            }
        ],
        components: {
            schemas: {
                Article: {
                    type: 'object',
                    required: ['title', 'profile', 'steps'],
                    properties: {
                        title: {
                            type: 'string',
                            description: 'Article title'
                        },
                        profile: {
                            type: 'string',
                            description: 'Article introduction'
                        },
                        steps: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    title: {
                                        type: 'string',
                                        description: 'Step title'
                                    },
                                    items: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                content: {
                                                    type: 'string',
                                                    description: 'Step content'
                                                },
                                                image: {
                                                    type: 'string',
                                                    description: 'Image URL'
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                Template: {
                    type: 'object',
                    required: ['name', 'template_content'],
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Template name'
                        },
                        template_content: {
                            type: 'string',
                            description: 'Handlebars template content'
                        },
                        helpers: {
                            type: 'object',
                            description: 'Template helper functions'
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        status: {
                            type: 'string',
                            enum: ['fail', 'error']
                        },
                        message: {
                            type: 'string'
                        },
                        details: {
                            type: 'array',
                            items: {
                                type: 'object'
                            }
                        }
                    }
                },
                UploadResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean'
                        },
                        filename: {
                            type: 'string'
                        },
                        url: {
                            type: 'string'
                        },
                        size: {
                            type: 'number'
                        },
                        mimetype: {
                            type: 'string'
                        }
                    }
                },
                FileInfo: {
                    type: 'object',
                    properties: {
                        filename: {
                            type: 'string'
                        },
                        url: {
                            type: 'string'
                        },
                        size: {
                            type: 'number'
                        },
                        created: {
                            type: 'string',
                            format: 'date-time'
                        },
                        modified: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                }
            }
        }
    },
    apis: ['./src/routes/*.js'] // API 路由文件的路径
};

module.exports = swaggerJsdoc(options); 