import fs from 'fs';
import path from 'path';
import pdfService from './src/services/pdfService.js';

// Simple test to verify PDF extraction works
async function testPdfExtraction() {
    try {
        console.log('🧪 Testing PDF extraction...');

        // For testing purposes, let's simulate a buffer with some test data
        // In a real scenario, this would be the actual PDF buffer from multer
        const testBuffer = Buffer.from('Mock PDF content for testing');

        const extractedText = await pdfService.extractTextFromPDF(testBuffer);
        console.log('✅ PDF extraction test completed');
        console.log('📄 Extracted text length:', extractedText.length);
        console.log('📄 First 200 characters:', extractedText.substring(0, 200) + '...');

    } catch (error) {
        console.error('❌ PDF extraction test failed:', error.message);
    }
}

testPdfExtraction();
