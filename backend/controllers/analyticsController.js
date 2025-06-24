import { sessionModel, documentModel } from '../lib/analytics-models.js';

class AnalyticsController {
    // Get analytics page data
    async getAnalyticsPageData(req, res, next) {
        try {
            const userId = req.user?.id || req.query.user_id || 'anonymous';
            const analytics = sessionModel.getAnalytics(userId);
            res.json({
                success: true,
                data: analytics
            });
        } catch (error) {
            console.error('❌ Error fetching analytics:', error);
            next(error);
        }
    }

    // Start study session
    async startStudySession(req, res, next) {
        try {
            const { document_id, document_title, session_type } = req.body;
            const userId = req.user?.id || req.body.user_id || 'anonymous';

            if (!document_id) {
                return res.status(400).json({
                    error: 'Document ID is required',
                    success: false
                });
            }

            const sessionData = {
                user_id: userId,
                document_id,
                document_title,
                session_type: session_type || 'study'
            };

            const session = sessionModel.createSession(sessionData);

            // Update document analytics
            documentModel.incrementAnalytics(document_id, 'study_sessions');

            console.log('📚 Study session started:', session.id);

            res.json({
                success: true,
                data: {
                    id: session.id,
                    status: "started",
                    started_at: session.started_at
                }
            });
        } catch (error) {
            console.error('❌ Error starting study session:', error);
            next(error);
        }
    }

    // End study session
    async endStudySession(req, res, next) {
        try {
            const { session_id } = req.params;

            if (!session_id) {
                return res.status(400).json({
                    error: 'Session ID is required',
                    success: false
                });
            }

            const session = sessionModel.endSession(session_id);

            if (!session) {
                return res.status(404).json({
                    error: 'Session not found',
                    success: false
                });
            }

            console.log('✅ Study session ended:', session_id, `Duration: ${session.duration}s`);

            res.json({
                success: true,
                data: {
                    status: "ended",
                    session_id: session_id,
                    duration: session.duration,
                    ended_at: session.ended_at
                }
            });
        } catch (error) {
            console.error('❌ Error ending study session:', error);
            next(error);
        }
    }

    // Track flashcard attempt
    async trackFlashcardAttempt(req, res, next) {
        try {
            const { document_id, question, answer, correct, response_time } = req.body;
            const userId = req.user?.id || req.body.user_id || 'anonymous';

            if (!document_id || !question) {
                return res.status(400).json({
                    error: 'Document ID and question are required',
                    success: false
                });
            }

            const attemptData = {
                user_id: userId,
                document_id,
                type: 'flashcard',
                question,
                answer,
                correct: correct || false,
                response_time: response_time || 0
            };

            const attempt = sessionModel.trackAttempt(attemptData);

            // Update document analytics
            documentModel.incrementAnalytics(document_id, 'flashcard_attempts');

            console.log('🗂️ Flashcard attempt tracked:', attempt.id, correct ? '✅' : '❌');

            res.json({
                success: true,
                data: {
                    status: "tracked",
                    attempt_id: attempt.id,
                    correct: attempt.correct
                }
            });
        } catch (error) {
            console.error('❌ Error tracking flashcard attempt:', error);
            next(error);
        }
    }

    // Track quiz attempt
    async trackQuizAttempt(req, res, next) {
        try {
            const { document_id, question, answer, correct, response_time } = req.body;
            const userId = req.user?.id || req.body.user_id || 'anonymous';

            if (!document_id || !question) {
                return res.status(400).json({
                    error: 'Document ID and question are required',
                    success: false
                });
            }

            const attemptData = {
                user_id: userId,
                document_id,
                type: 'quiz',
                question,
                answer,
                correct: correct || false,
                response_time: response_time || 0
            };

            const attempt = sessionModel.trackAttempt(attemptData);

            // Update document analytics
            documentModel.incrementAnalytics(document_id, 'quiz_attempts');

            console.log('❓ Quiz attempt tracked:', attempt.id, correct ? '✅' : '❌');

            res.json({
                success: true,
                data: {
                    status: "tracked",
                    quiz_attempt_id: attempt.id,
                    correct: attempt.correct
                }
            });
        } catch (error) {
            console.error('❌ Error tracking quiz attempt:', error);
            next(error);
        }
    }

    // Track quiz completion
    async trackQuizCompletion(req, res, next) {
        try {
            const {
                document_id,
                document_title,
                score,
                total_questions,
                correct_answers,
                time_taken
            } = req.body;
            const userId = req.user?.id || req.body.user_id || 'anonymous';

            if (!document_id || score === undefined) {
                return res.status(400).json({
                    error: 'Document ID and score are required',
                    success: false
                });
            }

            const quizData = {
                user_id: userId,
                document_id,
                document_title,
                score,
                total_questions,
                correct_answers,
                time_taken
            };

            const quiz = sessionModel.trackQuizCompletion(quizData);

            console.log('🎯 Quiz completion tracked:', quiz.id, `Score: ${score}%`);

            res.json({
                success: true,
                data: {
                    status: "tracked",
                    quiz_id: quiz.id,
                    score: quiz.score,
                    completed_at: quiz.completed_at
                }
            });
        } catch (error) {
            console.error('❌ Error tracking quiz completion:', error);
            next(error);
        }
    }

    // Get document progress
    async getDocumentProgress(req, res, next) {
        try {
            const { document_id } = req.params;
            const userId = req.user?.id || req.query.user_id || 'anonymous';

            if (!document_id) {
                return res.status(400).json({
                    error: 'Document ID is required',
                    success: false
                });
            }

            const progress = sessionModel.getDocumentProgress(document_id, userId);

            res.json({
                success: true,
                data: {
                    document_id,
                    progress
                }
            });
        } catch (error) {
            console.error('❌ Error fetching document progress:', error);
            next(error);
        }
    }

    // Get user study statistics
    async getUserStats(req, res, next) {
        try {
            const userId = req.user?.id || req.query.user_id || 'anonymous';
            const analytics = sessionModel.getAnalytics(userId);

            res.json({
                success: true,
                data: {
                    user_id: userId,
                    stats: analytics.overall_analytics
                }
            });
        } catch (error) {
            console.error('❌ Error fetching user stats:', error);
            next(error);
        }
    }
}

export default new AnalyticsController(); 