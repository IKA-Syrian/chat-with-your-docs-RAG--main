# Swagger API Documentation Setup

## Overview

The Chat with Your Documents backend now includes comprehensive Swagger/OpenAPI documentation for all API endpoints. This provides an interactive interface to explore and test the API.

## 🚀 Quick Start

1. **Install Dependencies**

    ```bash
    npm install
    ```

2. **Start the Server**

    ```bash
    npm run dev
    # or
    npm start
    ```

3. **Access Documentation**
    - **Interactive UI**: http://localhost:3001/api-docs
    - **JSON Spec**: http://localhost:3001/api-docs.json

## 📚 What's Documented

### Complete API Coverage

-   **🔐 Authentication** (`/auth/*`)

    -   Sign in, sign up, sign out
    -   User profile management
    -   JWT token validation

-   **📄 Documents** (`/documents/*`)

    -   Document upload (PDF, PowerPoint, Markdown, Text)
    -   Document listing and management
    -   File validation and storage

-   **💬 Chat** (`/chat/*`)

    -   AI-powered conversations with document context
    -   Provider and model selection
    -   Conversation history management

-   **📊 Analytics** (`/analytics/*`)

    -   Study session tracking
    -   Learning progress analytics
    -   Performance metrics and insights

-   **🎓 Enhanced Processing** (`/enhanced-processing/*`)
    -   Educational content generation
    -   Quiz and flashcard creation
    -   AI-powered document analysis

## 🛠️ Using the Documentation

### Interactive Testing

1. **Navigate** to http://localhost:3001/api-docs
2. **Authenticate** using the "Authorize" button
    - Get a JWT token from `/auth/sign-in`
    - Click "Authorize" and enter: `Bearer YOUR_JWT_TOKEN`
3. **Test Endpoints** directly from the UI
    - Expand any endpoint
    - Click "Try it out"
    - Fill in parameters
    - Execute the request

### Authentication Flow

```bash
# 1. Sign up or sign in
curl -X POST http://localhost:3001/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# 2. Use the returned token in subsequent requests
curl -X GET http://localhost:3001/api/documents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📝 API Schema Overview

### Core Data Models

-   **User**: Authentication and profile information
-   **Document**: Uploaded files with metadata and processing status
-   **Conversation**: Chat sessions with message history
-   **Message**: Individual chat messages with roles and timestamps
-   **AnalyticsOverview**: Learning metrics and progress data
-   **AIProvider**: Available AI services and models

### Common Response Patterns

```json
// Success Response
{
  "success": true,
  "data": { ... }
}

// Error Response
{
  "success": false,
  "error": "Error message"
}
```

## 🔧 Configuration

### Environment Variables

The API documentation adapts to your environment:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Settings
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# AI Providers
OPENAI_API_KEY=your_openai_key
GOOGLE_AI_API_KEY=your_google_key
```

### Swagger Configuration

Located in `backend/config/swagger.js`:

-   **OpenAPI 3.0** specification
-   **JWT Authentication** scheme
-   **Comprehensive schemas** for all data models
-   **Response examples** and error patterns

## 📖 API Endpoint Categories

### Authentication Endpoints

-   `POST /auth/sign-in` - User login
-   `POST /auth/sign-up` - User registration
-   `POST /auth/sign-out` - User logout
-   `GET /auth/user` - Get current user

### Document Management

-   `GET /documents` - List user documents
-   `POST /documents/upload` - Upload new document
-   `GET /documents/{id}` - Get document details
-   `DELETE /documents/{id}` - Delete document

### AI Chat System

-   `POST /chat` - Send chat message with context
-   `GET /chat/providers` - Get available AI providers
-   `GET /chat/conversations/{id}` - Get conversation history
-   `GET /chat/conversations` - List conversations

### Analytics & Tracking

-   `GET /analytics/dashboard` - Get analytics overview
-   `POST /analytics/session/start` - Start study session
-   `POST /analytics/session/{id}/end` - End study session
-   `POST /analytics/flashcard/attempt` - Track flashcard attempt
-   `POST /analytics/quiz/completion` - Track quiz completion

### Enhanced Processing

-   `POST /enhanced-processing/generate` - Generate educational content
-   `GET /enhanced-processing/documents/{id}` - Get document with content
-   `GET /enhanced-processing/quiz/{id}` - Get quiz questions
-   `POST /enhanced-processing/quiz/{id}/submit` - Submit quiz answers

## 🎯 Testing Examples

### Upload and Process Document

```bash
# 1. Upload document
curl -X POST http://localhost:3001/api/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf"

# 2. Generate educational content
curl -X POST http://localhost:3001/api/enhanced-processing/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"document_id": "doc_123", "provider": "openai"}'

# 3. Start chat with document
curl -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is this document about?", "document_id": "doc_123"}'
```

### Analytics Workflow

```bash
# 1. Start study session
curl -X POST http://localhost:3001/api/analytics/session/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_type": "study", "document_id": "doc_123"}'

# 2. Track flashcard attempt
curl -X POST http://localhost:3001/api/analytics/flashcard/attempt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"document_id": "doc_123", "question": "Test question", "correct": true}'

# 3. Get analytics data
curl -X GET http://localhost:3001/api/analytics/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔍 Troubleshooting

### Common Issues

1. **CORS Errors**

    - Ensure `CORS_ORIGINS` includes your frontend URL
    - Check that preflight requests are handled

2. **Authentication Failures**

    - Verify JWT token format: `Bearer YOUR_TOKEN`
    - Check token expiration and refresh if needed

3. **File Upload Issues**

    - Verify file type is supported (PDF, PPT, MD, TXT)
    - Check file size limits (50MB max)

4. **API Provider Errors**
    - Ensure AI provider API keys are configured
    - Check provider status in `/chat/providers`

### Debug Information

The server provides detailed logging:

-   Request/response logging with Morgan
-   Authentication validation steps
-   File processing status
-   AI provider interactions

## 📁 File Structure

```
backend/
├── config/
│   └── swagger.js          # Swagger configuration
├── routes/
│   ├── auth.js            # Authentication endpoints (documented)
│   ├── chat.js            # Chat endpoints (documented)
│   ├── documents.js       # Document endpoints (documented)
│   ├── analytics.js       # Analytics endpoints (documented)
│   └── ...
├── server.js              # Swagger middleware setup
└── SWAGGER_SETUP.md       # This documentation
```

## 🚀 Production Deployment

### Environment Setup

```env
# Production configuration
NODE_ENV=production
PORT=3001
CORS_ORIGINS=https://yourdomain.com
```

### Security Considerations

-   JWT tokens for authentication
-   CORS properly configured
-   File upload validation
-   Rate limiting enabled
-   Helmet security headers

### Documentation URLs

-   **Production API**: https://yourdomain.com/api-docs
-   **Staging API**: https://staging.yourdomain.com/api-docs
-   **Development**: http://localhost:3001/api-docs

## 📧 Support

For questions about the API documentation:

1. Check the interactive docs at `/api-docs`
2. Review this setup guide
3. Check server logs for detailed error information
4. Verify authentication and CORS configuration

The Swagger documentation is automatically updated when you modify the JSDoc comments in the route files!
