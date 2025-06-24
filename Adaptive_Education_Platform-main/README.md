# Adaptive Education Platform (StudyAI)

StudyAI is a comprehensive web application that transforms PDF documents into interactive study materials using artificial intelligence. Upload your PDFs and automatically generate summaries, flashcards, and quizzes to enhance your learning experience.

## Features

- 📄 **PDF Upload & Processing**: Upload PDF documents and extract text content
- 🤖 **AI-Generated Content**: Automatically create summaries, flashcards, and quizzes using OpenRouter AI
- 📊 **Study Analytics**: Track your study progress, quiz scores, and flashcard performance
- 🎯 **Interactive Learning**: Engage with flashcards and take quizzes to test your knowledge
- 📈 **Progress Tracking**: Monitor study sessions, streaks, and overall performance

## Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn/ui** - Modern UI component library
- **Recharts** - Data visualization for analytics

### Backend
- **FastAPI** - Modern Python web framework
- **OpenRouter API** - AI model integration (DeepSeek R1)
- **PyPDF2** - PDF text extraction
- **Pydantic** - Data validation and serialization

## Project Structure

```
AI_Education/
├── frontend/                 # Next.js frontend application
│   ├── app/                 # App router pages
│   │   ├── page.tsx         # Dashboard
│   │   ├── upload/          # PDF upload page
│   │   ├── document/[id]/   # Document study page
│   │   └── analytics/       # Analytics dashboard
│   ├── components/          # Reusable UI components
│   └── lib/                 # Utility functions
├── backend/                 # FastAPI backend
│   ├── main.py              # Main application file
│   └── requirements.txt     # Python dependencies
└── package.json             # Root package configuration
```

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm/pnpm
- Python 3.11+
- OpenRouter API key

### 1. Clone the Repository
```bash
git clone <repository-url>
cd AI_Education
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the backend directory:
```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

Start the backend server:
```bash
python main.py
```
The backend will run on `http://localhost:8000`

### 3. Frontend Setup
```bash
cd frontend
npm install
# or
pnpm install
```

Create a `.env.local` file in the frontend directory:
```env
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000
```

Start the frontend development server:
```bash
npm run dev
# or
pnpm dev
```
The frontend will run on `http://localhost:3000`

## API Endpoints

### Document Management
- `POST /documents/upload` - Upload a PDF document
- `POST /documents/{document_id}/process` - Process uploaded document with AI
- `GET /documents` - List all documents
- `GET /documents/{document_id}` - Get document details with generated content

### Content Generation
- `POST /upload-pdf` - Upload and process PDF in one step
- `POST /generate-summary` - Generate summary from text
- `POST /generate-quiz` - Generate quiz from text
- `POST /generate-flashcards` - Generate flashcards from text

### Analytics
- `GET /analytics/pagedata` - Get analytics dashboard data
- `POST /analytics/session/start` - Start a study session
- `POST /analytics/session/{session_id}/end` - End a study session
- `POST /analytics/flashcard/attempt` - Track flashcard attempt
- `POST /analytics/quiz/attempt` - Track quiz attempt

## Usage

1. **Upload a PDF**: Navigate to the upload page and select a PDF document
2. **AI Processing**: The system automatically extracts text and generates study materials
3. **Study**: Access your document to view summaries, practice flashcards, and take quizzes
4. **Track Progress**: Monitor your learning progress in the analytics dashboard

## Configuration

### Environment Variables

#### Backend (.env)
- `OPENROUTER_API_KEY`: Your OpenRouter API key for AI model access

#### Frontend (.env.local)
- `NEXT_PUBLIC_FASTAPI_URL`: Backend API URL (default: http://localhost:8000)

## AI Model Configuration

The application uses OpenRouter's DeepSeek R1 model for content generation:
- Model: `deepseek/deepseek-r1-distill-llama-70b:free`
- Provider: OpenRouter API
- Features: Text summarization, question generation, flashcard creation

## Development

### Running Tests
```bash
# Backend tests (if implemented)
cd backend
pytest

# Frontend tests (if implemented)
cd frontend
npm test
```

### Code Quality
- Frontend: ESLint and Prettier configured
- Backend: Follow PEP 8 Python style guide
- TypeScript: Strict mode enabled

## Deployment

### Backend Deployment
- Deploy to services like Railway, Heroku, or AWS
- Set environment variables in production
- Consider using a proper database (PostgreSQL, MongoDB) instead of in-memory storage

### Frontend Deployment
- Deploy to Vercel, Netlify, or similar platforms
- Update `NEXT_PUBLIC_FASTAPI_URL` to production backend URL
- Enable production optimizations

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenRouter for AI model access
- Shadcn/ui for beautiful UI components
- Next.js team for the excellent framework
- FastAPI for the high-performance backend framework
