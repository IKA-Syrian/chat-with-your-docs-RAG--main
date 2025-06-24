import express from 'express';
import analyticsController from '../controllers/analyticsController.js';

const router = express.Router();

// Analytics endpoints
router.get('/analytics/pagedata', analyticsController.getAnalyticsPageData);
router.post('/analytics/session/start', analyticsController.startStudySession);
router.post('/analytics/session/:session_id/end', analyticsController.endStudySession);
router.post('/analytics/flashcard/attempt', analyticsController.trackFlashcardAttempt);
router.post('/analytics/quiz/attempt', analyticsController.trackQuizAttempt);

export default router;
