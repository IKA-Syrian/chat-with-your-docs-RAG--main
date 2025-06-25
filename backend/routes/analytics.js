/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Learning analytics and session tracking endpoints
 */

import express from 'express';
import analyticsController from '../controllers/analyticsController.js';
import { validateUser } from './auth.js';

const router = express.Router();

// Authentication middleware for analytics routes
const authMiddleware = async (req, res, next) => {
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

        // Set user on request object for analytics controller
        req.user = user;
        next();
    } catch (error) {
        console.error('Analytics auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

/**
 * @swagger
 * /analytics/dashboard:
 *   get:
 *     summary: Get analytics dashboard data
 *     description: Retrieve comprehensive analytics data for the current user including study sessions, flashcard performance, and quiz results
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             examples:
 *               success:
 *                 value:
 *                   success: true
 *                   data:
 *                     overall_analytics:
 *                       total_study_time: 3600
 *                       current_streak: 5
 *                       longest_streak: 12
 *                       total_flashcards_seen: 150
 *                       total_flashcards_mastered: 120
 *                       flashcard_accuracy_overall: 80
 *                       total_quizzes_completed: 15
 *                       average_quiz_score_overall: 85
 *                       study_sessions_this_week_count: 7
 *                     study_sessions_chart_data:
 *                       - date: "2025-01-01"
 *                         duration: 45
 *                         sessions: 2
 *                     flashcard_performance_chart_data:
 *                       - document_title: "Introduction to AI"
 *                         accuracy: 85
 *                         attempts: 20
 *                     quiz_performance_chart_data:
 *                       - date: "2025-01-01"
 *                         score: 85
 *                         quiz_title: "AI Basics Quiz"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Analytics dashboard data
router.get('/dashboard', authMiddleware, analyticsController.getAnalyticsPageData);

/**
 * @swagger
 * /analytics/session/start:
 *   post:
 *     summary: Start a new study session
 *     description: Begin tracking a new study session for analytics purposes
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_type:
 *                 type: string
 *                 enum: [study, chat, flashcard, quiz, browse]
 *                 description: Type of activity being tracked
 *                 example: study
 *               document_id:
 *                 type: string
 *                 description: Optional document ID being studied
 *                 example: "doc_123"
 *               document_title:
 *                 type: string
 *                 description: Optional document title
 *                 example: "Introduction to Machine Learning"
 *     responses:
 *       200:
 *         description: Study session started successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /analytics/session/{session_id}/end:
 *   post:
 *     summary: End a study session
 *     description: End the specified study session and record the duration
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: session_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The session ID to end
 *         example: "session_123"
 *     responses:
 *       200:
 *         description: Study session ended successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Study session management
router.post('/session/start', authMiddleware, analyticsController.startStudySession);
router.post('/session/:session_id/end', authMiddleware, analyticsController.endStudySession);

/**
 * @swagger
 * /analytics/flashcard/attempt:
 *   post:
 *     summary: Track flashcard attempt
 *     description: Record a flashcard attempt for analytics tracking
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *               - correct
 *             properties:
 *               document_id:
 *                 type: string
 *                 description: Optional document ID
 *                 example: "doc_123"
 *               question:
 *                 type: string
 *                 description: Flashcard question or identifier
 *                 example: "What is machine learning?"
 *               answer:
 *                 type: string
 *                 description: User's answer
 *                 example: "A subset of AI"
 *               correct:
 *                 type: boolean
 *                 description: Whether the answer was correct
 *                 example: true
 *               response_time:
 *                 type: number
 *                 description: Time taken to answer in seconds
 *                 example: 5.2
 *     responses:
 *       200:
 *         description: Flashcard attempt tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /analytics/quiz/attempt:
 *   post:
 *     summary: Track quiz question attempt
 *     description: Record a quiz question attempt for analytics tracking
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *               - correct
 *             properties:
 *               document_id:
 *                 type: string
 *                 description: Optional document ID
 *                 example: "doc_123"
 *               question:
 *                 type: string
 *                 description: Quiz question text or identifier
 *                 example: "Question 1"
 *               answer:
 *                 type: string
 *                 description: User's answer
 *                 example: "Option A"
 *               correct:
 *                 type: boolean
 *                 description: Whether the answer was correct
 *                 example: true
 *               response_time:
 *                 type: number
 *                 description: Time taken to answer in seconds
 *                 example: 10.5
 *     responses:
 *       200:
 *         description: Quiz attempt tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /analytics/quiz/completion:
 *   post:
 *     summary: Track quiz completion
 *     description: Record a completed quiz for analytics tracking
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - score
 *             properties:
 *               document_id:
 *                 type: string
 *                 description: Optional document ID
 *                 example: "doc_123"
 *               document_title:
 *                 type: string
 *                 description: Document title
 *                 example: "Introduction to AI"
 *               score:
 *                 type: number
 *                 description: Quiz score percentage (0-100)
 *                 example: 85
 *               total_questions:
 *                 type: integer
 *                 description: Total number of questions
 *                 example: 10
 *               correct_answers:
 *                 type: integer
 *                 description: Number of correct answers
 *                 example: 8
 *               time_taken:
 *                 type: number
 *                 description: Total time taken in seconds
 *                 example: 300
 *               started_at:
 *                 type: string
 *                 format: date-time
 *                 description: When the quiz was started
 *     responses:
 *       200:
 *         description: Quiz completion tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /analytics/document/{document_id}/progress:
 *   get:
 *     summary: Get document progress
 *     description: Retrieve learning progress for a specific document
 *     tags: [Analytics]
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
 *         description: Document progress retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     document_id:
 *                       type: string
 *                       example: "doc_123"
 *                     progress:
 *                       type: object
 *                       description: Progress metrics for the document
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /analytics/user/stats:
 *   get:
 *     summary: Get user statistics
 *     description: Retrieve overall learning statistics for the current user
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: string
 *                       description: User ID
 *                     stats:
 *                       $ref: '#/components/schemas/AnalyticsOverview'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

// Learning attempt tracking
router.post('/flashcard/attempt', authMiddleware, analyticsController.trackFlashcardAttempt);
router.post('/quiz/attempt', authMiddleware, analyticsController.trackQuizAttempt);
router.post('/quiz/completion', authMiddleware, analyticsController.trackQuizCompletion);

// Progress tracking
router.get('/document/:document_id/progress', authMiddleware, analyticsController.getDocumentProgress);
router.get('/user/stats', authMiddleware, analyticsController.getUserStats);

// Legacy endpoints (for compatibility with original system)
router.get('/pagedata', authMiddleware, analyticsController.getAnalyticsPageData);

export default router; 