// Analytics and Session Models for RAG System - Database Version
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for server-side operations
);

// Document Model - Enhanced for analytics
class DocumentModel {
    constructor() {
        // No longer using in-memory storage
    }

    async create(documentData) {
        try {
            const { data, error } = await supabase
                .from('documents')
                .insert({
                    ...documentData,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating document:', error);
            return null;
        }
    }

    async findById(id) {
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error finding document:', error);
            return null;
        }
    }

    async findAll() {
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*');

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error finding documents:', error);
            return [];
        }
    }

    async update(id, updateData) {
        try {
            const { data, error } = await supabase
                .from('documents')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating document:', error);
            return null;
        }
    }

    async delete(id) {
        try {
            const { error } = await supabase
                .from('documents')
                .delete()
                .eq('id', id);

            return !error;
        } catch (error) {
            console.error('Error deleting document:', error);
            return false;
        }
    }

    // Mark document as processed with AI-generated content
    async markAsProcessed(id, processedContent) {
        return this.update(id, {
            ...processedContent,
            educational_content_generated: new Date().toISOString()
        });
    }

    // Increment document analytics (can be used for view counts, etc.)
    async incrementAnalytics(id, type) {
        // For now, we'll just log this - could extend documents table with analytics columns
        console.log(`📊 Analytics: ${type} incremented for document ${id}`);
        return true;
    }
}

// Session Model for analytics - Database Version
class SessionModel {
    constructor() {
        // No longer using in-memory storage
    }

    async createSession(sessionData) {
        try {
            const { data, error } = await supabase
                .from('study_sessions')
                .insert({
                    user_id: sessionData.user_id || 'anonymous',
                    document_id: sessionData.document_id,
                    document_title: sessionData.document_title || 'Unknown Document',
                    session_type: sessionData.session_type || 'study',
                    started_at: new Date().toISOString(),
                    status: 'active'
                })
                .select()
                .single();

            if (error) throw error;
            console.log('📚 Study session created:', data.id);
            return data;
        } catch (error) {
            console.error('Error creating session:', error);
            return null;
        }
    }

