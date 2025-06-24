# Enhanced Educational Features for RAG System

This document describes the new educational features integrated from the Adaptive Education Platform that **complement** your existing RAG system.

## 🔄 Integration Overview

**Your existing RAG system** (`/api/process`, `/api/chat`, etc.) remains **fully functional** for:

-   Document upload and processing for chat/RAG
-   Vector embeddings and semantic search
-   Chat with documents functionality
-   Existing PDF processing with `pdf-parse`

**The enhanced educational features** add **new capabilities** for:

-   Quiz generation from documents
-   Flashcard creation
-   Summary generation with key points
-   Learning analytics and progress tracking

## 🎓 New Features Added

### 1. Educational Content Generation

-   **Quiz Generation**: Automatically generate multiple-choice quizzes from uploaded documents
-   **Flashcard Creation**: Create study flashcards with question-answer pairs
-   **Summary Generation**: Generate comprehensive summaries with key points
-   **All-in-One Processing**: Process PDFs to generate all educational content simultaneously

### 2. Analytics & Progress Tracking

-   **Study Session Tracking**: Monitor time spent studying each document
-   **Learning Analytics**: Track quiz scores, flashcard accuracy, and progress over time
-   **Performance Charts**: Visualize learning progress with interactive charts
-   **Document Analytics**: View study statistics per document

### 3. Enhanced PDF Processing

-   **Improved Text Extraction**: Uses pdfjs-dist for better PDF text extraction
-   **Metadata Extraction**: Extract PDF metadata (title, author, creation date)
-   **Fallback Processing**: Automatic fallback to pdf-parse if enhanced extraction fails
-   **File Validation**: Enhanced validation for PDF files

### 4. AI Service Integration

-   **OpenRouter Support**: Integration with OpenRouter API for advanced AI models
-   **Multiple AI Providers**: Support for OpenAI, Google AI, and OpenRouter
-   **Educational Prompts**: Specialized prompts for educational content generation

## 🚀 API Endpoints

### Analytics Endpoints

```
GET    /api/analytics/dashboard        - Get analytics dashboard data
POST   /api/analytics/session/start   - Start a study session
POST   /api/analytics/session/:id/end - End a study session
POST   /api/analytics/flashcard/attempt - Track flashcard attempt
POST   /api/analytics/quiz/attempt     - Track quiz attempt
POST   /api/analytics/quiz/completion  - Track quiz completion
GET    /api/analytics/document/:id/progress - Get document progress
GET    /api/analytics/user/stats       - Get user statistics
```

### Enhanced Processing Endpoints

```
POST   /api/enhanced/upload-pdf        - Upload and process PDF with educational content
POST   /api/enhanced/generate/summary  - Generate summary from text
POST   /api/enhanced/generate/quiz     - Generate quiz from text
POST   /api/enhanced/generate/flashcards - Generate flashcards from text
POST   /api/enhanced/generate/all      - Generate all educational content
GET    /api/enhanced/documents         - List processed documents
GET    /api/enhanced/document/:id      - Get document educational content
DELETE /api/enhanced/document/:id      - Delete document
```

## 🔧 Configuration

### Required Environment Variables

```env
# Enhanced AI Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_EDUCATION_MODEL=deepseek/deepseek-r1-distill-llama-70b:free

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/pdf

# Application Configuration
APP_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003
```

### New Dependencies Added

```json
{
    "axios": "^1.6.2",
    "express-validator": "^7.0.1",
    "pdfjs-dist": "^5.3.31"
}
```

## 📊 Data Models

### Study Session

```javascript
{
  id: "session-1234567890",
  user_id: "user-123",
  document_id: "doc-456",
  document_title: "AI Introduction",
  session_type: "study",
  started_at: "2024-01-01T10:00:00Z",
  ended_at: "2024-01-01T11:30:00Z",
  duration: 5400,
  status: "ended"
}
```

### Learning Attempt

```javascript
{
  id: "attempt-1234567890",
  user_id: "user-123",
  document_id: "doc-456",
  type: "flashcard", // or "quiz"
  question: "What is artificial intelligence?",
  answer: "User's answer",
  correct: true,
  response_time: 15000,
  created_at: "2024-01-01T10:15:00Z"
}
```

