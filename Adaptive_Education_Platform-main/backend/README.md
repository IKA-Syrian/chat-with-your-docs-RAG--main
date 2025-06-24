# Adaptive Education Platform - Node.js Backend

## Overview

Node.js/TypeScript backend for the Adaptive Education Platform, converted from the original FastAPI Python backend.

## Features

-   PDF text extraction and processing
-   AI-powered content generation (summaries, quizzes, flashcards)
-   Document management
-   Analytics tracking
-   RESTful API endpoints

## Tech Stack

-   **Runtime**: Node.js/Bun
-   **Framework**: Express.js
-   **Language**: TypeScript
-   **File Upload**: Multer
-   **PDF Processing**: pdf-parse
-   **AI Integration**: OpenRouter API
-   **Validation**: Zod

## Getting Started

### Prerequisites

-   Node.js 18+ or Bun
-   OpenRouter API key

### Installation

1. **Install dependencies**:

    ```bash
    # Using Bun (recommended)
    bun install

    # Or using npm
    npm install
    ```

2. **Environment setup**:

    ```bash
    cp .env.example .env
    # Edit .env and add your OpenRouter API key
    ```

3. **Development**:

    ```bash
    # Using Bun
    bun run dev

    # Or using Node.js
    npm run dev:node
    ```

4. **Production build**:
    ```bash
    bun run build
    bun run start
    ```

## API Endpoints

### Health Check

-   `GET /ping` - Simple ping/pong
-   `GET /health` - Health status with model info
-   `GET /test` - Backend connectivity test

### PDF Processing

-   `POST /upload-pdf` - Upload and process PDF (returns summary, quiz, flashcards)
-   `POST /generate-summary` - Generate summary from text
-   `POST /generate-quiz` - Generate quiz from text
-   `POST /generate-flashcards` - Generate flashcards from text

### Document Management

-   `POST /documents/upload` - Upload PDF document
-   `POST /documents/:id/process` - Process uploaded document
-   `GET /documents` - List all documents
-   `GET /documents/:id` - Get document details

### Analytics

-   `GET /analytics/pagedata` - Get analytics dashboard data
-   `POST /analytics/session/start` - Start study session
-   `POST /analytics/session/:id/end` - End study session
-   `POST /analytics/flashcard/attempt` - Track flashcard attempt
-   `POST /analytics/quiz/attempt` - Track quiz attempt

## Architecture

```
src/
├── index.ts              # Main application entry
├── types.ts              # TypeScript type definitions
├── services/
│   ├── aiService.ts      # OpenRouter AI integration
│   └── pdfService.ts     # PDF text extraction
└── routes/
    ├── processing.ts     # PDF processing endpoints
    ├── documents.ts      # Document management
    └── analytics.ts      # Analytics tracking
```

## Environment Variables

```env
OPENROUTER_API_KEY=your_openrouter_api_key
PORT=8000
NODE_ENV=development
```

## Migration from Python Backend

This Node.js backend maintains API compatibility with the original FastAPI backend:

-   Same endpoint URLs and request/response formats
-   Equivalent AI processing capabilities
-   Identical mock data for development
-   Compatible analytics tracking

## Development Notes

-   Uses in-memory storage for development (replace with database in production)
-   Includes comprehensive error handling and validation
-   TypeScript for type safety
-   Supports both Bun and Node.js runtimes
