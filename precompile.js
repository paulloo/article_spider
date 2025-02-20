const Handlebars = require('handlebars');
const fs = require('fs');

const templatePath = process.argv[2];
const template = fs.readFileSync(templatePath, 'utf8');

const precompiled = Handlebars.precompile(template);
console.log(precompiled); 