import { sessionModel } from '../models/index.js';

class AnalyticsController {
    // Get analytics page data
    async getAnalyticsPageData(req, res, next) {
        try {
            const analytics = sessionModel.getAnalytics();
            res.json(analytics);
        } catch (error) {
            next(error);
        }
    }

    // Start study session
    async startStudySession(req, res, next) {
        try {
            const sessionData = req.body;
            const session = sessionModel.createSession(sessionData);
            res.json({ id: session.id, status: "started" });
        } catch (error) {
            next(error);
        }
    }

    // End study session
    async endStudySession(req, res, next) {
        try {
            const { session_id } = req.params;
            const session = sessionModel.endSession(session_id);

            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }

            res.json({ status: "ended", session_id: session_id });
        } catch (error) {
            next(error);
        }
    }

    // Track flashcard attempt
    async trackFlashcardAttempt(req, res, next) {
        try {
            const attemptData = req.body;
            const attempt = sessionModel.trackAttempt({
                type: 'flashcard',
                ...attemptData
            });

            res.json({ status: "tracked", attempt_id: attempt.id });
        } catch (error) {
            next(error);
        }
    }

    // Track quiz attempt
    async trackQuizAttempt(req, res, next) {
        try {
            const quizData = req.body;
            const attempt = sessionModel.trackAttempt({
                type: 'quiz',
                ...quizData
            });

            res.json({ status: "tracked", quiz_attempt_id: attempt.id });
        } catch (error) {
            next(error);
        }
    }
}

export default new AnalyticsController();
