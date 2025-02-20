const express = require('express');
const Handlebars = require('handlebars');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 预编译模板
app.post('/precompile', (req, res) => {
    try {
        const { template } = req.body;
        if (!template) {
            return res.status(400).json({ error: 'Template content is required' });
        }

        // 预编译模板
        const precompiled = Handlebars.precompile(template);
        
        // 返回预编译后的代码
        res.json({
            success: true,
            precompiled: precompiled
        });
    } catch (error) {
        console.error('Precompilation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 渲染模板
app.post('/render', (req, res) => {
    try {
        const { template, data, helpers } = req.body;
        
        if (!template || !data) {
            return res.status(400).json({ error: 'Template and data are required' });
        }

        // 注册辅助函数
        if (helpers) {
            Object.entries(helpers).forEach(([name, code]) => {
                try {
                    // 安全地执行辅助函数代码
                    const helper = eval(`(${code})`);
                    Handlebars.registerHelper(name, helper);
                } catch (e) {
                    console.error(`Error registering helper ${name}:`, e);
                }
            });
        }

        // 编译并渲染模板
        const compiledTemplate = Handlebars.compile(template);
        const rendered = compiledTemplate(data);

        // 清理注册的辅助函数
        if (helpers) {
            Object.keys(helpers).forEach(name => {
                Handlebars.unregisterHelper(name);
            });
        }

        res.json({
            success: true,
            rendered: rendered
        });
    } catch (error) {
        console.error('Rendering error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Handlebars service running on port ${PORT}`);
}); 