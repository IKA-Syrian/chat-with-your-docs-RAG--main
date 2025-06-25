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

// Analytics dashboard data
router.get('/dashboard', authMiddleware, analyticsController.getAnalyticsPageData);

// Study session management
router.post('/session/start', authMiddleware, analyticsController.startStudySession);
router.post('/session/:session_id/end', authMiddleware, analyticsController.endStudySession);

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