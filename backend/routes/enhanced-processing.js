/**
 * @swagger
 * tags:
 *   name: Enhanced Processing
 *   description: Advanced document processing and educational content generation endpoints
 */

import { Router } from 'express';
import multer from 'multer';
import enhancedProcessingController from '../controllers/enhancedProcessingController.js';
import { validateUser } from './auth.js';
import aiProviderManager from '../lib/ai-providers.js';

const router = Router();

// Configure multer for file uploads (PDF processing)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

/**
 * @swagger
 * /enhanced-processing/upload-pdf:
 *   post:
 *     summary: Upload and process PDF file
 *     description: Upload a PDF file and automatically process it to extract content and generate educational materials
 *     tags: [Enhanced Processing]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - pdf
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to upload and process
 *           encoding:
 *             pdf:
 *               contentType: application/pdf
 *     responses:
 *       200:
 *         description: PDF uploaded and processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "PDF processed successfully"
 *                 document:
 *                   $ref: '#/components/schemas/Document'
 *                 summary:
 *                   type: object
 *                   description: Generated summary
 *                 flashcards:
 *                   type: array
 *                   description: Generated flashcards
 *                 quiz:
 *                   type: object
 *                   description: Generated quiz questions
 *       400:
 *         description: Invalid file or processing error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Enhanced PDF upload and processing endpoint
router.post('/upload-pdf', upload.single('pdf'), enhancedProcessingController.uploadAndProcessPDF);

/**
 * @swagger
 * /enhanced-processing/summary:
 *   post:
 *     summary: Generate document summary
 *     description: Generate an AI-powered summary for provided text content
 *     tags: [Enhanced Processing]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text content to summarize
 *                 example: "This is a long document about machine learning..."
 *               provider:
 *                 type: string
 *                 description: AI provider to use (optional)
 *                 example: "openai"
 *               model:
 *                 type: string
 *                 description: Specific model to use (optional)
 *                 example: "gpt-4"
 *     responses:
 *       200:
 *         description: Summary generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 summary:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: string
 *                       description: Main summary text
 *                     key_points:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Key points from the content
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Text-based educational content generation endpoints
router.post('/summary', enhancedProcessingController.generateSummary);

/**
 * @swagger
 * /enhanced-processing/quiz:
 *   post:
 *     summary: Generate quiz questions
 *     description: Generate AI-powered quiz questions for provided text content
 *     tags: [Enhanced Processing]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text content to create quiz from
 *                 example: "This is content about machine learning algorithms..."
 *               provider:
 *                 type: string
 *                 description: AI provider to use (optional)
 *                 example: "openai"
 *               model:
 *                 type: string
 *                 description: Specific model to use (optional)
 *                 example: "gpt-4"
 *     responses:
 *       200:
 *         description: Quiz questions generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 quiz:
 *                   type: object
 *                   properties:
 *                     questions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           question:
 *                             type: string
 *                           options:
 *                             type: array
 *                             items:
 *                               type: string
 *                           correct_answer:
 *                             type: integer
 *                           explanation:
 *                             type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/quiz', enhancedProcessingController.generateQuiz);

/**
 * @swagger
 * /enhanced-processing/flashcards:
 *   post:
 *     summary: Generate flashcards
 *     description: Generate AI-powered flashcards for provided text content
 *     tags: [Enhanced Processing]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text content to create flashcards from
 *                 example: "This is content about machine learning concepts..."
 *               provider:
 *                 type: string
 *                 description: AI provider to use (optional)
 *                 example: "openai"
 *               model:
 *                 type: string
 *                 description: Specific model to use (optional)
 *                 example: "gpt-4"
 *     responses:
 *       200:
 *         description: Flashcards generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 flashcards:
 *                   type: object
 *                   properties:
 *                     flashcards:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           front:
 *                             type: string
 *                             description: Question or prompt
 *                           back:
 *                             type: string
 *                             description: Answer or explanation
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/flashcards', enhancedProcessingController.generateFlashcards);

/**
 * @swagger
 * /enhanced-processing/generate:
 *   post:
 *     summary: Generate all educational content
 *     description: Generate summary, flashcards, and quiz questions for a document in one request
 *     tags: [Enhanced Processing]
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
 *               provider:
 *                 type: string
 *                 description: AI provider to use (optional)
 *                 example: "openai"
 *               model:
 *                 type: string
 *                 description: Specific model to use (optional)
 *                 example: "gpt-4"
 *     responses:
 *       200:
 *         description: Educational content generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 summary:
 *                   type: object
 *                   description: Generated summary with key points
 *                 flashcards:
 *                   type: object
 *                   description: Generated flashcards array
 *                 quiz:
 *                   type: object
 *                   description: Generated quiz questions
 *                 generated_at:
 *                   type: string
 *                   format: date-time
 *                   description: Timestamp when content was generated
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Generate all educational content at once (main endpoint)
router.post('/generate', enhancedProcessingController.generateAllEducationalContent);

/**
 * @swagger
 * /enhanced-processing/providers:
 *   get:
 *     summary: Get available AI providers
 *     description: Retrieve list of configured AI providers with their available models for educational content generation
 *     tags: [Enhanced Processing]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: AI providers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 providers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AIProvider'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Get available AI providers with models
router.get('/providers', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        // Validate user
        const { user, error: userError } = await validateUser(authToken);
        if (userError || !user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const providers = aiProviderManager.getAvailableProvidersWithModels();
        res.json({ providers });
    } catch (error) {
        console.error('Get providers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /enhanced-processing/documents/{document_id}:
 *   get:
 *     summary: Get document with educational content
 *     description: Retrieve a document along with its generated educational content (summary, flashcards, quiz)
 *     tags: [Enhanced Processing]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: document_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *         example: "doc_123"
 *     responses:
 *       200:
 *         description: Document with educational content retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 document:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Document ID
 *                     name:
 *                       type: string
 *                       description: Document name
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: Creation timestamp
 *                     summary:
 *                       type: object
 *                       description: Generated summary and key points
 *                     flashcards:
 *                       type: object
 *                       description: Generated flashcards
 *                     quiz:
 *                       type: object
 *                       description: Generated quiz questions
 *                     educational_content_generated:
 *                       type: string
 *                       format: date-time
 *                       description: When educational content was generated
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Document management endpoints
router.get('/documents/:document_id', enhancedProcessingController.getDocumentEducationalContent);

/**
 * @swagger
 * /enhanced-processing/documents:
 *   get:
 *     summary: List all user documents
 *     description: Retrieve all documents for the authenticated user with educational content status
 *     tags: [Enhanced Processing]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 documents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Document'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/documents', enhancedProcessingController.listDocuments);

/**
 * @swagger
 * /enhanced-processing/documents/{document_id}:
 *   delete:
 *     summary: Delete a document
 *     description: Delete a document and all its associated educational content
 *     tags: [Enhanced Processing]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: document_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID to delete
 *         example: "doc_123"
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Document deleted successfully"
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/documents/:document_id', enhancedProcessingController.deleteDocument);

/**
 * @swagger
 * /enhanced-processing/quiz/{document_id}:
 *   get:
 *     summary: Get quiz questions (secure)
 *     description: Retrieve quiz questions for a document without correct answers for secure quiz taking
 *     tags: [Enhanced Processing]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: document_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *         example: "doc_123"
 *     responses:
 *       200:
 *         description: Quiz questions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: Question ID
 *                       question:
 *                         type: string
 *                         description: Question text
 *                       options:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Multiple choice options
 *       404:
 *         description: Quiz not found for this document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Get quiz questions without correct answers (secure)
router.get('/quiz/:document_id', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        // Validate user
        const { user, error: userError } = await validateUser(authToken);
        if (userError || !user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { document_id } = req.params;

        console.log('🎯 Getting quiz questions for document:', document_id);

        // Get document from main documents table
        const { supabaseAdmin } = await import('../lib/supabase.js');
        const supabase = supabaseAdmin();

        const { data: document, error: docError } = await supabase
            .from('documents')
            .select('quiz, name, educational_content_generated')
            .eq('id', document_id)
            .single();

        console.log('📋 Database query result:', {
            found: !!document,
            hasQuiz: !!(document?.quiz),
            error: docError?.message,
            educationalContentGenerated: document?.educational_content_generated
        });

        if (docError) {
            console.error('❌ Database error:', docError);
            return res.status(500).json({ error: 'Database error: ' + docError.message });
        }

        if (!document) {
            console.log('❌ Document not found in database');
            return res.status(404).json({ error: 'Document not found' });
        }

        if (!document.quiz) {
            console.log('❌ No quiz data found for document');
            return res.status(404).json({ error: 'Quiz not found for this document. Please generate educational content first.' });
        }

        // Parse quiz data if it's a string
        let quizData;
        try {
            quizData = typeof document.quiz === 'string' ? JSON.parse(document.quiz) : document.quiz;
        } catch (parseError) {
            console.error('Failed to parse quiz data:', parseError);
            return res.status(500).json({ error: 'Invalid quiz data format' });
        }

        if (!quizData.questions || !Array.isArray(quizData.questions)) {
            return res.status(404).json({ error: 'Quiz questions not found for this document' });
        }

        // Remove correct answers and explanations for security
        const secureQuiz = {
            questions: quizData.questions.map((q, index) => ({
                id: index,
                question: q.question,
                options: q.options
                // Note: correct_answer and explanation are intentionally excluded
            }))
        };

        res.json(secureQuiz);
    } catch (error) {
        console.error('Get secure quiz error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /enhanced-processing/quiz/{document_id}/submit:
 *   post:
 *     summary: Submit quiz answers
 *     description: Submit quiz answers and receive results with correct answers and explanations
 *     tags: [Enhanced Processing]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: document_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *         example: "doc_123"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answers
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: integer
 *                       description: Question ID (0-based index)
 *                     selectedOption:
 *                       type: integer
 *                       description: Selected option index (0-based)
 *                 example:
 *                   - questionId: 0
 *                     selectedOption: 1
 *                   - questionId: 1
 *                     selectedOption: 0
 *               start_time:
 *                 type: string
 *                 format: date-time
 *                 description: When the quiz was started
 *               end_time:
 *                 type: string
 *                 format: date-time
 *                 description: When the quiz was completed
 *     responses:
 *       200:
 *         description: Quiz results calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 score:
 *                   type: integer
 *                   description: Score percentage (0-100)
 *                   example: 85
 *                 correctAnswers:
 *                   type: integer
 *                   description: Number of correct answers
 *                   example: 8
 *                 totalQuestions:
 *                   type: integer
 *                   description: Total number of questions
 *                   example: 10
 *                 timeTaken:
 *                   type: integer
 *                   description: Time taken in seconds
 *                   example: 300
 *                 passed:
 *                   type: boolean
 *                   description: Whether the quiz was passed (70% or higher)
 *                   example: true
 *                 results:
 *                   type: array
 *                   description: Detailed results for each question
 *                   items:
 *                     type: object
 *                     properties:
 *                       questionId:
 *                         type: integer
 *                       question:
 *                         type: string
 *                       options:
 *                         type: array
 *                         items:
 *                           type: string
 *                       userAnswer:
 *                         type: integer
 *                       correctAnswer:
 *                         type: integer
 *                       isCorrect:
 *                         type: boolean
 *                       explanation:
 *                         type: string
 *       404:
 *         description: Quiz not found for this document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Submit quiz answers and get results
router.post('/quiz/:document_id/submit', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        // Validate user
        const { user, error: userError } = await validateUser(authToken);
        if (userError || !user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { document_id } = req.params;
        const { answers, start_time, end_time } = req.body; // answers: [{questionId: 0, selectedOption: 1}]

        console.log('📝 Submitting quiz for document:', document_id);
        console.log('📊 Answers received:', answers?.length || 0, 'answers');

        // Get document from main documents table
        const { supabaseAdmin } = await import('../lib/supabase.js');
        const supabase = supabaseAdmin();

        const { data: document, error: docError } = await supabase
            .from('documents')
            .select('quiz, name')
            .eq('id', document_id)
            .single();

        if (docError || !document || !document.quiz) {
            return res.status(404).json({ error: 'Quiz not found for this document' });
        }

        // Parse quiz data if it's a string
        let quizData;
        try {
            quizData = typeof document.quiz === 'string' ? JSON.parse(document.quiz) : document.quiz;
        } catch (parseError) {
            console.error('Failed to parse quiz data:', parseError);
            return res.status(500).json({ error: 'Invalid quiz data format' });
        }

        if (!quizData.questions || !Array.isArray(quizData.questions)) {
            return res.status(404).json({ error: 'Quiz questions not found for this document' });
        }

        // Calculate results
        let correctAnswers = 0;
        const results = quizData.questions.map((q, index) => {
            const userAnswer = answers.find(a => a.questionId === index);
            const isCorrect = userAnswer && userAnswer.selectedOption === q.correct_answer;

            if (isCorrect) correctAnswers++;

            return {
                questionId: index,
                question: q.question,
                options: q.options,
                userAnswer: userAnswer ? userAnswer.selectedOption : null,
                correctAnswer: q.correct_answer,
                isCorrect,
                explanation: q.explanation
            };
        });

        const score = Math.round((correctAnswers / quizData.questions.length) * 100);
        const timeTaken = end_time && start_time ? Math.round((new Date(end_time) - new Date(start_time)) / 1000) : 0;

        // Record quiz completion for analytics
        try {
            const analyticsData = {
                user_id: user.id,
                document_id,
                document_title: document.name,
                score,
                total_questions: quizData.questions.length,
                correct_answers: correctAnswers,
                time_taken: timeTaken,
                started_at: start_time || new Date(Date.now() - timeTaken * 1000).toISOString(),
                completed_at: new Date().toISOString()
            };

            // Store in analytics table using the correct table name
            try {
                await supabase
                    .from('quiz_completions')
                    .insert(analyticsData);
                console.log('✅ Quiz completion recorded for analytics');
            } catch (analyticsError) {
                console.log('⚠️ Could not record quiz completion:', analyticsError.message);
                // Continue even if analytics fails
            }

            // Also record individual question attempts for detailed analytics
            for (const result of results) {
                try {
                    await supabase
                        .from('learning_attempts')
                        .insert({
                            user_id: user.id,
                            document_id,
                            attempt_type: 'quiz_question',
                            question: result.question,
                            user_answer: result.options[result.userAnswer] || 'No answer',
                            correct_answer: result.options[result.correctAnswer],
                            is_correct: result.isCorrect,
                            response_time: Math.round(timeTaken / quizData.questions.length * 1000), // Estimate per question
                            created_at: new Date().toISOString()
                        });
                } catch (attemptError) {
                    console.log('⚠️ Could not record question attempt:', attemptError.message);
                }
            }
        } catch (recordError) {
            console.log('⚠️ Analytics recording failed:', recordError.message);
        }

        // Phase 3 #9 — feed wrong answers into the mistake journal.
        try {
            const wrongRows = results
                .filter(r => !r.isCorrect)
                .map(r => ({
                    user_id: user.id,
                    document_id,
                    source_kind: 'quiz',
                    source_id: null,
                    question: r.question,
                    expected_answer: r.options?.[r.correctAnswer] ?? null,
                    user_answer: r.userAnswer == null ? null : (r.options?.[r.userAnswer] ?? String(r.userAnswer)),
                    details: {
                        question_index: r.questionId,
                        selected_option: r.userAnswer,
                        correct_option: r.correctAnswer,
                        explanation: r.explanation || null
                    }
                }));
            if (wrongRows.length > 0) {
                const { error: journalErr } = await supabase
                    .from('wrong_answers')
                    .insert(wrongRows);
                if (journalErr && journalErr.code !== '42P01' && !/does not exist/i.test(journalErr.message || '')) {
                    console.warn('⚠️  wrong_answers (quiz) insert failed:', journalErr.message);
                }
            }
        } catch (journalCatch) {
            console.warn('⚠️  wrong_answers (quiz) threw:', journalCatch.message);
        }

        const response = {
            score,
            correctAnswers,
            totalQuestions: quizData.questions.length,
            timeTaken,
            results,
            passed: score >= 70 // Consider 70% as passing
        };

        res.json(response);
    } catch (error) {
        console.error('Submit quiz error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router; 