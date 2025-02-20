const fs = require('fs');
const path = require('path');
const swaggerSpec = require('../src/config/swagger');

const outputPath = path.join(__dirname, '../docs/api.json');

fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
console.log(`API documentation generated at ${outputPath}`); 