### Educational Content

```javascript
{
  summary: {
    summary: "Comprehensive summary text...",
    key_points: ["Point 1", "Point 2", "Point 3"]
  },
  quiz: {
    questions: [
      {
        question: "What is...?",
        options: ["A", "B", "C", "D"],
        correct_answer: 0,
        explanation: "Because..."
      }
    ]
  },
  flashcards: {
    flashcards: [
      {
        front: "Question or concept",
        back: "Answer or explanation"
      }
    ]
  }
}
```

## 🎯 Usage Examples

### Upload and Process PDF

```javascript
const formData = new FormData();
formData.append("file", pdfFile);

const response = await fetch("/api/enhanced/upload-pdf", {
    method: "POST",
    body: formData,
});

const result = await response.json();
// Returns: document_id, summary, quiz, flashcards
```

### Start Study Session

```javascript
const response = await fetch("/api/analytics/session/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        document_id: "doc-123",
        document_title: "AI Introduction",
        session_type: "study",
    }),
});

const session = await response.json();
// Returns: session_id, status, started_at
```

### Track Quiz Attempt

```javascript
const response = await fetch("/api/analytics/quiz/attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        document_id: "doc-123",
        question: "What is AI?",
        answer: "Artificial Intelligence",
        correct: true,
        response_time: 15000,
    }),
});
```

### Get Analytics Dashboard

```javascript
const response = await fetch("/api/analytics/dashboard");
const analytics = await response.json();

// Returns comprehensive analytics including:
// - overall_analytics: study time, streaks, accuracy
// - study_sessions_chart_data: daily session data
// - flashcard_performance_chart_data: accuracy by document
// - quiz_performance_chart_data: quiz scores over time
```

## 🔄 Integration with Existing RAG System

The enhanced features integrate seamlessly with your existing RAG system:

1. **Existing Routes Preserved**: All original API endpoints remain functional
2. **Enhanced Error Handling**: Improved error handling for all services
3. **Backward Compatibility**: Legacy endpoints maintained for smooth transition
4. **Shared Authentication**: Uses existing Supabase authentication system
5. **Consistent Response Format**: All new endpoints follow existing response patterns

## 🧪 Testing the Integration

1. **Install new dependencies**:

    ```bash
    npm install
    ```

2. **Update environment variables**:

    ```bash
    cp .env.example .env
    # Update with your OpenRouter API key
    ```

3. **Start the server**:

    ```bash
    npm run dev
    ```

4. **Test enhanced endpoints**:

    ```bash
    # Health check
    curl http://localhost:3001/health

    # Upload and process PDF
    curl -X POST http://localhost:3001/api/enhanced/upload-pdf \
      -F "file=@your-document.pdf"

    # Get analytics
    curl http://localhost:3001/api/analytics/dashboard
    ```

## 📈 Performance Considerations

-   **In-Memory Storage**: Current implementation uses in-memory storage for development
-   **Production Deployment**: Consider migrating to persistent storage for production
-   **AI Rate Limits**: OpenRouter has rate limits; implement queuing for high-volume usage
-   **File Size Limits**: Current limit is 10MB per PDF file
-   **Concurrent Processing**: Large PDFs may take time to process; consider background jobs

## 🔒 Security Features

-   **File Validation**: Validates PDF format and file size
-   **Input Sanitization**: All user inputs are validated
-   **Error Handling**: Comprehensive error handling prevents information leakage
-   **CORS Configuration**: Configurable CORS origins for security
-   **Authentication Integration**: Works with existing Supabase authentication

## 🚦 Next Steps

1. **Frontend Integration**: Update frontend components to use new endpoints
2. **Database Migration**: Move from in-memory to persistent storage
3. **Real-time Updates**: Consider adding WebSocket support for real-time analytics
4. **Advanced Analytics**: Add more sophisticated learning analytics
5. **Multi-language Support**: Extend AI prompts for multiple languages
