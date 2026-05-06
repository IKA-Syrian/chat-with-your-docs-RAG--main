import enhancedAIService from '../lib/enhanced-ai-service.js';
import enhancedPDFService from '../lib/enhanced-pdf-service.js';
import { documentModel } from '../lib/analytics-models.js';
import { supabaseAdmin } from '../lib/supabase.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Phase 2 #6 — also materialize generated flashcards into the rows-based
 * `flashcards` table so FSRS scheduling works. Idempotent via fingerprint.
 * Silently no-ops if the table doesn't exist (migration not yet applied).
 */
async function materializeFlashcardRows(documentId, flashcardsData) {
    try {
        const arr = Array.isArray(flashcardsData)
            ? flashcardsData
            : (Array.isArray(flashcardsData?.flashcards) ? flashcardsData.flashcards : []);
        if (arr.length === 0) return;

        const supabase = supabaseAdmin();
        const rows = arr
            .map((c, i) => {
                const front = c.front || c.question || '';
                const back = c.back || c.answer || '';
                if (!front || !back) return null;
                const fingerprint = crypto.createHash('sha256').update(`${front}|${back}`).digest('hex');
                return {
                    document_id: documentId,
                    front,
                    back,
                    card_index: i,
                    fingerprint
                };
            })
            .filter(Boolean);
        if (rows.length === 0) return;

        const { error } = await supabase
            .from('flashcards')
            .upsert(rows, { onConflict: 'document_id,fingerprint', ignoreDuplicates: true });
        if (error) {
            // 42P01 = table does not exist (migration not run yet). Silent.
            if (error.code !== '42P01' && !/does not exist/i.test(error.message || '')) {
                console.warn('⚠️ flashcard row materialization failed:', error.message);
            }
        } else {
            console.log(`📇 Materialized ${rows.length} flashcard rows for FSRS`);
        }
    } catch (err) {
        // Never let this block the response.
        console.warn('⚠️ flashcard row materialization threw:', err.message);
    }
}

// Load environment variables (needed for standalone testing)
import dotenv from 'dotenv';
dotenv.config();

// Safely import pdf-parse
let pdfParse = null;
try {
    // Try dynamic import first (for ES modules)
    const pdfParseModule = await import('pdf-parse');
    pdfParse = pdfParseModule.default || pdfParseModule;
    console.log('✅ pdf-parse loaded in enhanced controller via dynamic import');
} catch (dynamicImportError) {
    try {
        // Fallback to createRequire for CommonJS modules
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        pdfParse = require('pdf-parse');
        console.log('✅ pdf-parse loaded in enhanced controller via createRequire');
    } catch (requireError) {
        console.log('⚠️ pdf-parse not available in enhanced controller:', {
            dynamicImport: dynamicImportError.message,
            require: requireError.message
        });
        console.log('📄 PDF processing will be disabled in enhanced controller');
    }
}

// Dynamic import for PowerPoint parser
let pptxParser;
try {
    const { default: _pptx } = await import('pptx2json');
    pptxParser = _pptx;
    console.log('✅ pptx2json loaded in enhanced controller');
} catch (error) {
    console.warn('⚠️ PowerPoint parser not available in enhanced controller:', error.message);
}

