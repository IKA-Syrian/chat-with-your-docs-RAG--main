import { sessionModel, documentModel } from '../lib/analytics-models.js';

class AnalyticsController {
    // Get analytics page data
    async getAnalyticsPageData(req, res, next) {
        try {
            const userId = req.user?.id || req.query.user_id || 'anonymous';
            console.log('📊 Fetching analytics for user:', userId);

            const analytics = await sessionModel.getAnalytics(userId);
            console.log('📊 Analytics retrieved:', analytics);

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

            const sessionData = {
                user_id: userId,
                document_id: document_id || null,
                document_title: document_title || (session_type === 'browse' ? 'General Browsing' : 'Study Session'),
                session_type: session_type || 'study'
            };

            const session = await sessionModel.createSession(sessionData);

            if (!session) {
                return res.status(500).json({
                    error: 'Failed to create session',
                    success: false
                });
            }

            // Update document analytics only if document_id is provided
            if (document_id) {
                try {
                    await documentModel.incrementAnalytics(document_id, 'study_sessions');
                } catch (docError) {
                    console.warn('⚠️ Failed to update document analytics:', docError);
                    // Don't fail the session creation if document analytics update fails
                }
            }

            console.log('📚 Study session started:', session.id, `Type: ${session_type}`, document_id ? `Doc: ${document_id}` : 'General');

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

            const session = await sessionModel.endSession(session_id);

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

            if (!question) {
                return res.status(400).json({
                    error: 'Question is required',
                    success: false
                });
            }

            const attemptData = {
                user_id: userId,
                document_id: document_id || null,
                type: 'flashcard',
                question,
                answer,
                correct: correct || false,
                response_time: response_time || 0
            };

            const attempt = await sessionModel.trackAttempt(attemptData);

            if (!attempt) {
                return res.status(500).json({
                    error: 'Failed to track attempt',
                    success: false
                });
            }

            // Update document analytics only if document_id is provided
            if (document_id) {
                try {
                    await documentModel.incrementAnalytics(document_id, 'flashcard_attempts');
                } catch (docError) {
                    console.warn('⚠️ Failed to update document analytics:', docError);
                }
            }

            console.log('🗂️ Flashcard attempt tracked:', attempt.id, correct ? '✅' : '❌');

            res.json({
                success: true,
                data: {
                    status: "tracked",
                    attempt_id: attempt.id,
                    correct: attempt.is_correct
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

            if (!question) {
                return res.status(400).json({
                    error: 'Question is required',
                    success: false
                });
            }

            const attemptData = {
                user_id: userId,
                document_id: document_id || null,
                type: 'quiz_question',
                question,
                answer,
                correct: correct || false,
                response_time: response_time || 0
            };

            const attempt = await sessionModel.trackAttempt(attemptData);

            if (!attempt) {
                return res.status(500).json({
                    error: 'Failed to track attempt',
                    success: false
                });
            }

            // Update document analytics only if document_id is provided
            if (document_id) {
                try {
                    await documentModel.incrementAnalytics(document_id, 'quiz_attempts');
                } catch (docError) {
                    console.warn('⚠️ Failed to update document analytics:', docError);
                }
            }

            console.log('❓ Quiz attempt tracked:', attempt.id, correct ? '✅' : '❌');

            res.json({
                success: true,
                data: {
                    status: "tracked",
                    quiz_attempt_id: attempt.id,
                    correct: attempt.is_correct
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
                time_taken,
                started_at
            } = req.body;
            const userId = req.user?.id || req.body.user_id || 'anonymous';

            if (score === undefined) {
                return res.status(400).json({
                    error: 'Score is required',
                    success: false
                });
            }

            const quizData = {
                user_id: userId,
                document_id: document_id || null,
                document_title: document_title || 'Quiz',
                score,
                total_questions,
                correct_answers,
                time_taken,
                started_at
            };

            const quiz = await sessionModel.trackQuizCompletion(quizData);

            if (!quiz) {
                return res.status(500).json({
                    error: 'Failed to track quiz completion',
                    success: false
                });
            }

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

            const progress = await sessionModel.getDocumentProgress(document_id, userId);

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
            const analytics = await sessionModel.getAnalytics(userId);

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