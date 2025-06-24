# Express.js Backend for Chat with Documents

This is the Express.js backend API for the Chat with Documents RAG application.

## Features

-   **Authentication**: Sign up, sign in, sign out, user management
-   **Document Management**: Upload, process, and manage documents
-   **File Processing**: Parse markdown documents into sections
-   **Embeddings**: Create embeddings for document sections (placeholder implementation)
-   **Chat API**: Chat interface for querying documents (placeholder implementation)

## Setup

1. **Install dependencies:**

    ```bash
    npm install
    ```

2. **Configure environment:**

    - Copy `.env.example` to `.env`
    - Update the environment variables with your Supabase credentials

3. **Start development server:**

    ```bash
    npm run dev
    ```

4. **Start production server:**
    ```bash
    npm start
    ```

## API Endpoints

### Authentication

-   `POST /api/auth/sign-in` - Sign in with email/password
-   `POST /api/auth/sign-up` - Sign up new user
-   `POST /api/auth/sign-out` - Sign out current user
-   `GET /api/auth/user` - Get current user info

### Documents

-   `GET /api/documents` - Get all user documents
-   `POST /api/documents/upload` - Upload a new document
-   `GET /api/documents/:id` - Get specific document
-   `DELETE /api/documents/:id` - Delete document

### Processing

-   `POST /api/process` - Process document into sections

### Embeddings

-   `POST /api/embed` - Create embeddings for document sections
-   `POST /api/embed/openai` - Create OpenAI embeddings (not implemented)

### Chat

-   `POST /api/chat` - Chat with documents
-   `GET /api/chat/conversations/:id` - Get conversation history
-   `POST /api/chat/stream` - Stream chat response

### Health Check

-   `GET /health` - Check server health

## Environment Variables

```env
PORT=3001
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key (optional)
CORS_ORIGINS=http://localhost:3000,http://localhost:3003
```

## Frontend Integration

Update your frontend to use the backend API:

1. Change API calls from `/api/` to `http://localhost:3001/api/`
2. Include authentication headers: `Authorization: Bearer <token>`
3. Handle CORS properly

## TODO

-   [ ] Implement proper OpenAI embeddings
-   [ ] Add vector similarity search
-   [ ] Implement conversation storage
-   [ ] Add proper RAG functionality
-   [ ] Add input validation middleware
-   [ ] Add API documentation (Swagger)
-   [ ] Add tests
-   [ ] Add logging
-   [ ] Add database migrations

# Backend Setup Guide

## Database Setup

The application requires a Supabase database with specific tables and permissions. Follow these steps to set up your database:

### Option 1: Using Supabase SQL Editor (Recommended)

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Open the `schema.sql` file from this directory
4. Copy and paste the entire SQL content into the SQL Editor
5. Execute the SQL to create all necessary tables, views, and policies

### Option 2: Manual Table Creation

If you prefer to create tables one by one:

1. Log in to your Supabase dashboard
2. Navigate to the Database section
3. Create each of the following tables with their respective columns:
    - `documents`
    - `document_sections`
    - `conversations`
    - `messages`
4. Set up Row Level Security (RLS) policies for each table
5. Create the necessary views and indexes

## Environment Variables

Make sure to set up your `.env` file with the following variables:

```
# Environment Variables
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret

# Front-end URL (for HTTP referer headers)
FRONTEND_URL=http://localhost:3000

# Back-end URL (for internal API calls)
BACKEND_URL=http://localhost:3001

# CORS Origins (comma-separated)
CORS_ORIGINS=*
```

## Running the Backend Server

1. Install dependencies:

    ```
    npm install
    ```

2. Start the server:
    ```
    node server.js
    ```

The server will be available at `http://localhost:3001` by default.

## Troubleshooting

### Database Connection Issues

If you encounter issues with database connections:

1. Verify your Supabase URL and keys in the `.env` file
2. Check that your Supabase instance is running
3. Ensure your IP address is allowed in Supabase's network restrictions

### Authentication Problems

If you experience authentication issues:

1. Verify that the JWT secret is correctly set in both Supabase and your `.env` file
2. Check that the service role key has the necessary permissions
3. Ensure your RLS policies are correctly configured
