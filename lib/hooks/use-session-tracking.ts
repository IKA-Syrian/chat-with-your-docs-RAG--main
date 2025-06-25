'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/api/auth';

export type ActivityType = 'chat' | 'study' | 'flashcard' | 'quiz' | 'browse';

interface SessionData {
  sessionId: string | null;
  isActive: boolean;
  startTime: Date | null;
  lastActivity: Date | null;
  currentActivity: ActivityType | null;
  documentId: string | null;
}

interface UseSessionTrackingOptions {
  activityType?: ActivityType;
  documentId?: string;
  autoStart?: boolean;
}

export function useSessionTracking(options: UseSessionTrackingOptions = {}) {
  const { isAuthenticated } = useAuth();
  const [sessionData, setSessionData] = useState<SessionData>({
    sessionId: null,
    isActive: false,
    startTime: null,
    lastActivity: null,
    currentActivity: null,
    documentId: null,
  });

  const activityTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<Date>();

  // Configuration
  const ACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes of inactivity
  const HEARTBEAT_INTERVAL = 30 * 1000; // Send heartbeat every 30 seconds
  const MIN_SESSION_DURATION = 10 * 1000; // Minimum 10 seconds to count as session

  // Start a new session
  const startSession = useCallback(async (activityType: ActivityType, documentId?: string) => {
    if (!isAuthenticated || sessionData.isActive) return;

    try {
      console.log('Starting session:', { activityType, documentId });
      
      const response = await apiClient.startStudySession({
        activity_type: activityType,
        document_id: documentId,
        started_at: new Date().toISOString(),
      });

      const newSessionData = {
        sessionId: response.data?.id || response.id || `session_${Date.now()}`,
        isActive: true,
        startTime: new Date(),
        lastActivity: new Date(),
        currentActivity: activityType,
        documentId: documentId || null,
      };

      setSessionData(newSessionData);
      lastActivityRef.current = new Date();

      // Start heartbeat to keep session alive
      startHeartbeat();

      console.log('Session started:', newSessionData);
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  }, [isAuthenticated, sessionData.isActive]);

  // End current session
  const endSession = useCallback(async (reason: string = 'manual') => {
    if (!sessionData.isActive || !sessionData.sessionId || !sessionData.startTime) return;

    const duration = Math.floor((Date.now() - sessionData.startTime.getTime()) / 1000);
    
    // Only record sessions longer than minimum duration
    if (duration < MIN_SESSION_DURATION / 1000) {
      console.log('Session too short, not recording:', duration);
      setSessionData(prev => ({ ...prev, isActive: false, sessionId: null }));
      return;
    }

    try {
      console.log('Ending session:', { sessionId: sessionData.sessionId, duration, reason });

      await apiClient.endStudySession({
        session_id: sessionData.sessionId,
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
        end_reason: reason,
      });

      console.log('Session ended successfully');
    } catch (error) {
      console.error('Failed to end session:', error);
    } finally {
      // Clear local session data
      setSessionData({
        sessionId: null,
        isActive: false,
        startTime: null,
        lastActivity: null,
        currentActivity: null,
        documentId: null,
      });

      // Clear intervals
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    }
  }, [sessionData]);

  // Record user activity
  const recordActivity = useCallback((activityType?: ActivityType, data?: any) => {
    if (!sessionData.isActive) {
      // Auto-start session if needed
      if (options.autoStart !== false) {
        startSession(activityType || options.activityType || 'browse', options.documentId);
      }
      return;
    }

    const now = new Date();
    lastActivityRef.current = now;
    
    setSessionData(prev => ({
      ...prev,
      lastActivity: now,
      currentActivity: activityType || prev.currentActivity,
    }));

    // Reset inactivity timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    
    activityTimeoutRef.current = setTimeout(() => {
      console.log('Session timed out due to inactivity');
      endSession('timeout');
    }, ACTIVITY_TIMEOUT);

    console.log('Activity recorded:', { activityType, sessionActive: sessionData.isActive });
  }, [sessionData.isActive, startSession, endSession, options]);

  // Start heartbeat interval
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (sessionData.isActive && lastActivityRef.current) {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current.getTime();
        
        // If too much time has passed without activity, end session
        if (timeSinceLastActivity > ACTIVITY_TIMEOUT) {
          console.log('Heartbeat detected inactivity, ending session');
          endSession('inactivity');
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, [sessionData.isActive, endSession]);

  // Track specific activities with backend
  const trackFlashcardAttempt = useCallback(async (correct: boolean, flashcardId?: string) => {
    if (!sessionData.isActive) return;

    try {
      await apiClient.trackFlashcardAttempt({
        document_id: sessionData.documentId || undefined,
        correct,
        flashcard_id: flashcardId,
        attempt_time: new Date().toISOString(),
      });
      recordActivity('flashcard');
    } catch (error) {
      console.error('Failed to track flashcard attempt:', error);
    }
  }, [sessionData.isActive, sessionData.documentId, recordActivity]);

  const trackQuizAttempt = useCallback(async (questionId: string, correct: boolean, timeSpent?: number) => {
    if (!sessionData.isActive) return;

    try {
      await apiClient.trackQuizAttempt({
        document_id: sessionData.documentId || undefined,
        question_id: questionId,
        correct,
        time_spent_seconds: timeSpent,
        attempt_time: new Date().toISOString(),
      });
      recordActivity('quiz');
    } catch (error) {
      console.error('Failed to track quiz attempt:', error);
    }
  }, [sessionData.isActive, sessionData.documentId, recordActivity]);

  const trackQuizCompletion = useCallback(async (score: number, totalQuestions: number, timeSpent: number) => {
    if (!sessionData.isActive) return;

    try {
      await apiClient.trackQuizCompletion({
        document_id: sessionData.documentId || undefined,
        score_percentage: score,
        total_questions: totalQuestions,
        time_spent_seconds: timeSpent,
        completed_at: new Date().toISOString(),
      });
      recordActivity('quiz');
    } catch (error) {
      console.error('Failed to track quiz completion:', error);
    }
  }, [sessionData.isActive, sessionData.documentId, recordActivity]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Page hidden, ending session');
        endSession('page_hidden');
      } else if (sessionData.isActive) {
        recordActivity();
      }
    };

    const handleBeforeUnload = () => {
      if (sessionData.isActive) {
        endSession('page_unload');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionData.isActive, endSession, recordActivity]);

  // Auto-start session if configured
  useEffect(() => {
    if (isAuthenticated && options.autoStart !== false && !sessionData.isActive) {
      const activityType = options.activityType || 'browse';
      startSession(activityType, options.documentId);
    }
  }, [isAuthenticated, options.autoStart, options.activityType, options.documentId, sessionData.isActive, startSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionData.isActive) {
        endSession('component_unmount');
      }
    };
  }, []);

  return {
    sessionData,
    startSession,
    endSession,
    recordActivity,
    trackFlashcardAttempt,
    trackQuizAttempt,
    trackQuizCompletion,
    isActive: sessionData.isActive,
  };
} 