    async endSession(id) {
        try {
            const endTime = new Date();

            // Get the session to calculate duration
            const { data: session, error: fetchError } = await supabase
                .from('study_sessions')
                .select('started_at')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;

            const startTime = new Date(session.started_at);
            const duration = Math.floor((endTime - startTime) / 1000); // duration in seconds

            const { data, error } = await supabase
                .from('study_sessions')
                .update({
                    status: 'ended',
                    ended_at: endTime.toISOString(),
                    duration: duration
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            console.log('✅ Study session ended:', id, `Duration: ${duration}s`);
            return data;
        } catch (error) {
            console.error('Error ending session:', error);
            return null;
        }
    }

    async trackAttempt(attemptData) {
        try {
            const { data, error } = await supabase
                .from('learning_attempts')
                .insert({
                    user_id: attemptData.user_id || 'anonymous',
                    document_id: attemptData.document_id,
                    attempt_type: attemptData.type, // 'flashcard' or 'quiz_question'
                    question: attemptData.question,
                    user_answer: attemptData.answer,
                    correct_answer: attemptData.correct_answer,
                    is_correct: attemptData.correct || false,
                    response_time: attemptData.response_time || 0,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            console.log(`📝 ${attemptData.type} attempt tracked:`, data.id, attemptData.correct ? '✅' : '❌');
            return data;
        } catch (error) {
            console.error('Error tracking attempt:', error);
            return null;
        }
    }

    async trackQuizCompletion(quizData) {
        try {
            const { data, error } = await supabase
                .from('quiz_completions')
                .insert({
                    user_id: quizData.user_id || 'anonymous',
                    document_id: quizData.document_id,
                    document_title: quizData.document_title || 'Unknown Document',
                    total_questions: quizData.total_questions || 0,
                    correct_answers: quizData.correct_answers || 0,
                    score: quizData.score || 0,
                    time_taken: quizData.time_taken || 0,
                    started_at: quizData.started_at,
                    completed_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            console.log('🎯 Quiz completion tracked:', data.id, `Score: ${quizData.score}%`);
            return data;
        } catch (error) {
            console.error('Error tracking quiz completion:', error);
            return null;
        }
    }

    async getAnalytics(userId = 'anonymous') {
        try {
            // Use the database function for analytics summary
            const { data: overallData, error: overallError } = await supabase
                .rpc('get_analytics_summary', { p_user_id: userId });

            if (overallError) throw overallError;

            // Get chart data
            const [sessionChartData, flashcardChartData, quizChartData] = await Promise.all([
                this.generateSessionChartData(userId),
                this.generateFlashcardChartData(userId),
                this.generateQuizChartData(userId)
            ]);

            return {
                overall_analytics: overallData,
                study_sessions_chart_data: sessionChartData,
                flashcard_performance_chart_data: flashcardChartData,
                quiz_performance_chart_data: quizChartData
            };
        } catch (error) {
            console.error('Error getting analytics:', error);

            // Return default empty analytics
            return {
                overall_analytics: {
                    total_study_time: 0,
                    current_streak: 0,
                    longest_streak: 0,
                    total_flashcards_seen: 0,
                    total_flashcards_mastered: 0,
                    flashcard_accuracy_overall: 0,
                    total_quizzes_completed: 0,
                    average_quiz_score_overall: 0,
                    study_sessions_this_week_count: 0
                },
                study_sessions_chart_data: [],
                flashcard_performance_chart_data: [],
                quiz_performance_chart_data: []
            };
        }
    }

    async generateSessionChartData(userId) {
        try {
            const { data, error } = await supabase
                .from('study_sessions')
                .select('started_at, ended_at, duration')
                .eq('user_id', userId)
                .eq('status', 'ended')
                .gte('started_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
                .order('started_at', { ascending: false });

            if (error) throw error;

            const chartData = [];
            const today = new Date();

            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];

                const daySessions = data.filter(s =>
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
        } catch (error) {
            console.error('Error generating session chart data:', error);
            return [];
        }
    }

    async generateFlashcardChartData(userId) {
        try {
            // Get flashcard attempts first
            const { data: attempts, error: attemptsError } = await supabase
                .from('learning_attempts')
                .select('document_id, is_correct')
                .eq('user_id', userId)
                .eq('attempt_type', 'flashcard');

            if (attemptsError) throw attemptsError;

            if (!attempts || attempts.length === 0) {
                return [];
            }

            // Get unique document IDs and fetch document names
            const docIds = [...new Set(attempts.map(a => a.document_id))];

            // Try to fetch documents with both string and numeric ID matching
            let documents = [];
            try {
                // First try treating document_id as numeric
                const numericIds = docIds.map(id => {
                    const parsed = parseInt(id);
                    return isNaN(parsed) ? null : parsed;
                }).filter(id => id !== null);

                if (numericIds.length > 0) {
                    const { data: numericDocs, error: numericError } = await supabase
                        .from('documents')
                        .select('id, name')
                        .in('id', numericIds);

                    if (!numericError && numericDocs) {
                        documents = numericDocs;
                    }
                }

                // If no documents found, try string matching
                if (documents.length === 0) {
                    const { data: stringDocs, error: stringError } = await supabase
                        .from('documents')
                        .select('id, name')
                        .in('id', docIds);

                    if (!stringError && stringDocs) {
                        documents = stringDocs;
                    }
                }
            } catch (docError) {
                console.error('Error fetching documents:', docError);
            }

            // Create a map of document ID to name
            const docNameMap = {};
            documents.forEach(doc => {
                docNameMap[doc.id.toString()] = doc.name;
            });

            // Process performance data
            const performance = {};
            attempts.forEach(attempt => {
                const docId = attempt.document_id;
                const docName = docNameMap[docId] || 'Unknown Document';

                if (!performance[docId]) {
                    performance[docId] = {
                        document_title: docName,
                        correct: 0,
                        total: 0
                    };
                }
                performance[docId].total += 1;
                if (attempt.is_correct) {
                    performance[docId].correct += 1;
                }
            });

            return Object.entries(performance).map(([docId, data]) => ({
                document_title: data.document_title,
                accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100 * 100) / 100 : 0,
                attempts: data.total
            }));
        } catch (error) {
            console.error('Error generating flashcard chart data:', error);
            return [];
        }
    }

    async generateQuizChartData(userId) {
        try {
            const { data, error } = await supabase
                .from('quiz_completions')
                .select('completed_at, score, document_title')
                .eq('user_id', userId)
                .order('completed_at', { ascending: false })
                .limit(5);

            if (error) throw error;

            return data.map(quiz => ({
                date: quiz.completed_at.split('T')[0],
                score: parseFloat(quiz.score),
                quiz_title: quiz.document_title || 'Unknown Quiz'
            }));
        } catch (error) {
            console.error('Error generating quiz chart data:', error);
            return [];
        }
    }

    // Get user progress for a specific document
    async getDocumentProgress(documentId, userId = 'anonymous') {
        try {
            const [sessionResult, flashcardResult, quizResult] = await Promise.all([
                // Get study sessions
                supabase
                    .from('study_sessions')
                    .select('duration')
                    .eq('user_id', userId)
                    .eq('document_id', documentId)
                    .eq('status', 'ended'),

                // Get flashcard attempts
                supabase
                    .from('learning_attempts')
                    .select('is_correct')
                    .eq('user_id', userId)
                    .eq('document_id', documentId)
                    .eq('attempt_type', 'flashcard'),

                // Get quiz attempts
                supabase
                    .from('quiz_completions')
                    .select('score')
                    .eq('user_id', userId)
                    .eq('document_id', documentId)
            ]);

            const sessions = sessionResult.data || [];
            const flashcardAttempts = flashcardResult.data || [];
            const quizAttempts = quizResult.data || [];

            const totalStudyTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
            const flashcardAccuracy = flashcardAttempts.length > 0
                ? (flashcardAttempts.filter(a => a.is_correct).length / flashcardAttempts.length) * 100
                : 0;
            const bestQuizScore = quizAttempts.length > 0
                ? Math.max(...quizAttempts.map(q => parseFloat(q.score)))
                : 0;

            return {
                total_study_time: totalStudyTime,
                study_sessions: sessions.length,
                flashcard_attempts: flashcardAttempts.length,
                flashcard_accuracy: Math.round(flashcardAccuracy * 100) / 100,
                quiz_attempts: quizAttempts.length,
                best_quiz_score: bestQuizScore,
                latest_activity: sessions.length > 0 ? sessions[0].started_at : null
            };
        } catch (error) {
            console.error('Error getting document progress:', error);
            return {
                total_study_time: 0,
                study_sessions: 0,
                flashcard_attempts: 0,
                flashcard_accuracy: 0,
                quiz_attempts: 0,
                best_quiz_score: 0,
                latest_activity: null
            };
        }
    }
}

// Create singleton instances
const documentModel = new DocumentModel();
const sessionModel = new SessionModel();

export { documentModel, sessionModel }; 