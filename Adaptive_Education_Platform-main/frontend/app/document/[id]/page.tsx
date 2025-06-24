"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { BookOpen, Brain, Target, ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"

// Schemas matching FastAPI responses
interface DocumentSchema {
  id: string
  title: string
  created_at: string
  user_id: string
  file_path: string
}
interface SummarySchema {
  id: string
  document_id: string
  content: string
  created_at: string
}
interface FlashcardSchema {
  id: string
  document_id: string
  question: string
  answer: string
  created_at: string
}
interface QuizQuestionSchema {
  id: string
  quiz_id: string
  question: string
  options: string[]
  correct_answer: string
  created_at: string
}
interface QuizSchema {
  id: string
  document_id: string
  title: string
  created_at: string
  questions: QuizQuestionSchema[]
}
interface DocumentDetailSchema extends DocumentSchema {
  summary: SummarySchema | null
  flashcards: FlashcardSchema[]
  quiz: QuizSchema | null
}

const getMockDocumentDetail = (id: string): DocumentDetailSchema => ({
  id,
  title: "Sample Document: Intro to AI",
  created_at: new Date().toISOString(),
  user_id: "default-user-id",
  file_path: "/mock/path/to/file.pdf",
  summary: {
    id: "sum-1",
    document_id: id,
    content:
      "This is a mock summary for the document. It covers the fundamental concepts of Artificial Intelligence, including machine learning, neural networks, and natural language processing. The document aims to provide a comprehensive overview for beginners.",
    created_at: new Date().toISOString(),
  },
  flashcards: [
    {
      id: "fc-1",
      document_id: id,
      question: "What is AI?",
      answer: "Artificial Intelligence is the simulation of human intelligence in machines.",
      created_at: new Date().toISOString(),
    },
    {
      id: "fc-2",
      document_id: id,
      question: "What are the two main types of AI?",
      answer: "Narrow (or Weak) AI and General (or Strong) AI.",
      created_at: new Date().toISOString(),
    },
  ],
  quiz: {
    id: "quiz-1",
    document_id: id,
    title: "Quiz: Intro to AI",
    created_at: new Date().toISOString(),
    questions: [
      {
        id: "q-1",
        quiz_id: "quiz-1",
        question: "Which of these is a subfield of AI?",
        options: ["Geology", "Machine Learning", "Astrology", "Chemistry"],
        correct_answer: "Machine Learning",
        created_at: new Date().toISOString(),
      },
    ],
  },
})

