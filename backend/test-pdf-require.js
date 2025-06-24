import { createRequire } from 'module';

const require = createRequire(import.meta.url);

console.log('Testing pdf-parse with createRequire...');

try {
    const pdfParse = require('pdf-parse');
    console.log('✅ pdf-parse loaded successfully!');
    console.log('Type:', typeof pdfParse);
    console.log('Is function:', typeof pdfParse === 'function');
} catch (error) {
    console.error('❌ Failed to load pdf-parse:', error.message);
}
