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

// Enhanced PDF upload and processing endpoint
router.post('/upload-pdf', upload.single('pdf'), enhancedProcessingController.uploadAndProcessPDF);

// Text-based educational content generation endpoints
router.post('/summary', enhancedProcessingController.generateSummary);
router.post('/quiz', enhancedProcessingController.generateQuiz);
router.post('/flashcards', enhancedProcessingController.generateFlashcards);

// Generate all educational content at once (main endpoint)
router.post('/generate', enhancedProcessingController.generateAllEducationalContent);

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

// Document management endpoints
router.get('/documents/:document_id', enhancedProcessingController.getDocumentEducationalContent);
router.get('/documents', enhancedProcessingController.listDocuments);
router.delete('/documents/:document_id', enhancedProcessingController.deleteDocument);

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