export default function DocumentPage() {
  const params = useParams()
  const router = useRouter()
  const documentId = params.id as string

  const [documentDetail, setDocumentDetail] = useState<DocumentDetailSchema | null>(null)
  const [loading, setLoading] = useState(true)
  const [configWarning, setConfigWarning] = useState<string | null>(null)
  // ... other states remain the same
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [activeStudySessionId, setActiveStudySessionId] = useState<string | null>(null)
  const [studySessionStartTime, setStudySessionStartTime] = useState<Date | null>(null)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({})
  const [defaultUserId, setDefaultUserId] = useState<string | null>("default-user-id") // Mock default user

  const fastapiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL

  useEffect(() => {
    const fetchDocumentData = async () => {
      setLoading(true)
      if (!fastapiUrl) {
        console.warn(`⚠️ FastAPI URL not configured for document ${documentId}. Loading mock data.`)
        setConfigWarning("Displaying mock data. Set NEXT_PUBLIC_FASTAPI_URL to connect to your backend.")
        setDocumentDetail(getMockDocumentDetail(documentId))
        setLoading(false)
        return
      }

      setConfigWarning(null)
      try {
        const response = await fetch(`${fastapiUrl}/documents/${documentId}`)
        if (!response.ok) {
          if (response.status === 404) setDocumentDetail(null)
          throw new Error(`Failed to fetch document data: ${response.statusText}`)
        }
        const data: DocumentDetailSchema = await response.json()
        setDocumentDetail(data)
      } catch (error) {
        console.error("Error fetching document data from FastAPI:", error)
        setDocumentDetail(null)
      } finally {
        setLoading(false)
      }
    }
    if (documentId) {
      fetchDocumentData()
    }
  }, [documentId, fastapiUrl])

  // Other functions (startStudySession, endStudySession, etc.) remain the same
  // They will only be called via user interaction, and by then the URL check will have happened.
  const startStudySession = async (sessionType: string) => {
    if (!fastapiUrl) {
      alert("Backend not configured. Cannot start session.")
      return
    }
    if (!documentId || !defaultUserId) return
    try {
      setStudySessionStartTime(new Date())
      const response = await fetch(`${fastapiUrl}/analytics/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: defaultUserId, // Use fetched default user ID
          document_id: documentId,
          session_type: sessionType,
        }),
      })
      if (!response.ok) throw new Error("Failed to start session")
      const { id: newSessionId } = await response.json()
      setActiveStudySessionId(newSessionId)
    } catch (error) {
      console.error("Error starting session:", error)
    }
  }

  const endStudySession = async () => {
    if (!fastapiUrl) return
    if (studySessionStartTime && activeStudySessionId) {
      try {
        await fetch(`${fastapiUrl}/analytics/session/${activeStudySessionId}/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Body might not be needed if duration is calculated server-side based on start_time
        })
        setActiveStudySessionId(null)
        setStudySessionStartTime(null)
      } catch (error) {
        console.error("Error ending session:", error)
      }
    }
  }

  const trackFlashcardAttempt = async (isCorrect: boolean, difficultyRating?: number) => {
    if (!fastapiUrl) return
    if (
      !activeStudySessionId ||
      !documentDetail?.flashcards ||
      documentDetail.flashcards.length === 0 ||
      !defaultUserId
    )
      return

    const currentFlashcard = documentDetail.flashcards[currentFlashcardIndex]
    try {
      await fetch(`${fastapiUrl}/analytics/flashcard/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: defaultUserId,
          flashcard_id: currentFlashcard.id,
          is_correct: isCorrect,
          difficulty_rating: difficultyRating,
          session_id: activeStudySessionId,
        }),
      })
    } catch (error) {
      console.error("Error tracking flashcard:", error)
    }
  }

  const submitQuiz = async () => {
    if (!fastapiUrl) {
      alert("Backend not configured. Cannot submit quiz.")
      return
    }
    if (!documentDetail?.quiz || documentDetail.quiz.questions.length === 0 || !defaultUserId) return

    let correctAnswersCount = 0
    documentDetail.quiz.questions.forEach((question) => {
      if (quizAnswers[question.id] === question.correct_answer) {
        correctAnswersCount++
      }
    })

    const scorePercentage = (correctAnswersCount / documentDetail.quiz.questions.length) * 100

    try {
      await fetch(`${fastapiUrl}/analytics/quiz/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: defaultUserId,
          quiz_id: documentDetail.quiz.id,
          score: Math.round(scorePercentage),
          total_questions: documentDetail.quiz.questions.length,
          correct_answers: correctAnswersCount,
          // duration: 0, // Optional: track quiz duration
        }),
      })
      alert(
        `Quiz completed! Score: ${Math.round(scorePercentage)}% (${correctAnswersCount}/${documentDetail.quiz.questions.length})`,
      )
      // Optionally, navigate away or reset quiz state
    } catch (error) {
      console.error("Error submitting quiz:", error)
    }
  }

  const handleQuizAnswer = (questionId: string, answer: string) => {
    setQuizAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  const nextFlashcard = () => {
    if (documentDetail && documentDetail.flashcards.length > 0) {
      setCurrentFlashcardIndex((prev) => (prev + 1) % documentDetail.flashcards.length)
      setShowAnswer(false)
    }
  }

  const prevFlashcard = () => {
    if (documentDetail && documentDetail.flashcards.length > 0) {
      setCurrentFlashcardIndex(
        (prev) => (prev - 1 + documentDetail.flashcards.length) % documentDetail.flashcards.length,
      )
      setShowAnswer(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-32 w-32 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!documentDetail) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Document Not Found</h1>
          <p className="text-gray-600 mb-4">
            The requested document could not be found, or the backend is not connected.
          </p>
          <Link href="/">
            <Button>Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  const currentFlashcard = documentDetail.flashcards[currentFlashcardIndex]
  const quiz = documentDetail.quiz
  const quizQuestions = quiz?.questions || []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{documentDetail.title}</h1>
              <p className="text-sm text-gray-500">
                Created {new Date(documentDetail.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {configWarning && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-md text-sm">
            <p>
              <span className="font-semibold">Note:</span> {configWarning}
            </p>
          </div>
        )}
        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Summary
            </TabsTrigger>
            <TabsTrigger value="flashcards" className="flex items-center gap-2">
              <Brain className="h-4 w-4" /> Flashcards
            </TabsTrigger>
            <TabsTrigger value="quiz" className="flex items-center gap-2">
              <Target className="h-4 w-4" /> Quiz
            </TabsTrigger>
          </TabsList>

          {/* TabsContent sections remain the same as previous version */}
          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle>AI-Generated Summary</CardTitle>
                <CardDescription>Key points and concepts</CardDescription>
              </CardHeader>
              <CardContent>
                {documentDetail.summary ? (
                  <div className="prose max-w-none">
                    <p className="text-gray-700 leading-relaxed">{documentDetail.summary.content}</p>
                  </div>
                ) : (
                  <p className="text-gray-500">No summary available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flashcards">
            <Card>
              <CardHeader>
                <CardTitle>Flashcards</CardTitle>
                <CardDescription>Test your knowledge</CardDescription>
              </CardHeader>
              <CardContent>
                {documentDetail.flashcards.length > 0 ? (
                  <div className="space-y-6">
                    {!activeStudySessionId && (
                      <div className="text-center">
                        <Button onClick={() => startStudySession("flashcard")}>Start Flashcard Session</Button>
                      </div>
                    )}
                    {activeStudySessionId && currentFlashcard && (
                      <>
                        <div className="text-center">
                          <div className="text-sm text-gray-500 mb-4">
                            Card {currentFlashcardIndex + 1} of {documentDetail.flashcards.length}
                          </div>
                          <Card className="min-h-[200px] flex items-center justify-center">
                            <CardContent className="text-center p-8">
                              <div className="text-lg font-medium mb-4">{showAnswer ? "Answer:" : "Question:"}</div>
                              <div className="text-xl">
                                {showAnswer ? currentFlashcard.answer : currentFlashcard.question}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                        <div className="flex justify-center space-x-4">
                          <Button
                            variant="outline"
                            onClick={prevFlashcard}
                            disabled={documentDetail.flashcards.length <= 1}
                          >
                            Previous
                          </Button>
                          <Button onClick={() => setShowAnswer(!showAnswer)}>
                            {showAnswer ? "Show Question" : "Show Answer"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={nextFlashcard}
                            disabled={documentDetail.flashcards.length <= 1}
                          >
                            Next
                          </Button>
                        </div>
                        {showAnswer && (
                          <div className="text-center space-y-4">
                            <p className="text-sm text-gray-600">How well did you know this?</p>
                            <div className="flex justify-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  trackFlashcardAttempt(false, 1)
                                  nextFlashcard()
                                }}
                                className="text-red-600 border-red-600 hover:bg-red-50"
                              >
                                Hard
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  trackFlashcardAttempt(true, 3)
                                  nextFlashcard()
                                }}
                                className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
                              >
                                Medium
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  trackFlashcardAttempt(true, 5)
                                  nextFlashcard()
                                }}
                                className="text-green-600 border-green-600 hover:bg-green-50"
                              >
                                Easy
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="text-center">
                          <Button variant="outline" onClick={endStudySession}>
                            End Session
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">No flashcards available for this document.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quiz">
            <Card>
              <CardHeader>
                <CardTitle>{quiz?.title || "Quiz"}</CardTitle>
                <CardDescription>Test your understanding</CardDescription>
              </CardHeader>
              <CardContent>
                {quizQuestions.length > 0 ? (
                  <div className="space-y-6">
                    {quizQuestions.map((q, index) => (
                      <Card key={`question-${q.id}`}>
                        <CardContent className="p-6">
                          <div className="mb-4">
                            <h3 className="text-lg font-medium mb-4">
                              {index + 1}. {q.question}
                            </h3>
                            <div className="space-y-2">
                              {q.options.map((option) => (
                                <label key={`${q.id}-${option}`} className="flex items-center space-x-3 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`question-${q.id}`}
                                    value={option}
                                    onChange={() => handleQuizAnswer(q.id, option)}
                                    className="form-radio"
                                  />
                                  <span>{option}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <Button className="w-full" onClick={submitQuiz}>
                      Submit Quiz
                    </Button>
                  </div>
                ) : (
                  <p className="text-gray-500">No quiz questions available for this document.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
