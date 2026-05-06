/**
 * @swagger
 * tags:
 *   name: Processing
 *   description: Document processing, text extraction, and embedding generation endpoints
 */

import { Router } from 'express';
import { createUserClient, supabaseAdmin } from '../lib/supabase.js';
import { validateUser } from './auth.js';
import { processMarkdown } from '../lib/markdown-parser.js';
import aiProviderManager from '../lib/ai-providers.js';
import crypto from 'crypto';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import os from 'os';
import dotenv from 'dotenv';
import { createRequire } from 'module';

const router = Router();
const LOG_DIR = path.join(process.cwd(), 'logs');

// Load environment variables
dotenv.config();

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Optional OpenAI client - only initialize if API key is provided
let openai = null;
try {
    if (process.env.OPENAI_API_KEY) {
        const { default: OpenAI } = await import('openai');
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('✅ OpenAI client initialized');
    } else {
        console.log('⚠️ OpenAI API key not found, OpenAI embeddings disabled');
    }
} catch (error) {
    console.log('⚠️ OpenAI initialization failed:', error.message);
}

// Optional PDF and PPTX parsers
let pdfParse = null;
try {
    // Try dynamic import first (for ES modules)
    const pdfParseModule = await import('pdf-parse');
    pdfParse = pdfParseModule.default || pdfParseModule;
    console.log('✅ pdf-parse loaded via dynamic import');
} catch (dynamicImportError) {
    try {
        // Fallback to createRequire for CommonJS modules
        const require = createRequire(import.meta.url);
        pdfParse = require('pdf-parse');
        console.log('✅ pdf-parse loaded via createRequire');
    } catch (requireError) {
        console.log('⚠️ pdf-parse not available:', {
            dynamicImport: dynamicImportError.message,
            require: requireError.message
        });
        console.log('📄 PDF processing will be disabled');
    }
}

