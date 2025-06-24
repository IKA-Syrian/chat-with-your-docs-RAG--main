// Enhanced PDF Service - Complements existing PDF processing with metadata extraction and pdfjs-dist
// Note: This works alongside the existing PDF processing in routes/process.js
class EnhancedPDFService {
    async extractTextFromPDF(buffer) {
        try {
            console.log('📄 Processing uploaded PDF file...');
            console.log('📄 Buffer size:', buffer.length, 'bytes');

            // Validate PDF header
            const pdfHeader = buffer.slice(0, 4).toString();
            if (pdfHeader !== '%PDF') {
                console.log('📄 PDF Header found:', pdfHeader);
                throw new Error('Invalid PDF file format');
            }

            // Import pdfjs-dist dynamically
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

            // Load the PDF document
            const loadingTask = pdfjsLib.getDocument({
                data: new Uint8Array(buffer),
                verbosity: 0 // Suppress console warnings
            });

            const pdf = await loadingTask.promise;
            console.log(`📄 PDF has ${pdf.numPages} pages`);

            let fullText = '';

            // Extract text from each page
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                try {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();

                    const pageText = textContent.items
                        .map(item => item.str)
                        .join(' ')
                        .replace(/\s+/g, ' ')
                        .trim();

                    if (pageText) {
                        fullText += pageText + '\n\n';
                        console.log(`📄 Extracted from page ${pageNum}/${pdf.numPages}: ${pageText.length} chars`);
                    }
                } catch (pageError) {
                    console.warn(`⚠️ Failed to extract text from page ${pageNum}:`, pageError.message);
                }
            }

            const extractedText = fullText.trim();

            if (!extractedText || extractedText.length < 10) {
                throw new Error('No meaningful text content found in the PDF');
            }

            console.log(`✅ Successfully extracted ${extractedText.length} characters from PDF`);
            console.log('📄 First 200 characters:', extractedText.substring(0, 200) + '...');

            return extractedText;

        } catch (error) {
            console.error('❌ Error extracting PDF text:', error.message);
            throw new Error(`Failed to extract text from PDF: ${error.message}`);
        }
    }

    // Fallback to pdf-parse if pdfjs-dist fails
    async extractTextWithFallback(buffer) {
        try {
            // Try enhanced extraction first
            return await this.extractTextFromPDF(buffer);
        } catch (error) {
            console.warn('⚠️ Enhanced PDF extraction failed, falling back to pdf-parse...');

            try {
                // Dynamic import of pdf-parse
                const pdfParse = (await import('pdf-parse')).default;
                const data = await pdfParse(buffer);

                if (!data.text || data.text.length < 10) {
                    throw new Error('No meaningful text content found in the PDF');
                }

                console.log(`✅ Fallback extraction successful: ${data.text.length} characters`);
                return data.text;
            } catch (fallbackError) {
                console.error('❌ Both PDF extraction methods failed:', fallbackError.message);
                throw new Error(`Failed to extract text from PDF: ${fallbackError.message}`);
            }
        }
    }

    // Validate PDF file
    validatePDF(buffer) {
        if (!buffer || buffer.length === 0) {
            throw new Error('No file data provided');
        }

        const pdfHeader = buffer.slice(0, 4).toString();
        if (pdfHeader !== '%PDF') {
            throw new Error('Invalid PDF file format');
        }

        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (buffer.length > maxSize) {
            throw new Error('PDF file too large (max 10MB)');
        }

        return true;
    }

    // Extract metadata from PDF
    async extractMetadata(buffer) {
        try {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
            const loadingTask = pdfjsLib.getDocument({
                data: new Uint8Array(buffer),
                verbosity: 0
            });

            const pdf = await loadingTask.promise;
            const metadata = await pdf.getMetadata();

            return {
                numPages: pdf.numPages,
                title: metadata.info?.Title || 'Unknown',
                author: metadata.info?.Author || 'Unknown',
                subject: metadata.info?.Subject || '',
                creator: metadata.info?.Creator || '',
                producer: metadata.info?.Producer || '',
                creationDate: metadata.info?.CreationDate || null,
                modificationDate: metadata.info?.ModDate || null
            };
        } catch (error) {
            console.warn('⚠️ Could not extract PDF metadata:', error.message);
            return {
                numPages: 0,
                title: 'Unknown',
                author: 'Unknown',
                subject: '',
                creator: '',
                producer: '',
                creationDate: null,
                modificationDate: null
            };
        }
    }
}

export default new EnhancedPDFService(); 