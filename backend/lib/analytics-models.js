// Analytics and Session Models for RAG System
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Document Model - Enhanced for analytics
class DocumentModel {
    constructor() {
        this.documents = new Map();
    }

    create(documentData) {
        const id = Date.now().toString();
        const document = {
            id,
            ...documentData,
            created_at: new Date().toISOString(),
            processed: false,
            analytics: {
                views: 0,
                study_sessions: 0,
                quiz_attempts: 0,
                flashcard_attempts: 0
            }
        };
        this.documents.set(id, document);
        return document;
    }

    findById(id) {
        return this.documents.get(id);
    }

    findAll() {
        return Array.from(this.documents.values());
    }

    update(id, updateData) {
        const document = this.documents.get(id);
        if (document) {
            const updatedDocument = { ...document, ...updateData };
            this.documents.set(id, updatedDocument);
            return updatedDocument;
        }
        return null;
    }

    delete(id) {
        return this.documents.delete(id);
    }

    // Mark document as processed with AI-generated content
    markAsProcessed(id, processedContent) {
        const document = this.documents.get(id);
        if (document) {
            const updatedDocument = {
                ...document,
                ...processedContent,
                processed: true
            };
            this.documents.set(id, updatedDocument);
            return updatedDocument;
        }
        return null;
    }

    // Increment document analytics
    incrementAnalytics(id, type) {
        const document = this.documents.get(id);
        if (document) {
            document.analytics[type] = (document.analytics[type] || 0) + 1;
            this.documents.set(id, document);
            return document;
        }
        return null;
    }
}

// Session Model for analytics
class SessionModel {
    constructor() {
        this.sessions = new Map();
        this.attempts = new Map();
        this.analytics = {
            totalStudyTime: 0,
            currentStreak: 0,
            longestStreak: 0,
            totalFlashcardsSeen: 0,
            totalFlashcardsMastered: 0,
            totalQuizzesCompleted: 0,
            studySessionsThisWeek: 0
        };
    }

    createSession(sessionData) {
        const id = `session-${Date.now()}`;
        const session = {
            id,
            user_id: sessionData.user_id || 'anonymous',
            document_id: sessionData.document_id,
            document_title: sessionData.document_title || 'Unknown Document',
            session_type: sessionData.session_type || 'study',
            started_at: new Date().toISOString(),
            status: 'active'
        };
        this.sessions.set(id, session);
        return session;
    }

    endSession(id) {
        const session = this.sessions.get(id);
        if (session) {
            const endTime = new Date();
            const startTime = new Date(session.started_at);
            const duration = Math.floor((endTime - startTime) / 1000); // duration in seconds

            session.status = 'ended';
            session.ended_at = endTime.toISOString();
            session.duration = duration;

            // Update analytics
            this.analytics.totalStudyTime += duration;
            this.analytics.studySessionsThisWeek += 1;

            this.sessions.set(id, session);
            return session;
        }
        return null;
    }

    trackAttempt(attemptData) {
        const id = `attempt-${Date.now()}`;
        const attempt = {
            id,
            user_id: attemptData.user_id || 'anonymous',
            document_id: attemptData.document_id,
            type: attemptData.type, // 'flashcard' or 'quiz'
            question: attemptData.question,
            answer: attemptData.answer,
            correct: attemptData.correct || false,
            response_time: attemptData.response_time || 0,
            created_at: new Date().toISOString()
        };

        // Update analytics based on attempt type
        if (attempt.type === 'flashcard') {
            this.analytics.totalFlashcardsSeen += 1;
            if (attempt.correct) {
                this.analytics.totalFlashcardsMastered += 1;
            }
        } else if (attempt.type === 'quiz') {
            // Quiz completion tracking will be handled separately
        }

        this.attempts.set(id, attempt);
        return attempt;
    }

    trackQuizCompletion(quizData) {
        const id = `quiz-${Date.now()}`;
        const quiz = {
            id,
            user_id: quizData.user_id || 'anonymous',
            document_id: quizData.document_id,
            document_title: quizData.document_title || 'Unknown Document',
            score: quizData.score || 0,
            total_questions: quizData.total_questions || 0,
            correct_answers: quizData.correct_answers || 0,
            time_taken: quizData.time_taken || 0,
            completed_at: new Date().toISOString()
        };

        this.analytics.totalQuizzesCompleted += 1;
        this.attempts.set(id, quiz);
        return quiz;
    }

