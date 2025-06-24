// PDF Service - Real PDF text extraction using pdfjs-dist
class PDFService {
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
}

export default new PDFService();