let pptxParser = null;
try {
    const { default: _pptx } = await import('pptx2json');
    pptxParser = _pptx;
    console.log('✅ pptx2json loaded');
} catch { console.log('⚠️ pptx2json not installed – PPTX support disabled'); }

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Logger setup
const logger = {
    log: function (message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `${timestamp} - INFO: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
        console.log(logMessage);
        this.writeToFile('process', logMessage);
    },
    error: function (message, error = null) {
        const timestamp = new Date().toISOString();
        const errorDetails = error instanceof Error ?
            `${error.message}\n${error.stack}` :
            (error ? JSON.stringify(error, null, 2) : '');
        const logMessage = `${timestamp} - ERROR: ${message}${errorDetails ? '\n' + errorDetails : ''}`;
        console.error(logMessage);
        this.writeToFile('process-error', logMessage);
    },
    writeToFile: function (prefix, message) {
        const date = new Date().toISOString().split('T')[0];
        const logFile = path.join(LOG_DIR, `${prefix}-${date}.log`);
        fs.appendFileSync(logFile, message + '\n\n');
    }
};

// Helper function to split content into sections
function splitIntoSections(content) {
    // Simple implementation - split by paragraphs
    // In a real-world scenario, you might want more sophisticated splitting
    const paragraphs = content.split(/\n\s*\n/);

    // Filter out empty paragraphs and create sections
    return paragraphs
        .filter(p => p.trim().length > 0)
        .map(p => p.trim());
}

// Helper function to split text into chunks
function splitTextIntoChunks(text, maxChunkSize = 1000, overlapSize = 200) {
    // Clean up the text - normalize whitespace but preserve paragraph breaks
    const cleanedText = text
        .replace(/\r\n/g, '\n')  // Normalize line endings
        .replace(/\r/g, '\n')    // Handle old Mac line endings
        .replace(/\n{3,}/g, '\n\n')  // Limit consecutive newlines to max 2
        .replace(/[ \t]+/g, ' ')     // Normalize spaces and tabs
        .trim();

    console.log(`📝 Original text length: ${text.length}, cleaned: ${cleanedText.length}`);

    // If text is shorter than max chunk size, return it as a single chunk
    if (cleanedText.length <= maxChunkSize) {
        console.log('📝 Text fits in single chunk');
        return [cleanedText];
    }

    const chunks = [];
    let startIndex = 0;

    // Split by paragraphs first to respect document structure
    const paragraphs = cleanedText.split(/\n\s*\n/);
    console.log(`📝 Found ${paragraphs.length} paragraphs`);

    let currentChunk = '';

    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i].trim();

        if (!paragraph) continue;

        // If adding this paragraph would exceed chunk size
        if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
            // If current chunk has content, save it
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());

                // Start new chunk with overlap from previous chunk
                const words = currentChunk.trim().split(/\s+/);
                const overlapWords = words.slice(-Math.floor(overlapSize / 6)); // Roughly estimate words for overlap
                currentChunk = overlapWords.join(' ') + '\n\n';
            } else {
                currentChunk = '';
            }

            // If paragraph itself is too long, split it by sentences
            if (paragraph.length > maxChunkSize) {
                const sentences = splitParagraphIntoSentences(paragraph);

                for (const sentence of sentences) {
                    if (currentChunk.length + sentence.length + 1 > maxChunkSize) {
                        if (currentChunk.trim()) {
                            chunks.push(currentChunk.trim());

                            // Create overlap
                            const words = currentChunk.trim().split(/\s+/);
                            const overlapWords = words.slice(-Math.floor(overlapSize / 6));
                            currentChunk = overlapWords.join(' ') + ' ';
                        } else {
                            currentChunk = '';
                        }
                    }

                    currentChunk += sentence + ' ';
                }
            } else {
                currentChunk += paragraph + '\n\n';
            }
        } else {
            currentChunk += paragraph + '\n\n';
        }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    console.log(`📝 Created ${chunks.length} chunks`);

    // Log chunk sizes for debugging
    chunks.forEach((chunk, index) => {
        console.log(`📝 Chunk ${index + 1}: ${chunk.length} characters`);
    });

    return chunks;
}

/**
 * Phase 2 #13 — hierarchical chunking.
 * Returns parent chunks (~4000 chars, no embedding) each with an array of
 * child chunks (~1000 chars) that get embedded.
 *
 * @param {string} text
 * @returns {Array<{ content: string, children: string[] }>}
 */
function splitIntoParentChildChunks(text) {
    const parents = splitTextIntoChunks(text, 4000, 400);
    return parents.map(p => ({
        content: p,
        children: splitTextIntoChunks(p, 1000, 100)
    }));
}

// Helper function to split a paragraph into sentences
function splitParagraphIntoSentences(paragraph) {
    // Split by sentence-ending punctuation followed by whitespace or end of string
    const sentences = paragraph
        .split(/([.!?]+)\s+/)
        .filter(part => part.trim().length > 0);

    const result = [];
    let currentSentence = '';

    for (let i = 0; i < sentences.length; i++) {
        const part = sentences[i];

        // If this part is punctuation, add it to current sentence
        if (/^[.!?]+$/.test(part)) {
            currentSentence += part;
            result.push(currentSentence.trim());
            currentSentence = '';
        } else {
            // If adding this would make sentence too long, save current and start new
            if (currentSentence.length + part.length > 500) {
                if (currentSentence.trim()) {
                    result.push(currentSentence.trim());
                }
                currentSentence = part;
            } else {
                currentSentence += part;
            }
        }
    }

    // Add remaining sentence
    if (currentSentence.trim()) {
        result.push(currentSentence.trim());
    }

    return result.filter(s => s.length > 0);
}

// Helper function to normalize embedding dimensions
function normalizeEmbedding(embedding, targetDimensions = 384) {
    if (!embedding || !Array.isArray(embedding)) {
        console.log('⚠️ Invalid embedding, creating fallback');
        return createSimpleEmbedding('fallback', targetDimensions);
    }

    const currentDimensions = embedding.length;

    if (currentDimensions === targetDimensions) {
        return embedding;
    }

    console.log(`🔄 Normalizing embedding from ${currentDimensions} to ${targetDimensions} dimensions`);

    if (currentDimensions > targetDimensions) {
        // Truncate if too many dimensions
        return embedding.slice(0, targetDimensions);
    } else {
        // Pad with zeros if too few dimensions
        const normalized = [...embedding];
        while (normalized.length < targetDimensions) {
            normalized.push(0);
        }
        return normalized;
    }
}

// Helper function to create embeddings using available providers
async function createEmbedding(text) {
    try {
        // Truncate text if it's too long
        const maxLength = 8000;
        const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

        // Try OpenAI first if available
        if (openai) {
            try {
                console.log('🤖 Creating embedding with OpenAI...');
                const response = await openai.embeddings.create({
                    model: "text-embedding-ada-002",
                    input: truncatedText,
                });

                if (response && response.data && response.data[0] && response.data[0].embedding) {
                    console.log('✅ OpenAI embedding created successfully');
                    return normalizeEmbedding(response.data[0].embedding);
                }
            } catch (openaiError) {
                console.error('❌ OpenAI embedding failed:', openaiError.message);
                // Continue to next provider
            }
        }

        // Try Gemini if available
        if (process.env.GEMINI_API_KEY) {
            try {
                console.log('🤖 Creating embedding with Gemini...');
                // Use the model name from env variables
                const embedModel = process.env.GEMINI_EMBEDDINGS_MODEL || "models/embedding-001";
                console.log(`Using Gemini embedding model: ${embedModel}`);

                // Initialize the Gemini AI client
                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

                // Create embedding
                const response = await genAI.embedContent(embedModel, {
                    text: truncatedText
                });

                if (response && response.embedding) {
                    console.log('✅ Gemini embedding created successfully');
                    return normalizeEmbedding(response.embedding);
                } else {
                    console.error('❌ Gemini embedding returned invalid response:', response);
                }
            } catch (geminiError) {
                console.error('❌ Gemini embedding failed:', geminiError.message);
                // Continue to fallback
            }
        }

        // Fallback: Create a simple hash-based pseudo-embedding
        console.log('⚠️ Using fallback pseudo-embedding (no external API)');
        return createSimpleEmbedding(truncatedText);

    } catch (error) {
        console.error('❌ Error creating embedding:', error);
        // Return a fallback embedding
        return createSimpleEmbedding(text);
    }
}

// Simple fallback embedding function that doesn't require external APIs
function createSimpleEmbedding(text, dimensions = 384) {
    // Create a deterministic pseudo-embedding based on text content
    // This is not as good as real embeddings but allows the system to work
    const embedding = new Array(dimensions).fill(0);

    // Use a simple hash function to distribute values
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    // Fill embedding with pseudo-random values based on text content
    for (let i = 0; i < dimensions; i++) {
        // Use different parts of text to influence different dimensions
        const textIndex = i % text.length;
        const charCode = text.charCodeAt(textIndex) || 1;
        const seed = hash + i * charCode;

        // Generate a value between -1 and 1
        embedding[i] = (Math.sin(seed) + Math.cos(seed * 0.7)) * 0.5;
    }

    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
        for (let i = 0; i < dimensions; i++) {
            embedding[i] = embedding[i] / magnitude;
        }
    }

    console.log('📊 Created simple pseudo-embedding with', dimensions, 'dimensions');
    return embedding;
}

/**
 * @swagger
 * /process:
 *   post:
 *     summary: Process a document
 *     description: Process an uploaded document to extract text content, create sections, and generate embeddings for RAG functionality. Supports PDF, PowerPoint, Markdown, and text files.
 *     tags: [Processing]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - document_id
 *             properties:
 *               document_id:
 *                 type: string
 *                 description: ID of the document to process
 *                 example: "doc_123"
 *     responses:
 *       200:
 *         description: Document processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Document processed successfully"
 *                 document_id:
 *                   type: string
 *                   description: ID of the processed document
 *                 sections_created:
 *                   type: integer
 *                   description: Number of sections created
 *                 embeddings_created:
 *                   type: integer
 *                   description: Number of embeddings generated
 *                 processing_time:
 *                   type: number
 *                   description: Processing time in seconds
 *                 file_type:
 *                   type: string
 *                   description: Type of file processed
 *                   example: "application/pdf"
 *                 content_length:
 *                   type: integer
 *                   description: Length of extracted content
 *                 embedding_service:
 *                   type: string
 *                   description: AI service used for embeddings
 *                   example: "gemini"
 *       400:
 *         description: Bad request - document_id missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Processing failed - file extraction or embedding error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 *                 details:
 *                   type: string
 *                   description: Additional error details
 *                 file_type:
 *                   type: string
 *                   description: Type of file that failed processing
 *                 processing_stage:
 *                   type: string
 *                   description: Stage where processing failed
 *                   enum: [file_retrieval, content_extraction, text_chunking, embedding_generation, database_storage]
 */
// Process a document
router.post('/', async (req, res) => {
    try {
        const { document_id } = req.body;
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        console.log('🔄 Processing document:', document_id);
        console.log('  - Has auth header:', !!req.headers.authorization);
        console.log('  - Token length:', authToken?.length || 0);

        if (!document_id) {
            console.log('❌ No document_id provided');
            return res.status(400).json({ error: 'No document_id provided' });
        }

        if (!authToken) {
            console.log('❌ No authorization token provided');
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        // Get user client
        const supabase = createUserClient(authToken);

        // Validate user
        const { user, error: userError } = await validateUser(authToken);

        if (userError) {
            console.log('❌ User authentication failed');
            return res.status(401).json({ error: userError });
        }

        console.log('✅ User authenticated, proceeding with processing');

        // Get document information
        const { data: document, error: docError } = await supabase
            .from('documents')
            .select('*')
            .eq('id', document_id)
            .single();

        if (docError) {
            console.error('❌ Error fetching document:', docError);
            return res.status(400).json({ error: docError.message });
        }

        if (!document) {
            console.log('❌ Document not found');
            return res.status(404).json({ error: 'Document not found' });
        }

        console.log('📄 Document details:', {
            id: document.id,
            name: document.name,
            file_type: document.file_type,
            file_extension: document.file_extension,
            has_storage_object_id: !!document.storage_object_id,
            storage_object_path: document.storage_object_path || 'none',
            status: document.status
        });

        // Update document status to processing
        const { error: updateError } = await supabase
            .from('documents')
            .update({ status: 'processing' })
            .eq('id', document_id);

        if (updateError) {
            console.error('⚠️ Failed to update document status:', updateError);
            // Continue processing anyway
        }

        // Get document content - try multiple sources
        let fileContent = null;
        let fileType = document.file_type || 'text/plain';
        let fileExtension = document.file_extension || 'txt';

        // APPROACH 1: Try to get content from document_content table first
        console.log('🔍 Checking for content in document_content table...');
        const { data: contentData, error: contentError } = await supabase
            .from('document_content')
            .select('content, content_type')
            .eq('document_id', document_id)
            .single();

        if (contentData?.content) {
            console.log('✅ Found content in document_content table');
            fileContent = Buffer.from(contentData.content, 'base64');

            if (contentData.content_type) {
                fileType = contentData.content_type;
                console.log('📄 Using content_type from document_content:', fileType);
            }
        } else {
            console.log('⚠️ No content found in document_content table:', contentError?.message || 'Not found');


            // APPROACH 2: Check if it's a local file (starts with /uploads/)
            if (document.storage_object_path && document.storage_object_path.startsWith('/uploads/')) {
                console.log('🔍 Reading local file:', document.storage_object_path);

                try {
                    const localFilePath = path.join(process.cwd(), '..', 'public', document.storage_object_path);
                    console.log('📁 Full path:', localFilePath);

                    if (fs.existsSync(localFilePath)) {
                        fileContent = fs.readFileSync(localFilePath);
                        console.log('✅ Read local file successfully');
                    } else {
                        console.error('❌ Local file not found at:', localFilePath);
                    }
                } catch (localFileError) {
                    console.error('❌ Error reading local file:', localFileError);
                }
            }

            // APPROACH 3: Try to get file from storage if storage_object_path is available
            if (document.storage_object_path) {
                console.log('🔍 Trying to download file from storage:', document.storage_object_path);

                try {
                    const { data: fileData, error: downloadError } = await supabase.storage
                        .from('documents')
                        .download(document.storage_object_path);

                    if (fileData) {
                        console.log('✅ Downloaded file from storage');
                        fileContent = Buffer.from(await fileData.arrayBuffer());
                    } else {
                        console.error('❌ Failed to download file:', downloadError);
                    }
                } catch (downloadError) {
                    console.error('❌ Error downloading file:', downloadError);
                }
            }

            // APPROACH 4: If we still don't have content, try admin client as last resort
            if (!fileContent && document.storage_object_path) {
                console.log('🔍 Trying admin client to download file...');

                try {
                    const admin = supabaseAdmin();
                    if (admin) {
                        const { data: adminFileData, error: adminDownloadError } = await admin.storage
                            .from('documents')
                            .download(document.storage_object_path);

                        if (adminFileData) {
                            console.log('✅ Downloaded file using admin client');
                            fileContent = Buffer.from(await adminFileData.arrayBuffer());
                        } else {
                            console.error('❌ Failed to download file with admin client:', adminDownloadError);
                        }
                    }
                } catch (adminError) {
                    console.error('❌ Error with admin download:', adminError);
                }
            }
        }

        if (!fileContent) {
            console.error('❌ Could not retrieve file content from any source');

            // Update document status to failed
            await supabase
                .from('documents')
                .update({ status: 'processing_failed' })
                .eq('id', document_id);

            return res.status(404).json({ error: 'File content not found' });
        }

        // Process the document content based on file type
        console.log('🔄 Processing document content...');
        console.log('📄 File type:', fileType);
        console.log('📄 File extension:', fileExtension);
        console.log('📊 Content size:', fileContent.length, 'bytes');

        let text = '';

        // Process different file types
        if (fileType.includes('text/plain') || fileExtension === 'txt') {
            // Plain text
            text = fileContent.toString('utf-8');
            console.log('📝 Processed as plain text');
        } else if (fileType.includes('text/markdown') || fileExtension === 'md') {
            // Markdown
            text = fileContent.toString('utf-8');
            console.log('📝 Processed as markdown');
        } else if (fileType.includes('application/pdf') || fileExtension === 'pdf') {
            let pdfNumPages = 0;
            if (pdfParse) {
                console.log('📄 Parsing PDF content');
                try {
                    const pdfData = await pdfParse(fileContent);
                    text = pdfData.text || '';
                    pdfNumPages = pdfData.numpages || 0;
                    console.log(`✅ PDF parsed, extracted length: ${text.length}, pages: ${pdfNumPages}`);
                } catch (e) {
                    console.error('❌ PDF parse failed:', e.message);
                    text = '';
                }
            } else {
                text = '';
            }

            // Phase 3 #14 — vision-LLM OCR fallback for image-heavy / scanned PDFs.
            // Guard: only trigger when pdf-parse actually produced metadata
            // (or text was empty BY extraction, not because the parser is missing).
            // This avoids burning vision-API calls on every PDF when pdf-parse is unavailable.
            const ocrEnabled = process.env.OCR_ENABLED !== 'false';
            const parserAvailable = !!pdfParse;
            const charsPerPage = pdfNumPages > 0 ? text.length / pdfNumPages : (parserAvailable ? text.length : 0);
            const OCR_TRIGGER_TOTAL = 500;     // bare doc with almost nothing
            const OCR_TRIGGER_PER_PAGE = 100;  // < 100 chars/page = likely scanned
            const OCR_MAX_PAGES = 50;           // cost guard
            const looksScanned = parserAvailable && (
                text.length < OCR_TRIGGER_TOTAL ||
                (pdfNumPages > 0 && charsPerPage < OCR_TRIGGER_PER_PAGE)
            );

            if (ocrEnabled && looksScanned) {
                if (pdfNumPages > OCR_MAX_PAGES) {
                    console.warn(`⚠️  OCR skipped: ${pdfNumPages} pages exceeds OCR_MAX_PAGES=${OCR_MAX_PAGES}`);
                } else {
                    const sha = crypto.createHash('sha256').update(fileContent).digest('hex');
                    let ocrText = null;
                    let ocrProvider = null;
                    let ocrModel = null;

                    // 1) Try cache first.
                    try {
                        const { data: cached } = await supabaseAdmin()
                            .from('ocr_cache')
                            .select('text, provider, model')
                            .eq('file_sha256', sha)
                            .maybeSingle();
                        if (cached?.text) {
                            ocrText = cached.text;
                            ocrProvider = cached.provider;
                            ocrModel = cached.model;
                            console.log(`✅ OCR cache hit (${ocrText.length} chars)`);
                        }
                    } catch (cacheErr) {
                        // ocr_cache table may not exist yet (pre-migration).
                        if (!/does not exist/i.test(cacheErr.message || '') && cacheErr.code !== '42P01') {
                            console.warn('⚠️  OCR cache read failed:', cacheErr.message);
                        }
                    }

                    // 2) Cache miss → call vision provider.
                    if (!ocrText) {
                        const visionProvider = aiProviderManager.getVisionProvider();
                        if (!visionProvider) {
                            console.warn('⚠️  No vision-capable AI provider configured (Gemini or Claude required for OCR)');
                        } else {
                            try {
                                console.log(`🔍 Triggering OCR via ${visionProvider.id}…`);
                                const result = await visionProvider.transcribePdf(fileContent, { documentName: document?.name || 'document' });
                                if (result?.text && result.text.length > text.length) {
                                    ocrText = result.text;
                                    ocrProvider = result.provider;
                                    ocrModel = result.model;
                                    console.log(`✅ OCR returned ${ocrText.length} chars via ${ocrProvider}/${ocrModel}`);
                                    // Persist to cache (best-effort, idempotent on hash collision).
                                    try {
                                        await supabaseAdmin().from('ocr_cache').upsert({
                                            file_sha256: sha,
                                            text: ocrText,
                                            provider: ocrProvider,
                                            model: ocrModel
                                        }, { onConflict: 'file_sha256', ignoreDuplicates: true });
                                    } catch (writeErr) {
                                        if (!/does not exist/i.test(writeErr.message || '') && writeErr.code !== '42P01') {
                                            console.warn('⚠️  OCR cache write failed:', writeErr.message);
                                        }
                                    }
                                }
                            } catch (ocrErr) {
                                if (ocrErr.code === 'OCR_UNSUPPORTED') {
                                    console.warn('ℹ️  Selected provider does not support OCR; skipping');
                                } else if (ocrErr.code === 'OCR_PDF_TOO_LARGE') {
                                    console.warn('⚠️  PDF too large for inline OCR; skipping');
                                } else {
                                    console.error('❌ OCR call failed:', ocrErr.message);
                                }
                            }
                        }
                    }

                    if (ocrText) {
                        text = ocrText;
                        // Update the documents row with OCR provenance (best-effort).
                        try {
                            await supabaseAdmin()
                                .from('documents')
                                .update({ ocr_used: true, ocr_provider: ocrProvider, ocr_model: ocrModel })
                                .eq('id', document_id);
                        } catch (updErr) {
                            if (!/does not exist|column/i.test(updErr.message || '')) {
                                console.warn('⚠️  documents OCR-flag update failed:', updErr.message);
                            }
                        }
                    }
                }
            }
        } else if ((fileType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation') || fileExtension === 'pptx' || fileExtension === 'ppt') && pptxParser) {
            console.log('📄 Parsing PPTX content');
            try {
                const tmpPath = path.join(os.tmpdir(), `${Date.now()}.pptx`);
                fs.writeFileSync(tmpPath, fileContent);
                const parser = new pptxParser();
                const slides = await parser.parse(tmpPath);
                text = slides.map(s => s.text).join('\n\n');
                fs.unlinkSync(tmpPath);
                console.log('✅ PPTX parsed, length:', text.length);
            } catch (e) {
                console.error('❌ PPTX parse failed:', e.message);
                text = '';
            }
        } else {
            // Default to plain text
            text = fileContent.toString('utf-8');
            console.log('📝 Processed as default text');
        }

        console.log('📊 Extracted text length:', text.length);

        if (text.length === 0) {
            console.error('❌ No text extracted from document');

            // Update document status to failed
            await supabase
                .from('documents')
                .update({ status: 'processing_failed' })
                .eq('id', document_id);

            return res.status(400).json({ error: 'No text could be extracted from document' });
        }

        // -------------------------------------------------------------------
        // Phase 2 #13: Try hierarchical (parent/child) chunking if the schema
        // supports it. Probe by attempting an insert with parent_chunk_id —
        // if it errors with "column does not exist", fall back to the legacy
        // flat chunk loop.
        // -------------------------------------------------------------------
        let useHierarchical = process.env.USE_PARENT_CHILD_CHUNKS !== 'false';
        if (useHierarchical) {
            // Cheap probe: select the new column. If it 400s, switch to legacy.
            const { error: probeErr } = await supabase
                .from('document_sections')
                .select('parent_chunk_id', { head: true, count: 'exact' })
                .limit(1);
            if (probeErr) {
                console.log('ℹ️  parent_chunk_id column missing — using legacy flat chunking');
                useHierarchical = false;
            }
        }

        let chunksCount = 0;
        if (useHierarchical) {
            console.log('🌳 Splitting text into parent/child chunks...');
            const parents = splitIntoParentChildChunks(text);
            console.log(`📊 Created ${parents.length} parent chunks`);
            chunksCount = parents.reduce((sum, p) => sum + p.children.length, 0);

            for (let pi = 0; pi < parents.length; pi++) {
                const parent = parents[pi];

                // Insert parent (no embedding, chunk_level = 0)
                const { data: parentRow, error: parentErr } = await supabase
                    .from('document_sections')
                    .insert({
                        document_id,
                        content: parent.content,
                        chunk_level: 0,
                        chunk_index: pi
                    })
                    .select('id')
                    .single();

                if (parentErr || !parentRow) {
                    console.error(`❌ Failed to insert parent ${pi + 1}:`, parentErr);
                    continue;
                }

                // Insert children with embeddings
                for (let ci = 0; ci < parent.children.length; ci++) {
                    const child = parent.children[ci];
                    try {
                        const embedding = await createEmbedding(child);
                        const { error: childErr } = await supabase
                            .from('document_sections')
                            .insert({
                                document_id,
                                content: child,
                                embedding,
                                parent_chunk_id: parentRow.id,
                                chunk_level: 1,
                                chunk_index: ci
                            });
                        if (childErr) {
                            console.error(`❌ Failed to insert child ${pi}.${ci}:`, childErr);
                        }
                    } catch (embErr) {
                        console.error(`❌ Embedding failed for child ${pi}.${ci}:`, embErr.message);
                    }
                }
                console.log(`✅ Parent ${pi + 1}/${parents.length}: ${parent.children.length} children indexed`);
            }
        } else {
        // Split text into chunks for embedding (legacy flat path)
        console.log('🔪 Splitting text into chunks...');
        const chunks = splitTextIntoChunks(text);
        console.log('📊 Created', chunks.length, 'chunks');
        chunksCount = chunks.length;

        // Create embeddings for each chunk
        console.log('🧠 Creating embeddings...');

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`🔄 Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);

            try {
                // Create embedding
                const embedding = await createEmbedding(chunk);

                // Try to store in document_chunks table first, fallback to document_sections
                let stored = false;

                // Try document_chunks table
                try {
                    const { error: chunkError } = await supabase
                        .from('document_chunks')
                        .insert({
                            document_id,
                            content: chunk,
                            embedding,
                            chunk_order: i
                        });

                    if (!chunkError) {
                        console.log(`✅ Chunk ${i + 1} stored in document_chunks`);
                        stored = true;
                    } else {
                        console.log(`⚠️ document_chunks table not available:`, chunkError.message);
                    }
                } catch (chunksTableError) {
                    console.log(`⚠️ document_chunks table error:`, chunksTableError.message);
                }

                // Fallback to document_sections table if document_chunks failed
                if (!stored) {
                    try {
                        const { error: sectionError } = await supabase
                            .from('document_sections')
                            .insert({
                                document_id,
                                content: chunk,
                                embedding
                            });

                        if (sectionError) {
                            console.error(`❌ Error storing section ${i + 1}:`, sectionError);
                        } else {
                            console.log(`✅ Chunk ${i + 1} stored in document_sections`);
                            stored = true;
                        }
                    } catch (sectionError) {
                        console.error(`❌ Error with document_sections:`, sectionError);
                    }
                }

                if (!stored) {
                    console.error(`❌ Failed to store chunk ${i + 1} in any table`);
                }

            } catch (embeddingError) {
                console.error('❌ Error creating embedding:', embeddingError);
            }
        }
        } // end legacy flat-chunking branch

        // Update document status to processed
        const { error: finalUpdateError } = await supabase
            .from('documents')
            .update({ status: 'processed' })
            .eq('id', document_id);

        if (finalUpdateError) {
            console.error('⚠️ Failed to update final document status:', finalUpdateError);
        }

        // Generate embeddings for all document sections using the embed endpoint
        try {
            console.log('🧠 Ensuring all sections have embeddings...');

            // First, get sections without embeddings
            const { data: sectionsWithoutEmbeddings, error: sectionsError } = await supabase
                .from('document_sections')
                .select('id')
                .eq('document_id', document_id)
                .is('embedding', null);

            if (sectionsError) {
                console.error('❌ Error fetching sections without embeddings:', sectionsError);
            } else if (sectionsWithoutEmbeddings && sectionsWithoutEmbeddings.length > 0) {
                console.log(`Found ${sectionsWithoutEmbeddings.length} sections without embeddings`);

                // Extract section IDs
                const sectionIds = sectionsWithoutEmbeddings.map(section => section.id);

                // Call the embed endpoint with the correct parameters
                const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/api/embed`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        ids: sectionIds,
                        table: 'document_sections',
                        contentColumn: 'content',
                        embeddingColumn: 'embedding'
                    })
                });

                if (response.ok) {
                    console.log('✅ Embedding generation triggered successfully');
                } else {
                    console.error('⚠️ Failed to trigger embeddings:', await response.text());
                }
            } else {
                console.log('✅ All sections already have embeddings');
            }
        } catch (embedError) {
            console.error('❌ Error triggering embeddings:', embedError);
        }

        console.log('✅ Document processed successfully');
        res.json({ success: true, chunks_count: chunksCount });
    } catch (error) {
        console.error('💥 Processing error:', error);
        res.status(500).json({ error: 'Processing failed: ' + error.message });
    }
});

// Process PDF content into sections
function processPdfContent(content) {
    // Simple processing: split by paragraphs with reasonable length
    const rawParagraphs = content.split(/\n\s*\n/);
    const sections = [];

    let currentSection = '';
    const targetLength = 1000; // Target ~1000 characters per section

    for (const paragraph of rawParagraphs) {
        const trimmedPara = paragraph.trim();
        if (!trimmedPara) continue;

        if (currentSection.length + trimmedPara.length < targetLength) {
            currentSection += (currentSection ? '\n\n' : '') + trimmedPara;
        } else {
            if (currentSection) {
                sections.push({ content: currentSection });
            }
            currentSection = trimmedPara;
        }
    }

    // Add the last section if not empty
    if (currentSection) {
        sections.push({ content: currentSection });
    }

    // If no sections were created, create one with the entire content
    if (sections.length === 0 && content.trim()) {
        sections.push({ content: content.trim() });
    }

    return sections;
}

// Process PowerPoint content into sections
function processPowerPointContent(content) {
    // Assume content has "Slide X" markers or natural slide breaks
    const slideMarkerRegex = /Slide\s+\d+|={3,}|\*{3,}|-{3,}/g;
    const slideTexts = content.split(slideMarkerRegex).filter(text => text.trim());

    // If splitting didn't work well, fall back to paragraph-based splitting
    if (slideTexts.length <= 1) {
        return processPdfContent(content); // Reuse the PDF processing logic
    }

    return slideTexts.map(slideContent => ({
        content: slideContent.trim()
    }));
}

export default router;