class EnhancedProcessingController {
    // Upload and process PDF with educational content generation
    // Note: This complements the existing PDF processing in routes/process.js
    // For RAG/chat functionality, use the existing process endpoint
    // This endpoint focuses on educational content generation (quiz, flashcards, summaries)
    async uploadAndProcessPDF(req, res, next) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: 'No file uploaded',
                    success: false
                });
            }

            if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
                return res.status(400).json({
                    error: 'Only PDF files are allowed',
                    success: false
                });
            }

            console.log('📄 Processing uploaded PDF for educational content:', req.file.originalname);

            // Validate PDF
            enhancedPDFService.validatePDF(req.file.buffer);

            // Extract text from PDF using enhanced service (pdfjs-dist with fallback)
            const pdfText = await enhancedPDFService.extractTextWithFallback(req.file.buffer);

            if (!pdfText.trim()) {
                return res.status(400).json({
                    error: 'No text found in PDF',
                    success: false
                });
            }

            // Extract metadata for educational purposes
            const metadata = await enhancedPDFService.extractMetadata(req.file.buffer);

            console.log('🎓 Generating educational content...');
            console.log('💡 Tip: For RAG/chat functionality, use the existing /api/process endpoint');

            // Generate educational content using AI providers
            const educationalContent = await enhancedAIService.generateEducationalContent(pdfText);

            // Create document record in enhanced system (separate from main RAG system)
            const documentData = {
                title: metadata.title !== 'Unknown' ? metadata.title : req.file.originalname,
                filename: req.file.originalname,
                content: pdfText,
                metadata: metadata,
                educational_content: educationalContent,
                user_id: req.user?.id || 'anonymous',
                processing_type: 'educational' // Mark as educational processing
            };

            const document = documentModel.create(documentData);
            documentModel.markAsProcessed(document.id, {
                summary: educationalContent.summary,
                quiz: educationalContent.quiz,
                flashcards: educationalContent.flashcards
            });

            console.log('✅ Educational content generated successfully:', document.id);

            const response = {
                success: true,
                data: {
                    document_id: document.id,
                    title: document.title,
                    metadata: document.metadata,
                    summary: educationalContent.summary,
                    quiz: educationalContent.quiz,
                    flashcards: educationalContent.flashcards,
                    note: 'This document is processed for educational content. For RAG/chat, upload via the main documents endpoint.'
                }
            };

            res.json(response);
        } catch (error) {
            console.error('❌ Error processing PDF for educational content:', error);
            next(error);
        }
    }

    // Generate summary from text
    async generateSummary(req, res, next) {
        try {
            const { text, document_id, provider, model } = req.body;

            if (!text || !text.trim()) {
                return res.status(400).json({
                    error: 'Text cannot be empty',
                    success: false
                });
            }

            console.log('📝 Generating summary...');

            // Create options object for AI service
            const aiOptions = {};
            if (provider) {
                aiOptions.provider = provider;
            }
            if (model) {
                aiOptions.model = model;
            }

            const data = await enhancedAIService.generateSummary(text, aiOptions);

            // Update document if document_id provided
            if (document_id) {
                documentModel.update(document_id, { summary: data });
            }

            res.json({
                success: true,
                data: data
            });
        } catch (error) {
            console.error('❌ Error generating summary:', error);
            next(error);
        }
    }

    // Generate quiz from text
    async generateQuiz(req, res, next) {
        try {
            const { text, document_id, provider, model } = req.body;

            if (!text || !text.trim()) {
                return res.status(400).json({
                    error: 'Text cannot be empty',
                    success: false
                });
            }

            console.log('❓ Generating quiz...');

            // Create options object for AI service
            const aiOptions = {};
            if (provider) {
                aiOptions.provider = provider;
            }
            if (model) {
                aiOptions.model = model;
            }

            const data = await enhancedAIService.generateQuiz(text, aiOptions);

            // Update document if document_id provided
            if (document_id) {
                documentModel.update(document_id, { quiz: data });
            }

            res.json({
                success: true,
                data: data
            });
        } catch (error) {
            console.error('❌ Error generating quiz:', error);
            next(error);
        }
    }

    // Generate flashcards from text
    async generateFlashcards(req, res, next) {
        try {
            const { text, document_id, provider, model } = req.body;

            if (!text || !text.trim()) {
                return res.status(400).json({
                    error: 'Text cannot be empty',
                    success: false
                });
            }

            console.log('🗂️ Generating flashcards...');

            // Create options object for AI service
            const aiOptions = {};
            if (provider) {
                aiOptions.provider = provider;
            }
            if (model) {
                aiOptions.model = model;
            }

            const data = await enhancedAIService.generateFlashcards(text, aiOptions);

            // Update document if document_id provided
            if (document_id) {
                documentModel.update(document_id, { flashcards: data });
                // Phase 2 #6 — sidecar: also materialize as rows for FSRS.
                materializeFlashcardRows(document_id, data).catch(() => {});
            }

            res.json({
                success: true,
                data: data
            });
        } catch (error) {
            console.error('❌ Error generating flashcards:', error);
            next(error);
        }
    }

    // Generate all educational content at once
    async generateAllEducationalContent(req, res, next) {
        try {
            let { text, document_id, provider, model } = req.body;

            console.log('🎓 generateAllEducationalContent called with:', {
                hasText: !!text,
                textLength: text?.length || 0,
                document_id: document_id,
                provider: provider || 'default',
                model: model || 'default'
            });

            // If no text provided but document_id is provided, fetch document content
            if ((!text || !text.trim()) && document_id) {
                console.log('🔍 No text provided, fetching document content for ID:', document_id);

                try {
                    // Use admin privileges to fetch content
                    const supabase = supabaseAdmin();

                    // Approach 1: Try to get content from document_content table (PRIORITY)
                    console.log('📊 Approach 1: Checking document_content table...');
                    const { data: contentData, error: contentError } = await supabase
                        .from('document_content')
                        .select('content, content_type')
                        .eq('document_id', document_id);

                    if (contentData && contentData.length > 0) {
                        console.log('✅ Found content in document_content table');
                        const content = contentData[0];

                        try {
                            // Decode base64 content
                            console.log('🔓 Decoding base64 content...');
                            const decodedBuffer = Buffer.from(content.content, 'base64');
                            console.log('📊 Decoded buffer size:', decodedBuffer.length, 'bytes');

                            // Extract text based on content type
                            if (content.content_type === 'application/vnd.ms-powerpoint' ||
                                content.content_type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {

                                console.log('📄 Processing PowerPoint file...');

                                // Use improved text extraction for older .ppt files
                                console.log('📄 Processing older PowerPoint format with enhanced fallback...');

                                // Try multiple encoding approaches for binary .ppt files
                                const encodings = ['utf-8', 'utf-16le', 'latin1'];
                                let bestText = '';
                                let bestScore = 0;

                                for (const encoding of encodings) {
                                    try {
                                        const rawText = decodedBuffer.toString(encoding);

                                        // Look for production/plan content specifically  
                                        const productionMatches = [];
                                        const planMatches = [];

                                        // Find Production mentions with context
                                        let regex = /production/gi;
                                        let match;
                                        while ((match = regex.exec(rawText)) !== null) {
                                            const start = Math.max(0, match.index - 100);
                                            const end = Math.min(rawText.length, match.index + 100);
                                            const context = rawText.substring(start, end)
                                                .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
                                                .replace(/\s+/g, ' ')
                                                .trim();
                                            if (context.length > 20) {
                                                productionMatches.push(context);
                                            }
                                        }

                                        // Find Plan mentions with context
                                        regex = /plan/gi;
                                        while ((match = regex.exec(rawText)) !== null) {
                                            const start = Math.max(0, match.index - 100);
                                            const end = Math.min(rawText.length, match.index + 100);
                                            const context = rawText.substring(start, end)
                                                .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
                                                .replace(/\s+/g, ' ')
                                                .trim();
                                            if (context.length > 20) {
                                                planMatches.push(context);
                                            }
                                        }

                                        // Combine and score the matches
                                        const allMatches = [...productionMatches, ...planMatches];
                                        const combinedText = allMatches
                                            .filter(text => text.length > 20)
                                            .slice(0, 20) // Limit to prevent too much content
                                            .join(' ')
                                            .replace(/\s+/g, ' ')
                                            .trim();

                                        // Score based on content quality and relevance
                                        const score = (productionMatches.length * 2) + planMatches.length + (combinedText.length / 100);

                                        if (score > bestScore && combinedText.length > 50) {
                                            bestText = combinedText;
                                            bestScore = score;
                                        }

                                        console.log(`✅ Binary ${encoding}: Found ${productionMatches.length} production + ${planMatches.length} plan mentions, score: ${score}`);

                                    } catch (encodingError) {
                                        console.log(`⚠️ Binary ${encoding} encoding failed:`, encodingError.message);
                                    }
                                }

                                if (bestText && bestText.length > 50) {
                                    text = bestText;
                                    console.log('✅ Binary extraction found Production Plan content:', text.length, 'characters');
                                    console.log('📝 Content preview:', text.substring(0, 200) + '...');
                                }

                            } else if (content.content_type === 'application/pdf') {
                                console.log('📄 Processing PDF file...');
                                if (!pdfParse) {
                                    throw new Error('PDF parser not available');
                                }
                                const pdfResult = await pdfParse(decodedBuffer);
                                text = pdfResult.text;
                                console.log('✅ Extracted text from PDF:', text.length, 'characters');

                            } else if (content.content_type?.includes('text') ||
                                content.content_type?.includes('markdown')) {
                                console.log('📄 Processing text file...');
                                text = decodedBuffer.toString('utf-8');
                                console.log('✅ Extracted text from file:', text.length, 'characters');

                            } else {
                                // Try to extract as text anyway
                                console.log('📄 Unknown content type, trying text extraction...');
                                text = decodedBuffer.toString('utf-8');

                                // Clean up any binary characters
                                text = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
                                console.log('✅ Extracted text (cleaned):', text.length, 'characters');
                            }

                        } catch (decodeError) {
                            console.error('❌ Failed to decode/extract content:', decodeError.message);
                            throw new Error(`Failed to process document content: ${decodeError.message}`);
                        }
                    }

                    if (!text || text.trim().length === 0) {
                        return res.status(404).json({
                            error: 'Document content not found',
                            message: `Document with ID ${document_id} exists but no content could be extracted`
                        });
                    }

                } catch (fetchError) {
                    console.error('❌ Error fetching document content:', fetchError);
                    return res.status(500).json({
                        error: 'Failed to fetch document content',
                        message: fetchError.message
                    });
                }
            }

            // Validate that we have text content
            if (!text || !text.trim()) {
                return res.status(400).json({
                    error: 'No content provided',
                    message: 'Either provide text directly or a valid document_id'
                });
            }

            console.log('📝 Processing text content:', text.length, 'characters');

            // Generate all educational content types
            console.log('🤖 Generating educational content...');

            // Create options object for AI service
            const aiOptions = {};
            if (provider) {
                aiOptions.provider = provider;
            }
            if (model) {
                aiOptions.model = model;
            }

            const [summary, flashcards, quiz] = await Promise.all([
                enhancedAIService.generateSummary(text, aiOptions),
                enhancedAIService.generateFlashcards(text, aiOptions),
                enhancedAIService.generateQuiz(text, aiOptions)
            ]);

            console.log('✅ Generated all educational content');

            const result = {
                summary,
                flashcards,
                quiz,
                generated_at: new Date().toISOString()
            };

            // Save the generated educational content to the database
            if (document_id) {
                console.log('💾 Saving educational content to database for document:', document_id);
                try {
                    const { supabaseAdmin } = await import('../lib/supabase.js');
                    const supabase = supabaseAdmin();

                    const { error: updateError } = await supabase
                        .from('documents')
                        .update({
                            summary,
                            flashcards,
                            quiz,
                            educational_content_generated: result.generated_at
                        })
                        .eq('id', document_id);

                    if (updateError) {
                        console.error('❌ Failed to save educational content to database:', updateError);
                        // Don't fail the request, just log the error
                    } else {
                        console.log('✅ Educational content saved to database successfully');
                        result.saved_to_database = true;
                        // Phase 2 #6 — also materialize flashcards into rows for FSRS.
                        materializeFlashcardRows(document_id, flashcards).catch(() => {});
                    }
                } catch (saveError) {
                    console.error('❌ Error saving educational content to database:', saveError);
                    // Don't fail the request, just log the error
                }
            }

            res.json(result);

        } catch (error) {
            console.error('💥 Error in generateAllEducationalContent:', error);
            next(error);
        }
    }

    // Get document educational content
    async getDocumentEducationalContent(req, res, next) {
        try {
            const { document_id } = req.params;

            if (!document_id) {
                return res.status(400).json({
                    error: 'Document ID is required',
                    success: false
                });
            }

            console.log('📋 Fetching educational content for document:', document_id);

            // Get document from main Supabase documents table where educational content is actually stored
            const { supabaseAdmin } = await import('../lib/supabase.js');
            const supabase = supabaseAdmin();

            const { data: document, error: docError } = await supabase
                .from('documents')
                .select('id, name, created_at, summary, flashcards, quiz, educational_content_generated')
                .eq('id', document_id)
                .single();

            if (docError) {
                console.error('❌ Database error:', docError);
                return res.status(500).json({
                    error: 'Database error: ' + docError.message,
                    success: false
                });
            }

            if (!document) {
                return res.status(404).json({
                    error: 'Document not found',
                    success: false
                });
            }

            console.log('✅ Document found:', {
                name: document.name,
                hasSummary: !!document.summary,
                hasFlashcards: !!document.flashcards,
                hasQuiz: !!document.quiz,
                educationalContentGenerated: document.educational_content_generated
            });

            // Parse JSON fields if they're stored as strings
            let summary = document.summary;
            let flashcards = document.flashcards;
            let quiz = document.quiz;

            try {
                if (typeof summary === 'string') {
                    summary = JSON.parse(summary);
                }
                if (typeof flashcards === 'string') {
                    flashcards = JSON.parse(flashcards);
                }
                if (typeof quiz === 'string') {
                    quiz = JSON.parse(quiz);
                }
            } catch (parseError) {
                console.log('⚠️ JSON parsing warning:', parseError.message);
                // Continue with the original values if parsing fails
            }

            res.json({
                id: document.id,
                name: document.name,
                created_at: document.created_at,
                summary: summary,
                flashcards: flashcards,
                quiz: quiz,
                educational_content_generated: document.educational_content_generated
            });
        } catch (error) {
            console.error('❌ Error fetching document content:', error);
            next(error);
        }
    }

    // List all processed documents
    async listDocuments(req, res, next) {
        try {
            const userId = req.user?.id || req.query.user_id || 'anonymous';
            const documents = documentModel.findAll()
                .filter(doc => doc.user_id === userId)
                .map(doc => ({
                    id: doc.id,
                    title: doc.title,
                    filename: doc.filename,
                    processed: doc.processed,
                    created_at: doc.created_at,
                    analytics: doc.analytics
                }));

            res.json({
                success: true,
                data: {
                    documents,
                    total: documents.length
                }
            });
        } catch (error) {
            console.error('❌ Error listing documents:', error);
            next(error);
        }
    }

    // Delete document
    async deleteDocument(req, res, next) {
        try {
            const { document_id } = req.params;

            if (!document_id) {
                return res.status(400).json({
                    error: 'Document ID is required',
                    success: false
                });
            }

            const deleted = documentModel.delete(document_id);

            if (!deleted) {
                return res.status(404).json({
                    error: 'Document not found',
                    success: false
                });
            }

            console.log('🗑️ Document deleted:', document_id);

            res.json({
                success: true,
                data: {
                    message: 'Document deleted successfully',
                    document_id
                }
            });
        } catch (error) {
            console.error('❌ Error deleting document:', error);
            next(error);
        }
    }
}

export default new EnhancedProcessingController();