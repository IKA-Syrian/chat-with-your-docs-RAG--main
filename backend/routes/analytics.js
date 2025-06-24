import express from 'express';
import analyticsController from '../controllers/analyticsController.js';

const router = express.Router();

// Analytics dashboard data
router.get('/dashboard', analyticsController.getAnalyticsPageData);

// Study session management
router.post('/session/start', analyticsController.startStudySession);
router.post('/session/:session_id/end', analyticsController.endStudySession);

// Learning attempt tracking
router.post('/flashcard/attempt', analyticsController.trackFlashcardAttempt);
router.post('/quiz/attempt', analyticsController.trackQuizAttempt);
router.post('/quiz/completion', analyticsController.trackQuizCompletion);

// Progress tracking
router.get('/document/:document_id/progress', analyticsController.getDocumentProgress);
router.get('/user/stats', analyticsController.getUserStats);

// Legacy endpoints (for compatibility with original system)
router.get('/pagedata', analyticsController.getAnalyticsPageData);

export default router; 