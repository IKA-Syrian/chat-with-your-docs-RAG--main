import { documentModel } from '../models/index.js';
import aiService from '../services/aiService.js';
import pdfService from '../services/pdfService.js';

class DocumentController {
    // Upload a document
    async uploadDocument(req, res, next) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
                return res.status(400).json({ error: 'File must be a PDF' });
            }

            const { title } = req.body;
            if (!title) {
                return res.status(400).json({ error: 'Title is required' });
            }

            // Extract text from PDF to validate it
            const pdfText = await pdfService.extractTextFromPDF(req.file.buffer);

            if (!pdfText.trim()) {
                return res.status(400).json({ error: 'No text found in PDF' });
            }

            // Create document in storage
            const document = documentModel.create({
                title,
                user_id: "default-user-id",
                file_path: `/uploads/${Date.now()}.pdf`,
                pdf_text: pdfText
            });

            res.json({
                id: document.id,
                title: document.title,
                created_at: document.created_at
            });
        } catch (error) {
            next(error);
        }
    }

    // Process a document with AI
    async processDocument(req, res, next) {
        try {
            const { document_id } = req.params;
            const document = documentModel.findById(document_id);

            if (!document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            const pdfText = document.pdf_text;
            if (!pdfText) {
                return res.status(400).json({ error: 'No text content found for this document' });
            }

            // Generate summary using AI
            const summaryPrompt = aiService.createSummaryPrompt(pdfText);
            const summaryResponse = await aiService.callOpenRouterAPI(summaryPrompt);
            const summaryData = aiService.parseJSONResponse(summaryResponse);

            // Generate quiz using AI
            const quizPrompt = aiService.createQuizPrompt(pdfText);
            const quizResponse = await aiService.callOpenRouterAPI(quizPrompt);
            const quizData = aiService.parseJSONResponse(quizResponse);

            // Generate flashcards using AI
            const flashcardsPrompt = aiService.createFlashcardsPrompt(pdfText);
            const flashcardsResponse = await aiService.callOpenRouterAPI(flashcardsPrompt);
            const flashcardsData = aiService.parseJSONResponse(flashcardsResponse);

            // Transform the AI responses to match frontend schema
            const summary = {
                id: `sum-${document_id}`,
                document_id: document_id,
                content: summaryData.summary || "Summary not available",
                created_at: new Date().toISOString()
            };

            // Transform flashcards from AI response
            const flashcards = (flashcardsData.flashcards || []).map((card, i) => ({
                id: `fc-${document_id}-${i + 1}`,
                document_id: document_id,
                question: card.front || "",
                answer: card.back || "",
                created_at: new Date().toISOString()
            }));

            // Transform quiz from AI response
            const quizQuestions = (quizData.questions || []).map((q, i) => ({
                id: `q-${document_id}-${i + 1}`,
                quiz_id: `quiz-${document_id}`,
                question: q.question || "",
                options: q.options || [],
                correct_answer: (q.options && q.options[q.correct_answer]) ? q.options[q.correct_answer] : "",
                created_at: new Date().toISOString()
            }));

            const quiz = {
                id: `quiz-${document_id}`,
                document_id: document_id,
                title: `Quiz: ${document.title}`,
                created_at: new Date().toISOString(),
                questions: quizQuestions
            };

            // Update document with processed content
            documentModel.markAsProcessed(document_id, {
                summary,
                flashcards,
                quiz
            });

            res.json({
                status: "success",
                message: "Document processed successfully with AI-generated content",
                document_id: document_id
            });

        } catch (error) {
            next(error);
        }
    }

    // Get all documents
    async getDocuments(req, res, next) {
        try {
            const documents = documentModel.findAll().map(doc => ({
                id: doc.id,
                title: doc.title,
                created_at: doc.created_at
            }));

            res.json(documents);
        } catch (error) {
            next(error);
        }
    }

    // Get document by ID
    async getDocument(req, res, next) {
        try {
            const { document_id } = req.params;
            const document = documentModel.findById(document_id);

            if (document) {
                // If document has been processed, return the real data
                if (document.processed) {
                    return res.json({
                        id: document.id,
                        title: document.title,
                        created_at: document.created_at,
                        user_id: document.user_id,
                        file_path: document.file_path,
                        summary: document.summary,
                        flashcards: document.flashcards || [],
                        quiz: document.quiz
                    });
                } else {
                    // Document exists but not processed yet, return basic info
                    return res.json({
                        id: document.id,
                        title: document.title,
                        created_at: document.created_at,
                        user_id: document.user_id,
                        file_path: document.file_path,
                        summary: null,
                        flashcards: [],
                        quiz: null
                    });
                }
            }

            // Document not found, return mock data for demo purposes
            const mockDocument = {
                id: document_id,
                title: "Sample Document: AI Fundamentals",
                created_at: new Date().toISOString(),
                user_id: "default-user-id",
                file_path: `/uploads/${document_id}.pdf`,
                summary: {
                    id: `sum-${document_id}`,
                    document_id: document_id,
                    content: "This document provides a comprehensive introduction to Artificial Intelligence, covering key concepts such as machine learning, neural networks, natural language processing, and computer vision. It explores the historical development of AI, current applications across various industries, and future prospects for AI technology.",
                    created_at: new Date().toISOString()
                },
                flashcards: [
                    {
                        id: `fc-${document_id}-1`,
                        document_id: document_id,
                        question: "What is Artificial Intelligence?",
                        answer: "Artificial Intelligence is the simulation of human intelligence processes by machines, especially computer systems.",
                        created_at: new Date().toISOString()
                    },
                    {
                        id: `fc-${document_id}-2`,
                        document_id: document_id,
                        question: "What are the main types of machine learning?",
                        answer: "Supervised learning, unsupervised learning, and reinforcement learning.",
                        created_at: new Date().toISOString()
                    },
                    {
                        id: `fc-${document_id}-3`,
                        document_id: document_id,
                        question: "What is a neural network?",
                        answer: "A computing system inspired by biological neural networks that processes information using interconnected nodes.",
                        created_at: new Date().toISOString()
                    }
                ],
                quiz: {
                    id: `quiz-${document_id}`,
                    document_id: document_id,
                    title: "AI Fundamentals Quiz",
                    created_at: new Date().toISOString(),
                    questions: [
                        {
                            id: `q-${document_id}-1`,
                            quiz_id: `quiz-${document_id}`,
                            question: "Which of the following is a subset of AI focused on learning from data?",
                            options: ["Machine Learning", "Computer Graphics", "Database Management", "Web Development"],
                            correct_answer: "Machine Learning",
                            created_at: new Date().toISOString()
                        },
                        {
                            id: `q-${document_id}-2`,
                            quiz_id: `quiz-${document_id}`,
                            question: "What type of AI can perform any intellectual task that a human can do?",
                            options: ["Narrow AI", "General AI", "Super AI", "Weak AI"],
                            correct_answer: "General AI",
                            created_at: new Date().toISOString()
                        }
                    ]
                }
            };

            res.json(mockDocument);
        } catch (error) {
            next(error);
        }
    }
}

export default new DocumentController();
