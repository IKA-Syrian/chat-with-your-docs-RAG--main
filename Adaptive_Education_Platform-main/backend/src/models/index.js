// Document Model - In-memory storage for development
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
            processed: false
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
}

// Session Model for analytics
class SessionModel {
    constructor() {
        this.sessions = new Map();
        this.attempts = new Map();
    }

    createSession(sessionData) {
        const id = `session-${Date.now()}`;
        const session = {
            id,
            ...sessionData,
            created_at: new Date().toISOString(),
            status: 'active'
        };
        this.sessions.set(id, session);
        return session;
    }

    endSession(id) {
        const session = this.sessions.get(id);
        if (session) {
            session.status = 'ended';
            session.ended_at = new Date().toISOString();
            this.sessions.set(id, session);
            return session;
        }
        return null;
    }

    trackAttempt(attemptData) {
        const id = `attempt-${Date.now()}`;
        const attempt = {
            id,
            ...attemptData,
            created_at: new Date().toISOString()
        };
        this.attempts.set(id, attempt);
        return attempt;
    }

    getAnalytics() {
        // Return mock analytics data for development
        return {
            overall_analytics: {
                total_study_time: 3600,
                current_streak: 3,
                longest_streak: 5,
                total_flashcards_seen: 50,
                total_flashcards_mastered: 30,
                flashcard_accuracy_overall: 75.0,
                total_quizzes_completed: 10,
                average_quiz_score_overall: 85.0,
                study_sessions_this_week_count: 5
            },
            study_sessions_chart_data: [
                { date: "2025-06-06", duration: 30, sessions: 1 },
                { date: "2025-06-07", duration: 45, sessions: 2 },
                { date: "2025-06-08", duration: 60, sessions: 2 },
                { date: "2025-06-09", duration: 30, sessions: 1 },
                { date: "2025-06-10", duration: 90, sessions: 3 },
                { date: "2025-06-11", duration: 60, sessions: 2 },
                { date: "2025-06-12", duration: 45, sessions: 2 }
            ],
            flashcard_performance_chart_data: [
                { document_title: "Introduction to AI", accuracy: 85.0, attempts: 20 },
                { document_title: "Machine Learning Basics", accuracy: 75.0, attempts: 15 },
                { document_title: "Neural Networks", accuracy: 70.0, attempts: 10 }
            ],
            quiz_performance_chart_data: [
                { date: "2025-06-01", score: 75.0, quiz_title: "AI Quiz 1" },
                { date: "2025-06-03", score: 80.0, quiz_title: "ML Quiz" },
                { date: "2025-06-06", score: 85.0, quiz_title: "NN Quiz" },
                { date: "2025-06-09", score: 90.0, quiz_title: "AI Quiz 2" },
                { date: "2025-06-12", score: 95.0, quiz_title: "Final Quiz" }
            ]
        };
    }
}

// Create singleton instances
const documentModel = new DocumentModel();
const sessionModel = new SessionModel();

export { documentModel, sessionModel };