    getAnalytics(userId = 'anonymous') {
        // Get recent sessions for chart data
        const recentSessions = Array.from(this.sessions.values())
            .filter(s => s.user_id === userId && s.status === 'ended')
            .sort((a, b) => new Date(b.ended_at) - new Date(a.ended_at))
            .slice(0, 7);

        // Get flashcard performance by document
        const flashcardAttempts = Array.from(this.attempts.values())
            .filter(a => a.user_id === userId && a.type === 'flashcard');

        const flashcardPerformance = {};
        flashcardAttempts.forEach(attempt => {
            const docId = attempt.document_id;
            if (!flashcardPerformance[docId]) {
                flashcardPerformance[docId] = {
                    document_title: 'Unknown Document',
                    correct: 0,
                    total: 0
                };
            }
            flashcardPerformance[docId].total += 1;
            if (attempt.correct) {
                flashcardPerformance[docId].correct += 1;
            }
        });

        // Get quiz performance
        const quizResults = Array.from(this.attempts.values())
            .filter(a => a.user_id === userId && a.score !== undefined)
            .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
            .slice(0, 5);

        // Calculate averages
        const avgQuizScore = quizResults.length > 0
            ? quizResults.reduce((sum, quiz) => sum + quiz.score, 0) / quizResults.length
            : 0;

        const flashcardAccuracy = this.analytics.totalFlashcardsSeen > 0
            ? (this.analytics.totalFlashcardsMastered / this.analytics.totalFlashcardsSeen) * 100
            : 0;

        return {
            overall_analytics: {
                total_study_time: this.analytics.totalStudyTime,
                current_streak: this.analytics.currentStreak,
                longest_streak: this.analytics.longestStreak,
                total_flashcards_seen: this.analytics.totalFlashcardsSeen,
                total_flashcards_mastered: this.analytics.totalFlashcardsMastered,
                flashcard_accuracy_overall: Math.round(flashcardAccuracy * 100) / 100,
                total_quizzes_completed: this.analytics.totalQuizzesCompleted,
                average_quiz_score_overall: Math.round(avgQuizScore * 100) / 100,
                study_sessions_this_week_count: this.analytics.studySessionsThisWeek
            },
            study_sessions_chart_data: this.generateSessionChartData(recentSessions),
            flashcard_performance_chart_data: this.generateFlashcardChartData(flashcardPerformance),
            quiz_performance_chart_data: this.generateQuizChartData(quizResults)
        };
    }

    generateSessionChartData(sessions) {
        const chartData = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const daySessions = sessions.filter(s =>
                s.ended_at && s.ended_at.startsWith(dateStr)
            );

            const totalDuration = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);

            chartData.push({
                date: dateStr,
                duration: Math.round(totalDuration / 60), // Convert to minutes
                sessions: daySessions.length
            });
        }

        return chartData;
    }

    generateFlashcardChartData(performance) {
        return Object.entries(performance).map(([docId, data]) => ({
            document_title: data.document_title,
            accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100 * 100) / 100 : 0,
            attempts: data.total
        }));
    }

    generateQuizChartData(quizResults) {
        return quizResults.map(quiz => ({
            date: quiz.completed_at.split('T')[0],
            score: quiz.score,
            quiz_title: quiz.document_title
        }));
    }

    // Get user progress for a specific document
    getDocumentProgress(documentId, userId = 'anonymous') {
        const documentSessions = Array.from(this.sessions.values())
            .filter(s => s.user_id === userId && s.document_id === documentId);

        const flashcardAttempts = Array.from(this.attempts.values())
            .filter(a => a.user_id === userId && a.document_id === documentId && a.type === 'flashcard');

        const quizAttempts = Array.from(this.attempts.values())
            .filter(a => a.user_id === userId && a.document_id === documentId && a.score !== undefined);

        return {
            total_study_time: documentSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
            study_sessions: documentSessions.length,
            flashcard_attempts: flashcardAttempts.length,
            flashcard_accuracy: flashcardAttempts.length > 0
                ? (flashcardAttempts.filter(a => a.correct).length / flashcardAttempts.length) * 100
                : 0,
            quiz_attempts: quizAttempts.length,
            best_quiz_score: quizAttempts.length > 0
                ? Math.max(...quizAttempts.map(q => q.score))
                : 0,
            latest_activity: documentSessions.length > 0
                ? documentSessions.sort((a, b) => new Date(b.started_at) - new Date(a.started_at))[0].started_at
                : null
        };
    }
}

// Create singleton instances
const documentModel = new DocumentModel();
const sessionModel = new SessionModel();

export { documentModel, sessionModel }; 