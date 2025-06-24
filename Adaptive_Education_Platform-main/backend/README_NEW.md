# Adaptive Education Platform - Express.js Backend (MVC)

## Overview

Express.js backend for the Adaptive Education Platform using MVC (Model-View-Controller) architecture with JavaScript ES6 modules.

## Features

-   PDF text extraction and processing
-   AI-powered content generation (summaries, quizzes, flashcards)
-   Document management with in-memory storage
-   Analytics tracking and session management
-   RESTful API endpoints
-   MVC architecture for clean code organization

## Tech Stack

-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **Language**: JavaScript (ES6 Modules)
-   **Architecture**: MVC (Model-View-Controller)
-   **File Upload**: Multer
-   **PDF Processing**: pdf-parse (mock implementation)
-   **AI Integration**: OpenRouter API
-   **Validation**: express-validator

## Project Structure

```
src/
├── server.js                 # Main application entry point
├── models/
│   └── index.js              # Data models (Document, Session)
├── controllers/
│   ├── documentController.js # Document management logic
│   ├── processingController.js # PDF processing logic
│   └── analyticsController.js # Analytics tracking logic
├── services/
│   ├── aiService.js          # OpenRouter AI integration
│   └── pdfService.js         # PDF text extraction
├── routes/
│   ├── documentRoutes.js     # Document endpoints
│   ├── processingRoutes.js   # Processing endpoints
│   └── analyticsRoutes.js    # Analytics endpoints
└── middlewares/
    └── errorHandler.js       # Global error handling
```

## Getting Started

### Prerequisites

-   Node.js 18+
-   OpenRouter API key (optional - falls back to mock data)

### Installation

1. **Install dependencies**:

    ```bash
    npm install
    ```

2. **Environment setup**:

    ```bash
    cp .env.example .env
    # Edit .env and add your OpenRouter API key
    ```

3. **Development**:

    ```bash
    npm run dev
    ```

4. **Production**:
    ```bash
    npm start
    ```

## API Endpoints

### Health Check

-   `GET /ping` - Simple ping/pong
-   `GET /health` - Health status with model info
-   `GET /test` - Backend connectivity test

### PDF Processing

-   `POST /api/upload-pdf` - Upload and process PDF (returns summary, quiz, flashcards)
-   `POST /api/generate-summary` - Generate summary from text
-   `POST /api/generate-quiz` - Generate quiz from text
-   `POST /api/generate-flashcards` - Generate flashcards from text

### Document Management

-   `POST /api/documents/upload` - Upload PDF document
-   `POST /api/documents/:id/process` - Process uploaded document
-   `GET /api/documents` - List all documents
-   `GET /api/documents/:id` - Get document details

### Analytics

-   `GET /api/analytics/pagedata` - Get analytics dashboard data
-   `POST /api/analytics/session/start` - Start study session
-   `POST /api/analytics/session/:id/end` - End study session
-   `POST /api/analytics/flashcard/attempt` - Track flashcard attempt
-   `POST /api/analytics/quiz/attempt` - Track quiz attempt

## MVC Architecture

### Models (`src/models/`)

-   **DocumentModel**: Manages document storage and retrieval
-   **SessionModel**: Handles study sessions and analytics tracking

### Controllers (`src/controllers/`)

-   **DocumentController**: Document upload, processing, and retrieval
-   **ProcessingController**: AI-powered content generation
-   **AnalyticsController**: Session tracking and analytics

### Services (`src/services/`)

-   **AIService**: OpenRouter API integration with fallback mock data
-   **PDFService**: PDF text extraction (currently mocked)

### Routes (`src/routes/`)

-   Organized by feature area (documents, processing, analytics)
-   Clean separation of concerns
-   Consistent RESTful endpoints

## Environment Variables

```env
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
MODEL_NAME=deepseek/deepseek-r1-distill-llama-70b:free
PORT=3000
NODE_ENV=development
```

## Development Features

-   **Mock Data**: Falls back to mock responses when AI API is unavailable
-   **Error Handling**: Comprehensive error handling with detailed logging
-   **Hot Reload**: Automatic restart on file changes with nodemon
-   **ES6 Modules**: Modern JavaScript with import/export syntax
-   **CORS**: Configured for frontend development

## Migration Notes

This JavaScript MVC backend maintains full API compatibility with the original Python FastAPI backend:

-   Same endpoint URLs and request/response formats
-   Equivalent AI processing capabilities
-   Identical mock data for development
-   Compatible analytics tracking

The MVC architecture provides:

-   **Better Code Organization**: Clear separation of concerns
-   **Maintainability**: Easy to modify and extend
-   **Testability**: Isolated components for unit testing
-   **Scalability**: Structured for growth
