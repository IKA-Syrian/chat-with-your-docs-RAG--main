// API client for connecting to the Express.js backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    
    // Try to get token from localStorage if we're on the client
    if (typeof window !== 'undefined') {
      this.loadTokenFromStorage();
    }
  }
  
  private loadTokenFromStorage() {
    try {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        this.token = storedToken;
        console.log('Token loaded from localStorage on init, length:', storedToken.length);
      }
    } catch (error) {
      console.error('Failed to load token from localStorage:', error);
    }
  }
  
  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      try {
        if (token) {
          localStorage.setItem('auth_token', token);
          console.log('✅ Token stored in localStorage, length:', token.length);
          
          // Store token in sessionStorage as backup
          sessionStorage.setItem('auth_token_backup', token);
          console.log('✅ Token backup stored in sessionStorage');
        } else {
          localStorage.removeItem('auth_token');
          sessionStorage.removeItem('auth_token_backup');
          console.log('🗑️ Token removed from localStorage and sessionStorage');
        }
      } catch (error) {
        console.error('Failed to access localStorage:', error);
      }
    }
  }

  getToken() {
    // Always check localStorage for the latest token on client side
    if (typeof window !== 'undefined') {
      try {
        console.log('🔍 getToken called - checking localStorage and sessionStorage');
        let storedToken = localStorage.getItem('auth_token');
        console.log('🔍 localStorage auth_token:', storedToken ? `found (${storedToken.length} chars)` : 'not found');
        
        // If token is missing from localStorage but exists in sessionStorage backup,
        // restore it from backup
        if (!storedToken) {
          const backupToken = sessionStorage.getItem('auth_token_backup');
          console.log('🔍 sessionStorage backup token:', backupToken ? `found (${backupToken.length} chars)` : 'not found');
          
          if (backupToken) {
            console.log('🔄 Restoring token from sessionStorage backup');
            localStorage.setItem('auth_token', backupToken);
            storedToken = backupToken;
          }
        }
        
        if (storedToken) {
          // Only update if different to avoid console spam
          if (storedToken !== this.token) {
            this.token = storedToken;
            console.log('📥 Token loaded from localStorage, length:', storedToken.length);
            console.log('📥 Token starts with:', storedToken.substring(0, 20) + '...');
          }
          return storedToken;
        } else if (this.token) {
          // Clear memory token if localStorage is empty
          console.log('🔄 LocalStorage empty, clearing memory token');
          this.token = null;
        }
      } catch (error) {
        console.error('Failed to access localStorage:', error);
      }
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
      const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add authorization header if token exists
    const token = this.getToken();
    if (token) {
      console.log(`🔒 Adding auth token to request ${endpoint} - token length: ${token.length}`);
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.log(`⚠️ No auth token available for request to ${endpoint}`);
    }

    const config: RequestInit = {
      ...options,
      headers,
    };    try {
      console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        
        console.log(`❌ API request failed: ${response.status} ${response.statusText} for ${endpoint}`);
        
        // Special handling for auth errors
        if (response.status === 401) {
          console.log('🔑 Authentication error:', errorData.error);
          
          if (errorData.error === 'Auth session missing!' || 
              errorData.error === 'Invalid token' || 
              errorData.error?.includes('JWT')) {
            console.log('🔄 Token appears invalid, will try to refresh on next attempt');
            // Don't clear token here - let auth provider handle it
            throw new Error('UNAUTHENTICATED');
          }
        }
        
        // Special handling for rate limiting errors
        if (response.status === 429) {
          console.log('⏰ Rate limiting error:', errorData.error);
          const retryAfterHeader = response.headers.get('Retry-After') || response.headers.get('RateLimit-Reset');
          const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader) : 900; // Default to 15 minutes
          const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
          
          // Check if it's an authentication rate limit
          if (endpoint.includes('/auth/')) {
            throw new Error(`Too many sign-in attempts. Please wait ${retryAfterMinutes} minutes before trying again.`);
          } else {
            throw new Error(`Too many requests. Please wait ${retryAfterMinutes} minutes before trying again.`);
          }
        }
        
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      console.log(`✅ API request successful: ${options.method || 'GET'} ${endpoint}`);
      return await response.json();
    } catch (error) {
      // Convert fetch network errors to a more friendly format
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error during API request:', error);
        throw new Error('NETWORK_ERROR');
      }
      throw error;
    }
  }

  // Authentication methods
  async signIn(email: string, password: string) {
    const response = await this.request<{
      user: any;
      session: { access_token: string };
    }>('/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Set token for future requests
    if (response.session?.access_token) {
      this.setToken(response.session.access_token);
    }

    return response;
  }

  async signUp(email: string, password: string) {
    const response = await this.request<{
      user: any;
      session: { access_token: string };
    }>('/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Set token for future requests
    if (response.session?.access_token) {
      this.setToken(response.session.access_token);
    }

    return response;
  }

  async signOut() {
    const response = await this.request('/auth/sign-out', {
      method: 'POST',
    });

    // Clear token
    this.setToken(null);

    return response;
  }  async getCurrentUser() {
    console.log('🔍 Attempting to get current user with token...');
    try {
      const result = await this.request<{ user: any }>('/auth/user');
      console.log('✅ getCurrentUser successful');
      return result;
    } catch (error) {
      console.log('❌ getCurrentUser failed:', error);
      
      // Only treat specific error messages as authentication failures
      if (error instanceof Error) {
        if (error.message.includes('No authorization token provided')) {
          console.log('🔑 No token provided - this is expected for unauthenticated users');
          throw new Error('UNAUTHENTICATED');
        } else if (error.message.includes('Auth session missing')) {
          console.log('🔑 Auth session missing - token may be invalid');
          throw new Error('UNAUTHENTICATED');
        } else if (error.message.includes('HTTP 401')) {
          console.log('🔑 401 Unauthorized - token may be expired');
          throw new Error('UNAUTHENTICATED');
        } else {
          console.log('🌐 Network or server error - keeping token');
          throw new Error('NETWORK_ERROR');
        }
      }
      throw error;
    }
  }// Clear authentication state
  clearAuth() {
    console.log('🧹 Explicitly clearing authentication state');
    this.setToken(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('auth_token');
        // Also clear any Supabase session data that might interfere
        const supabaseSessionKey = Object.keys(localStorage).find(key => 
          key.startsWith('sb-') && key.includes('auth-token')
        );
        if (supabaseSessionKey) {
          localStorage.removeItem(supabaseSessionKey);
          console.log('🧹 Also cleared Supabase session data');
        }
      } catch (error) {
        console.error('Failed to clear localStorage:', error);
      }
    }
  }
  // Test connection methods
  async testConnection() {
    return this.request<{ status: string; message: string }>('/test/health');
  }

  async validateToken() {
    return this.request<{ valid: boolean; error?: string; userId?: string }>('/test/validate-token');
  }

  // Document methods
  async getDocuments() {
    return this.request<{ documents: any[] }>('/documents');
  }  async uploadDocument(file: File): Promise<any> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const formData = new FormData();
    formData.append('file', file);

    console.log('📤 Starting document upload process...');
    console.log('📄 File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Try local upload first (stores in public folder)
    try {
      console.log('📤 Attempting local file upload...');
      const localUploadUrl = `${API_BASE_URL}/documents/upload-local`;
      
      const localResponse = await fetch(localUploadUrl, {
        method: 'POST',
        headers: {
      'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (localResponse.ok) {
        const data = await localResponse.json();
        console.log('✅ Local upload successful!');
        return data;
      } else {
        const errorText = await localResponse.text();
        console.log('⚠️ Local upload failed:', localResponse.status, errorText);
      }
    } catch (error) {
      console.error('⚠️ Local upload error:', error);
    }

    // Try RPC upload first (to avoid trigger issues)
    try {
      console.log('📤 Attempting RPC upload to avoid trigger issues...');
      const rpcUploadUrl = `${API_BASE_URL}/documents/upload-rpc`;
      
      const rpcResponse = await fetch(rpcUploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      console.log('📤 RPC upload response status:', rpcResponse.status);

      if (rpcResponse.ok) {
        const result = await rpcResponse.json();
        console.log('✅ RPC upload successful:', result);
        return result;
      } else {
        let errorText;
        try {
          const errorData = await rpcResponse.json();
          errorText = errorData.error || JSON.stringify(errorData);
        } catch (e) {
          errorText = await rpcResponse.text();
        }
        console.log('⚠️ RPC upload failed:', rpcResponse.status, errorText);
        console.log('⚠️ Falling back to standard upload...');
      }
    } catch (rpcError) {
      console.log('⚠️ RPC upload error:', rpcError);
      console.log('⚠️ Falling back to standard upload...');
    }

    // For large files, use the regular upload endpoint (stores in Supabase Storage)
    console.log('📤 Attempting standard upload to Supabase Storage...');
    const uploadUrl = `${API_BASE_URL}/documents/upload`;
    
    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      console.log('📤 Upload response status:', response.status);
      console.log('📤 Upload response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Upload successful:', result);
        return result;
      } else {
        let errorData;
        try {
          errorData = await response.json();
        console.error('❌ Upload failed:', response.status, errorData);
        } catch (jsonError) {
          errorData = { error: 'Upload failed' };
          console.error('❌ Upload failed with non-JSON response:', response.status);
          const errorText = await response.text().catch(() => 'Could not read response text');
          console.error('❌ Response text:', errorText);
        }
        
        if (response.status === 401) {
          console.log('🔑 Upload failed due to authentication - token may be invalid');
          throw new Error('Authentication failed - please login again');
        }
        
        // If storage upload fails, try simple upload as fallback
        if (errorData.error && errorData.error.includes('Storage upload failed')) {
          console.log('⚠️ Storage upload failed, trying simple upload as fallback...');
          
          const simpleUploadUrl = `${API_BASE_URL}/documents/upload-simple`;
          const simpleResponse = await fetch(simpleUploadUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData,
          });

          if (simpleResponse.ok) {
            const result = await simpleResponse.json();
            console.log('✅ Simple upload successful (fallback):', result);
      return result;
          }
        }
        
        // Include more details in the error message
        const errorMessage = errorData.error || `HTTP ${response.status}`;
        console.error('💥 Detailed error:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('💥 Upload error:', error);
      throw error;
    }
  }

  async getDocument(id: string) {
    return this.request<{ document: any }>(`/documents/${id}`);
  }

  async deleteDocument(id: string) {
    return this.request<{ message: string }>(`/documents/${id}`, {
      method: 'DELETE',
    });
  }

  // Processing methods
  async processDocument(documentId: string) {
    return this.request<{
      message: string;
      sections: any[];
      sectionsCount: number;
    }>('/process', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId }),
    });
  }

  // Embedding methods
  async createEmbeddings(data: {
    ids: string[];
    table: string;
    contentColumn: string;
    embeddingColumn: string;
  }) {
    return this.request<{
      message: string;
      results: any[];
      processed: number;
      successful: number;
    }>('/embed', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Chat methods
  async chat(
    message: string,
    conversationId?: string,
    documentId?: string,
    provider?: string,
    model?: string,
    explainMode?: 'default' | 'eli5' | 'student' | 'professor',
    documentIds?: string[]
  ) {
    const body: any = {
      message,
      history: []
    };

    if (conversationId) body.conversation_id = conversationId;
    if (Array.isArray(documentIds) && documentIds.length > 0) {
      body.document_ids = documentIds.slice(0, 10);
    } else if (documentId) {
      body.document_id = documentId;
    }
    if (provider) body.provider = provider;
    if (model) body.model = model;
    if (explainMode && explainMode !== 'default') body.explain_mode = explainMode;

    return this.request<any>('/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getAIProviders() {
    return this.request<{ providers: Array<{ 
      id: string; 
      name: string; 
      enabled: boolean;
      models?: {
        primary: string;
        alternatives: string[];
      };
    }> }>('/chat/providers');
  }

  async getConversation(id: string) {
    return this.request<{
      conversation_id: string;
      messages: any[];
      created_at: string;
    }>(`/chat/conversations/${id}`);
  }
  
  async getConversationsByDocument(documentId: string) {
    return this.request<{
      conversations: {
        id: string;
        title: string;
        document_id: string;
        document_name: string;
        created_at: string;
        last_message_at: string;
      }[];
    }>(`/chat/conversations?document_id=${documentId}`);
  }

  // Analytics methods
  async getAnalytics() {
    return this.request<{
      overall_analytics: {
        total_study_time: number;
        current_streak: number;
        longest_streak: number;
        total_flashcards_seen: number;
        total_flashcards_mastered: number;
        flashcard_accuracy_overall: number;
        total_quizzes_completed: number;
        average_quiz_score_overall: number;
        study_sessions_this_week_count: number;
      };
      study_sessions_chart_data: Array<{
        date: string;
        duration: number;
        sessions: number;
      }>;
      flashcard_performance_chart_data: Array<{
        document_title: string;
        accuracy: number;
        attempts: number;
      }>;
      quiz_performance_chart_data: Array<{
        date: string;
        score: number;
        quiz_title: string;
      }>;
    }>('/analytics/pagedata');
  }

  // Enhanced processing methods for educational content
  async generateEducationalContent(documentId: string, provider?: string, model?: string) {
    const body: any = { document_id: documentId };
    
    if (provider) {
      body.provider = provider;
    }
    
    if (model) {
      body.model = model;
    }
    
    return this.request<{
      message?: string;
      summary?: any;
      flashcards?: any[];
      quiz?: any;
      generated_at?: string;
    }>('/enhanced-processing/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Get document details
  async getDocumentDetail(documentId: string) {
    // Use the enhanced processing endpoint that returns educational content
    return this.request<{
      document: {
        id: string;
        name: string;
        created_at: string;
        summary?: any;
        flashcards?: any[];
        quiz?: any;
        educational_content_generated?: string;
      };
    }>(`/enhanced-processing/documents/${documentId}`, {
      method: 'GET',
    });
  }

  // ----- Phase 3 #15: URL / YouTube ingestion -----
  async ingestFromUrl(url: string, title?: string) {
    return this.request<{
      id: string;
      name: string;
      source: 'web' | 'youtube';
      url: string;
      text_length: number;
      preview: string;
    }>('/documents/from-url', {
      method: 'POST',
      body: JSON.stringify({ url, title })
    });
  }

  // ----- Phase 2 #6: spaced repetition (FSRS) -----
  async getDueFlashcards(opts: { documentId?: string; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (opts.documentId) qs.set('document_id', opts.documentId);
    if (opts.limit) qs.set('limit', String(opts.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return this.request<{
      cards: Array<{
        id: string;
        document_id: string;
        front: string;
        back: string;
        card_index: number | null;
        review: null | {
          due_at: string;
          stability: number;
          difficulty: number;
          reps: number;
          lapses: number;
          state: number;
          last_review: string | null;
          last_rating: number | null;
        };
      }>;
      ratings: { AGAIN: 1; HARD: 2; GOOD: 3; EASY: 4 };
    }>(`/flashcards/due${suffix}`);
  }

  async reviewFlashcard(flashcardId: string, rating: 1 | 2 | 3 | 4) {
    return this.request<{ review: any }>(`/flashcards/${flashcardId}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating })
    });
  }

  async getFlashcardStats() {
    return this.request<{ due_now: number; reviewed_today: number; total_cards: number }>(
      '/flashcards/stats'
    );
  }

  // ----- Phase 3 #7: short-answer grading -----
  async gradeShortAnswer(flashcardId: string, userAnswer: string) {
    return this.request<{
      score: number;
      rating_suggested: 1 | 2 | 3 | 4;
      feedback: string;
      matched_keywords: string[];
      missing_keywords: string[];
    }>(`/flashcards/${flashcardId}/grade-answer`, {
      method: 'POST',
      body: JSON.stringify({ user_answer: userAnswer })
    });
  }

  // ----- Phase 3 #9: mistake journal -----
  async getMistakes(opts: { documentId?: string; includeResolved?: boolean; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (opts.documentId) qs.set('document_id', opts.documentId);
    if (opts.includeResolved) qs.set('include_resolved', 'true');
    if (opts.limit) qs.set('limit', String(opts.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return this.request<{
      total: number;
      unresolved: number;
      mistakes: Array<{
        id: string;
        source_kind: 'quiz' | 'flashcard' | 'short_answer';
        question: string;
        user_answer: string | null;
        expected_answer: string | null;
        source_chunk_excerpt: string | null;
        document_id: string | null;
        document_name: string | null;
        ai_explanation: string | null;
        details: any;
        created_at: string;
        resolved: boolean;
      }>;
    }>(`/mistakes${suffix}`);
  }

  async resolveMistake(id: string, resolved: boolean = true) {
    return this.request<{ success: boolean }>(`/mistakes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ resolved })
    });
  }

  async explainMistake(id: string) {
    return this.request<{ explanation: string }>(`/mistakes/${id}/explain`, {
      method: 'POST'
    });
  }

  // Health check
  async healthCheck() {
    return this.request<{
      status: string;
      timestamp: string;
      uptime: number;
    }>('/health', {
      method: 'GET',
    });
  }

  // Get quiz questions without correct answers (secure)
  async getQuizQuestions(documentId: string): Promise<any> {
    return this.request<any>(`/enhanced-processing/quiz/${documentId}`, {
      method: 'GET',
    });
  }

  // Submit quiz answers and get results
  async submitQuizAnswers(documentId: string, answers: Array<{questionId: number, selectedOption: number}>, startTime?: string, endTime?: string): Promise<any> {
    return this.request<any>(`/enhanced-processing/quiz/${documentId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        answers,
        start_time: startTime,
        end_time: endTime
      }),
    });
  }

  // Session tracking methods
  async startStudySession(data: {
    activity_type: string;
    document_id?: string;
    started_at: string;
  }): Promise<any> {
    const requestBody: any = {
      session_type: data.activity_type,
    };

    // Only include document_id and document_title if document_id is provided
    if (data.document_id) {
      requestBody.document_id = data.document_id;
      requestBody.document_title = `Document ${data.document_id}`;
    }

    return this.request('/analytics/session/start', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  }

  async endStudySession(data: {
    session_id: string;
    ended_at: string;
    duration_seconds: number;
    end_reason?: string;
  }): Promise<any> {
    return this.request(`/analytics/session/${data.session_id}/end`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async trackFlashcardAttempt(data: {
    document_id?: string;
    correct: boolean;
    flashcard_id?: string;
    attempt_time: string;
  }): Promise<any> {
    const requestBody: any = {
      question: data.flashcard_id || 'Flashcard',
      answer: data.correct ? 'correct' : 'incorrect',
      correct: data.correct,
      response_time: 0,
    };

    // Only include document_id if provided
    if (data.document_id) {
      requestBody.document_id = data.document_id;
    }

    return this.request('/analytics/flashcard/attempt', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  }

  async trackQuizAttempt(data: {
    document_id?: string;
    question_id: string;
    correct: boolean;
    time_spent_seconds?: number;
    attempt_time: string;
  }): Promise<any> {
    const requestBody: any = {
      question: `Question ${data.question_id}`,
      answer: data.correct ? 'correct' : 'incorrect',
      correct: data.correct,
      response_time: data.time_spent_seconds || 0,
    };

    // Only include document_id if provided
    if (data.document_id) {
      requestBody.document_id = data.document_id;
    }

    return this.request('/analytics/quiz/attempt', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  }

  async trackQuizCompletion(data: {
    document_id?: string;
    score_percentage: number;
    total_questions: number;
    time_spent_seconds: number;
    completed_at: string;
  }): Promise<any> {
    const requestBody: any = {
      score: data.score_percentage,
      total_questions: data.total_questions,
      correct_answers: Math.round((data.score_percentage / 100) * data.total_questions),
      time_taken: data.time_spent_seconds,
      started_at: new Date(Date.now() - data.time_spent_seconds * 1000).toISOString(),
    };

    // Only include document info if document_id is provided
    if (data.document_id) {
      requestBody.document_id = data.document_id;
      requestBody.document_title = `Document ${data.document_id}`;
    }

    return this.request('/analytics/quiz/completion', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  }
}

// Create a singleton instance
export const apiClient = new ApiClient();

// Export the class for creating new instances if needed
export default ApiClient;
