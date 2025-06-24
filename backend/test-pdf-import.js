import fs from 'fs';

async function testPdfParseImport() {
    console.log('Testing pdf-parse import...');

    try {
        // Test the import
        const pdfParseModule = await import('pdf-parse');
        console.log('Import successful. Module keys:', Object.keys(pdfParseModule));
        console.log('Default export type:', typeof pdfParseModule.default);
        console.log('Default export:', pdfParseModule.default);

        const pdfParse = pdfParseModule.default;

        if (typeof pdfParse === 'function') {
            console.log('✅ pdf-parse imported successfully as a function');
        } else {
            console.log('❌ pdf-parse is not a function:', typeof pdfParse);
        }

    } catch (error) {
        console.error('❌ Failed to import pdf-parse:', error.message);
        console.error('Error details:', error);
    }
}

testPdfParseImport();
