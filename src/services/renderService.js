const templateService = require('./templateService');
const Handlebars = require('handlebars');

class RenderService {
    async renderTemplate(templateName, data) {
        const templateContent = await templateService.getTemplate(templateName);
        const template = Handlebars.compile(templateContent);
        return template(data);
    }

    async renderWithHelpers(templateContent, data, helpers = {}) {
        // 创建独立的 Handlebars 实例以避免全局污染
        const handlebars = Handlebars.create();
        
        // 注册辅助函数
        Object.entries(helpers).forEach(([name, code]) => {
            try {
                const helper = eval(`(${code})`);
                handlebars.registerHelper(name, helper);
            } catch (e) {
                console.error(`Error registering helper ${name}:`, e);
            }
        });
        
        try {
            const template = handlebars.compile(templateContent);
            return template(data);
        } finally {
            // 清理辅助函数
            Object.keys(helpers).forEach(name => {
                handlebars.unregisterHelper(name);
            });
        }
    }

    async batchRender(templates, data) {
        const results = {};
        for (const [name, content] of Object.entries(templates)) {
            try {
                results[name] = await this.renderWithHelpers(content, data);
            } catch (e) {
                console.error(`Error rendering template ${name}:`, e);
                results[name] = null;
            }
        }
        return results;
    }
}

module.exports = new RenderService(); 