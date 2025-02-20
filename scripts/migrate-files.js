const fs = require('fs').promises;
const path = require('path');
const { paths } = require('../src/config');
const logger = require('../src/services/logService');

class FileMigration {
    constructor() {
        // 旧目录路径
        this.oldPaths = {
            data: path.join(process.cwd(), 'data'),
            templates: path.join(process.cwd(), 'templates'),
            handlebars: path.join(process.cwd(), 'handlebars_templates')
        };

        // 迁移映射规则
        this.migrationRules = [
            {
                from: this.oldPaths.data,
                to: paths.articles.processed,
                pattern: /\.json$/,
                transform: this.transformArticleFile.bind(this)
            },
            {
                from: this.oldPaths.templates,
                to: paths.templates.scraping,
                pattern: /\.json$/,
                transform: this.transformScrapingTemplate.bind(this)
            },
            {
                from: this.oldPaths.handlebars,
                to: paths.templates.rendering,
                pattern: /\.hbs$/,
                transform: this.transformRenderingTemplate.bind(this)
            }
        ];
    }

    async migrate() {
        try {
            // 创建新目录结构
            await this.createDirectories();
            
            // 执行迁移
            for (const rule of this.migrationRules) {
                await this.migrateFiles(rule);
            }

            logger.info('Migration completed successfully');
        } catch (error) {
            logger.error('Migration failed:', error);
            process.exit(1);
        }
    }

    async createDirectories() {
        const allPaths = [
            paths.articles.root,
            paths.articles.raw,
            paths.articles.processed,
            paths.templates.root,
            paths.templates.scraping,
            paths.templates.rendering,
            paths.templates.partials,
            paths.uploads.root,
            paths.uploads.images,
            paths.uploads.temp
        ];

        for (const dir of allPaths) {
            await fs.mkdir(dir, { recursive: true });
            logger.info(`Created directory: ${dir}`);
        }
    }

    async migrateFiles({ from, to, pattern, transform }) {
        try {
            // 检查源目录是否存在
            if (!await this.pathExists(from)) {
                logger.warn(`Source directory not found: ${from}`);
                return;
            }

            const files = await fs.readdir(from);
            const matchedFiles = files.filter(f => pattern.test(f));

            logger.info(`Found ${matchedFiles.length} files to migrate from ${from}`);

            for (const file of matchedFiles) {
                try {
                    const sourcePath = path.join(from, file);
                    const content = await fs.readFile(sourcePath, 'utf8');
                    
                    // 转换文件内容和名称
                    const { newContent, newName } = await transform(content, file);
                    const targetPath = path.join(to, newName);

                    // 写入新文件
                    await fs.writeFile(targetPath, newContent);
                    logger.info(`Migrated: ${file} -> ${newName}`);

                    // 创建备份
                    const backupDir = path.join(from, 'backup');
                    await fs.mkdir(backupDir, { recursive: true });
                    await fs.rename(sourcePath, path.join(backupDir, file));
                } catch (error) {
                    logger.error(`Failed to migrate file ${file}:`, error);
                }
            }
        } catch (error) {
            logger.error(`Failed to migrate files from ${from}:`, error);
        }
    }

    async transformArticleFile(content, filename) {
        const data = JSON.parse(content);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '');
        
        return {
            newContent: JSON.stringify({
                ...data,
                migrated_at: new Date().toISOString(),
                original_filename: filename
            }, null, 2),
            newName: `article_${timestamp}.json`
        };
    }

    async transformScrapingTemplate(content, filename) {
        const data = JSON.parse(content);
        return {
            newContent: JSON.stringify({
                ...data,
                migrated_at: new Date().toISOString(),
                original_filename: filename
            }, null, 2),
            newName: `${path.parse(filename).name}_scraping.json`
        };
    }

    async transformRenderingTemplate(content, filename) {
        return {
            newContent: content,
            newName: `${path.parse(filename).name}_template.hbs`
        };
    }

    async pathExists(p) {
        try {
            await fs.access(p);
            return true;
        } catch {
            return false;
        }
    }

    async validateMigration() {
        const results = {
            success: true,
            errors: []
        };

        for (const rule of this.migrationRules) {
            const sourceFiles = await this.getFileCount(rule.from, rule.pattern);
            const targetFiles = await this.getFileCount(rule.to, rule.pattern);

            if (sourceFiles.count !== targetFiles.count) {
                results.success = false;
                results.errors.push({
                    source: rule.from,
                    target: rule.to,
                    sourceCount: sourceFiles.count,
                    targetCount: targetFiles.count,
                    missing: sourceFiles.files.filter(f => !targetFiles.files.includes(f))
                });
            }
        }

        return results;
    }

    async getFileCount(dir, pattern) {
        if (!await this.pathExists(dir)) {
            return { count: 0, files: [] };
        }

        const files = await fs.readdir(dir);
        const matchedFiles = files.filter(f => pattern.test(f));
        return {
            count: matchedFiles.length,
            files: matchedFiles
        };
    }
}

// 运行迁移
if (require.main === module) {
    const migration = new FileMigration();
    
    migration.migrate()
        .then(() => migration.validateMigration())
        .then(validation => {
            if (!validation.success) {
                logger.error('Migration validation failed:', validation.errors);
                process.exit(1);
            }
            logger.info('Migration validated successfully');
        })
        .catch(error => {
            logger.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = FileMigration; 