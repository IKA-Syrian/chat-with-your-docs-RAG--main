import enhancedAIService from '../lib/enhanced-ai-service.js';
import enhancedPDFService from '../lib/enhanced-pdf-service.js';
import { documentModel } from '../lib/analytics-models.js';

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
            const { text, document_id } = req.body;

            if (!text || !text.trim()) {
                return res.status(400).json({
                    error: 'Text cannot be empty',
                    success: false
                });
            }

            console.log('📝 Generating summary...');

            const data = await enhancedAIService.generateSummary(text);

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
            const { text, document_id } = req.body;

            if (!text || !text.trim()) {
                return res.status(400).json({
                    error: 'Text cannot be empty',
                    success: false
                });
            }

            console.log('❓ Generating quiz...');

            const data = await enhancedAIService.generateQuiz(text);

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
            const { text, document_id } = req.body;

            if (!text || !text.trim()) {
                return res.status(400).json({
                    error: 'Text cannot be empty',
                    success: false
                });
            }

            console.log('🗂️ Generating flashcards...');

            const data = await enhancedAIService.generateFlashcards(text);

            // Update document if document_id provided
            if (document_id) {
                documentModel.update(document_id, { flashcards: data });
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
            const { text, document_id } = req.body;

            if (!text || !text.trim()) {
                return res.status(400).json({
                    error: 'Text cannot be empty',
                    success: false
                });
            }

            console.log('🎓 Generating all educational content...');

            const educationalContent = await enhancedAIService.generateEducationalContent(text);

            // Update document if document_id provided
            if (document_id) {
                documentModel.update(document_id, {
                    summary: educationalContent.summary,
                    quiz: educationalContent.quiz,
                    flashcards: educationalContent.flashcards
                });
                documentModel.markAsProcessed(document_id, educationalContent);
            }

            res.json({
                success: true,
                data: educationalContent
            });
        } catch (error) {
            console.error('❌ Error generating educational content:', error);
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

            const document = documentModel.findById(document_id);

            if (!document) {
                return res.status(404).json({
                    error: 'Document not found',
                    success: false
                });
            }

            // Increment view count
            documentModel.incrementAnalytics(document_id, 'views');

            res.json({
                success: true,
                data: {
                    document_id: document.id,
                    title: document.title,
                    processed: document.processed,
                    summary: document.summary,
                    quiz: document.quiz,
                    flashcards: document.flashcards,
                    analytics: document.analytics
                }
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