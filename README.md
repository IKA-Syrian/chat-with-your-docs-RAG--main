# StudyAI

*Adaptive AI Learning Platform*

StudyAI is a web-based adaptive learning platform designed to help students master new material through dynamically generated quizzes and flashcards, and by allowing natural-language Q&A with uploaded PDF documents.

---

## 🔍 Features

- *Dynamic Quiz Generation*: Automatically create multiple-choice and fill-in-the-blank quizzes tailored to your study material.
- *Smart Flashcards*: Generate and review flashcards on-the-fly, leveraging AI to focus on key concepts and spaced repetition.
- *PDF Chat Assistant*: Upload any PDF (lecture notes, articles, textbooks) and ask questions in plain English; StudyAI will extract and summarize relevant passages.
- *Personalized Learning Paths*: The platform adapts to your performance, offering targeted practice on topics where you need the most reinforcement.
- *Progress Tracking*: Visual dashboards show your quiz scores, flashcard review history, and topic mastery over time.

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- npm or yarn
- A Supabase account (or local Supabase instance) for backend services
- OpenAI API key (or another supported LLM provider)

### Installation

1. Clone the repository:
   bash
   git clone https://github.com/your-org/studyai.git
   cd studyai
   

2. Install dependencies:
   bash
   npm install
   # or
   yarn install
   

3. Create a .env.local file and set your environment variables:
   env
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   OPENAI_API_KEY=<your-openai-api-key>
   

4. Start the Supabase stack (if running locally):
   bash
   npx supabase start
   

5. Run the development server:
   bash
   npm run dev
   # or
   yarn dev
   

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠 Usage

1. *Sign up / log in* using your Supabase credentials.
2. *Upload a PDF* via the "Documents" page.
3. *Ask questions* in the chat interface to get context-aware answers.
4. *Generate quizzes* by selecting a topic or uploading a specific document.
5. *Review flashcards* and track your progress on the "Dashboard".

---
