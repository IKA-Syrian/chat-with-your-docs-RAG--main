"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { BookOpen, Brain, Target, ArrowLeft, Loader2, RefreshCw, Settings, ChevronDown, CheckCircle, XCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import LayoutClient from "../../layout-client"
import { apiClient } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth"
import { toast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useSessionTracking } from '@/lib/hooks/use-session-tracking'

// Types matching our backend responses
interface DocumentDetail {
  id: string
  name: string
  created_at: string
  summary?: any  // Backend returns {summary: string, key_points: string[]} but we need to handle various formats
  flashcards?: any  // Backend returns {flashcards: Array} but we need to handle various formats  
  quiz?: any  // Backend returns {questions: Array} but we need to handle various formats
  educational_content_generated?: string
}

interface SecureQuizQuestion {
  id: number
  question: string
  options: string[]
}

interface QuizResult {
  questionId: number
  question: string
  options: string[]
  userAnswer: number | null
  correctAnswer: number
  isCorrect: boolean
  explanation?: string
}

interface AIProvider {
  id: string
  name: string
  enabled: boolean
  models?: {
    primary: string
    alternatives: string[]
  }
}

export default function StudyPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [documentDetail, setDocumentDetail] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // AI settings state
  const [showSettings, setShowSettings] = useState(false)
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [providersLoading, setProvidersLoading] = useState(true)

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<SecureQuizQuestion[]>([])
  const [quizAnswers, setQuizAnswers] = useState<{[key: number]: number}>({})
  const [quizStartTime, setQuizStartTime] = useState<string | null>(null)
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizResults, setQuizResults] = useState<QuizResult[]>([])
  const [quizScore, setQuizScore] = useState<number | null>(null)
  const [quizLoading, setQuizLoading] = useState(false)

  // Flashcards state
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [showCardBack, setShowCardBack] = useState(false)

  const documentId = params.id as string

  // Session tracking for analytics
  const { recordActivity, trackFlashcardAttempt, trackQuizAttempt, trackQuizCompletion } = useSessionTracking({
    activityType: 'study',
    documentId,
    autoStart: true,
  })

  useEffect(() => {
    if (documentId) {
      fetchDocumentDetail()
      fetchAIProviders()
    }
  }, [documentId])

  const fetchDocumentDetail = async () => {
    try {
      setLoading(true)
      console.log('📋 Fetching document detail for:', documentId)
      
      const response = await apiClient.getDocumentDetail(documentId)
      console.log('📋 API response received')
      
      // Extract document from response - the API returns direct document data
      const documentData = response.document || response
      
      console.log('📋 Educational content detected:', {
        hasSummary: !!documentData?.summary,
        hasFlashcards: !!documentData?.flashcards,
        hasQuiz: !!documentData?.quiz,
        educationalContentGenerated: documentData?.educational_content_generated
      })
      
      setDocumentDetail(documentData)
      setError(null)
    } catch (err: any) {
      console.error('❌ Error fetching document:', err)
      
      // If the enhanced processing endpoint fails, try the main documents endpoint as fallback
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        console.log('⚠️ Enhanced processing endpoint failed, trying main documents endpoint...')
        try {
          const fallbackResponse = await apiClient.getDocument(documentId)
          console.log('📋 Using fallback endpoint')
          
          if (fallbackResponse?.document) {
            // Map the main documents response to the expected format
            const mappedResponse = {
              id: fallbackResponse.document.id,
              name: fallbackResponse.document.name,
              created_at: fallbackResponse.document.created_at,
              summary: fallbackResponse.document.summary,
              flashcards: fallbackResponse.document.flashcards,
              quiz: fallbackResponse.document.quiz,
              educational_content_generated: fallbackResponse.document.educational_content_generated
            }
            
            console.log('📋 Fallback educational content:', {
              hasSummary: !!mappedResponse.summary,
              hasFlashcards: !!mappedResponse.flashcards,
              hasQuiz: !!mappedResponse.quiz
            })
            
            setDocumentDetail(mappedResponse)
            setError(null)
            return
          }
        } catch (fallbackErr) {
          console.error('❌ Fallback also failed:', fallbackErr)
        }
      }
      
      setError(err.message || 'Failed to load document')
      toast({
        title: "Error",
        description: "Failed to load document details",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchAIProviders = async () => {
    try {
      setProvidersLoading(true)
      const response = await apiClient.getAIProviders()
      const enabledProviders = response.providers.filter(p => p.enabled)
      setProviders(enabledProviders)
      
      // Set default provider and model
      if (enabledProviders.length > 0) {
        const defaultProvider = enabledProviders[0]
        setSelectedProvider(defaultProvider.id)
        setSelectedModel(defaultProvider.models?.primary || '')
      }
    } catch (err: any) {
      console.error('Error fetching AI providers:', err)
      toast({
        title: "Warning",
        description: "Failed to load AI providers. Using fallback options.",
        variant: "destructive",
      })
      
      // Fallback to basic providers if fetch fails
      const fallbackProviders: AIProvider[] = [
        {
          id: 'gemini',
          name: 'Google Gemini',
          enabled: true,
          models: {
            primary: 'gemini-2.0-flash',
            alternatives: ['gemini-1.5-flash', 'gemini-pro']
          }
        }
      ]
      setProviders(fallbackProviders)
      setSelectedProvider('gemini')
      setSelectedModel('gemini-2.0-flash')
    } finally {
      setProvidersLoading(false)
    }
  }

  const generateEducationalContent = async (isRegenerate = false) => {
    if (!documentDetail) return

    try {
      setGenerating(true)
      
      const response = await apiClient.generateEducationalContent(
        documentId,
        selectedProvider,
        selectedModel
      )

      // Update the document with new educational content
      setDocumentDetail(prev => prev ? {
        ...prev,
        summary: response.summary,
        flashcards: response.flashcards,
        quiz: response.quiz,
        educational_content_generated: response.generated_at || new Date().toISOString()
      } : null)

      // Reset quiz state when new content is generated
      setQuizQuestions([])
      setQuizAnswers({})
      setQuizSubmitted(false)
      setQuizResults([])
      setQuizScore(null)

      const selectedProviderName = providers.find(p => p.id === selectedProvider)?.name || selectedProvider
      const selectedModelName = selectedModel

      toast({
        title: isRegenerate ? "Content Regenerated!" : "Content Generated!",
        description: `Educational content has been ${isRegenerate ? 'regenerated' : 'generated'} using ${selectedProviderName} (${selectedModelName})`,
      })

    } catch (err: any) {
      console.error('Error generating educational content:', err)
      toast({
        title: "Generation Failed",
        description: err.message || "Failed to generate educational content",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const loadQuizQuestions = async () => {
    if (!documentDetail?.quiz) return

    try {
      setQuizLoading(true)
      const response = await apiClient.getQuizQuestions(documentId)
      setQuizQuestions(response.questions)
      setQuizStartTime(new Date().toISOString())
      setQuizAnswers({})
      setQuizSubmitted(false)
      setQuizResults([])
      setQuizScore(null)
    } catch (err: any) {
      console.error('Error loading quiz:', err)
      toast({
        title: "Error",
        description: "Failed to load quiz questions",
        variant: "destructive",
      })
    } finally {
      setQuizLoading(false)
    }
  }

  const submitQuiz = async () => {
    if (!quizStartTime || quizQuestions.length === 0) return

    try {
      setQuizLoading(true)
      
      const answers = quizQuestions.map(q => ({
        questionId: q.id,
        selectedOption: quizAnswers[q.id] ?? -1
      }))

      const endTime = new Date().toISOString()
      const timeSpent = Math.floor((new Date(endTime).getTime() - new Date(quizStartTime).getTime()) / 1000)
      
      const response = await apiClient.submitQuizAnswers(
        documentId,
        answers,
        quizStartTime,
        endTime
      )

      setQuizResults(response.results)
      setQuizScore(response.score)
      setQuizSubmitted(true)

      // Track quiz completion for analytics
      trackQuizCompletion(response.score, quizQuestions.length, timeSpent);

      toast({
        title: response.passed ? "Quiz Passed!" : "Quiz Completed",
        description: `You scored ${response.score}% (${response.correctAnswers}/${response.totalQuestions})`,
        variant: response.passed ? "default" : "destructive"
      })

    } catch (err: any) {
      console.error('Error submitting quiz:', err)
      toast({
        title: "Error",
        description: "Failed to submit quiz answers",
        variant: "destructive",
      })
    } finally {
      setQuizLoading(false)
    }
  }

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId)
    // Set default model for the provider
    const provider = providers.find(p => p.id === providerId)
    if (provider?.models?.primary) {
      setSelectedModel(provider.models.primary)
    }
  }

  const getAvailableModels = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider?.models) return []
    
    return [
      { value: provider.models.primary, label: provider.models.primary },
      ...(provider.models.alternatives || []).map(model => ({
        value: model,
        label: model
      }))
    ]
  }

  const nextCard = () => {
    if (documentDetail?.flashcards?.flashcards && documentDetail.flashcards.flashcards.length > 0) {
      // Track flashcard attempt when moving to next card (assumes they tried the current one)
      if (showCardBack) {
        trackFlashcardAttempt(true, `card_${currentCardIndex}`);
      }
      
      setCurrentCardIndex((prev) => (prev + 1) % documentDetail.flashcards.flashcards.length)
      setShowCardBack(false)
      recordActivity('flashcard');
    }
  }

  const prevCard = () => {
    if (documentDetail?.flashcards?.flashcards && documentDetail.flashcards.flashcards.length > 0) {
      setCurrentCardIndex((prev) => 
        prev === 0 ? documentDetail.flashcards.flashcards.length - 1 : prev - 1
      )
      setShowCardBack(false)
      recordActivity('flashcard');
    }
  }

  const flipCard = () => {
    setShowCardBack(!showCardBack);
    recordActivity('flashcard');
  }

  const handleQuizAnswerChange = (questionId: number, selectedOption: number) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionId]: selectedOption
    }));
    
    // Track quiz attempt (we don't know if it's correct yet, so we'll assume it's an attempt)
    recordActivity('quiz');
  }

  if (loading || providersLoading) {
    return (
      <LayoutClient>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading document...</p>
          </div>
        </div>
      </LayoutClient>
    )
  }

  if (error || !documentDetail) {
    return (
      <LayoutClient>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || 'Document not found'}</p>
            <Button onClick={() => router.push("/files")} variant="outline">
              Back to Files
            </Button>
          </div>
        </div>
      </LayoutClient>
    )
  }

  const hasAnyEducationalContent = (
    documentDetail?.summary || 
    documentDetail?.flashcards || 
    documentDetail?.quiz ||
    documentDetail?.educational_content_generated
  )

  // Debug logging for educational content detection
  console.log('🔍 Educational content check:', {
    documentDetail: !!documentDetail,
    hasSummary: !!documentDetail?.summary,
    hasFlashcards: !!documentDetail?.flashcards,
    hasQuiz: !!documentDetail?.quiz,
    hasEducationalContent: hasAnyEducationalContent,
    summaryType: typeof documentDetail?.summary,
    flashcardsType: typeof documentDetail?.flashcards,
    quizType: typeof documentDetail?.quiz,
    educationalContentGenerated: documentDetail?.educational_content_generated
  })

  return (
    <LayoutClient>
      <div className="flex flex-col h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Mobile Header */}
            <div className="flex items-center py-4 sm:py-6">
              <Button variant="ghost" size="sm" onClick={() => router.push("/files")} className="mr-2 sm:mr-4 p-2 sm:px-3">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back to Files</span>
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{documentDetail.name}</h1>
                <p className="text-xs sm:text-sm text-gray-500">
                  Created {new Date(documentDetail.created_at).toLocaleDateString()}
                </p>
              </div>
              
              {/* Desktop Action Buttons */}
              <div className="hidden md:flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/chat?document_id=${documentId}`)}
                  className="flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.478 8-10 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.478-8 10-8s10 3.582 10 8z" />
                  </svg>
                  Chat
                </Button>

                {hasAnyEducationalContent && providers.length > 0 && (
                  <>
                    <Button
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowSettings(!showSettings)}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      AI Settings
                      <ChevronDown className={`h-4 w-4 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                    </Button>

                    <Button onClick={() => generateEducationalContent(true)} disabled={generating}>
                      {generating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>

              {/* Mobile Action Buttons */}
              <div className="flex md:hidden items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/chat?document_id=${documentId}`)}
                  className="p-2"
                  title="Chat"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.478 8-10 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.478-8 10-8s10 3.582 10 8z" />
                  </svg>
                </Button>

                {hasAnyEducationalContent && providers.length > 0 && (
                  <>
                    <Button
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowSettings(!showSettings)}
                      className="p-2"
                      title="AI Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>

                    <Button 
                      onClick={() => generateEducationalContent(true)} 
                      disabled={generating}
                      size="sm"
                      className="p-2"
                      title="Regenerate"
                    >
                      {generating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Mobile Action Row */}
            <div className="md:hidden pb-4">
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/chat?document_id=${documentId}`)}
                  className="flex items-center gap-1 text-xs"
                >
                  💬 Chat
                </Button>

                {hasAnyEducationalContent && providers.length > 0 && (
                  <>
                    <Button
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowSettings(!showSettings)}
                      className="flex items-center gap-1 text-xs"
                    >
                      ⚙️ Settings
                    </Button>

                    <Button 
                      onClick={() => generateEducationalContent(true)} 
                      disabled={generating}
                      size="sm"
                      className="flex items-center gap-1 text-xs"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          🔄 Regenerate
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* AI Settings Panel */}
            {showSettings && providers.length > 0 && (
              <div className="pb-4 sm:pb-6 border-t border-gray-200 pt-4">
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">AI Configuration</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                        Provider
                      </label>
                      <select
                        value={selectedProvider}
                        onChange={(e) => handleProviderChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        aria-label="Select AI Provider"
                      >
                        {providers.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                        Model
                      </label>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        aria-label="Select AI Model"
                      >
                        {getAvailableModels(selectedProvider).map((model) => (
                          <option key={model.value} value={model.value}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Selected: {providers.find(p => p.id === selectedProvider)?.name} - {selectedModel}
                  </p>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          {!hasAnyEducationalContent ? (
            <Card>
              <CardContent className="text-center py-12">
                <Brain className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Study Materials Yet</h3>
                <p className="text-gray-500 mb-6">
                  Generate AI-powered summaries, flashcards, and quizzes for this document.
                </p>
                
                {/* Debug info when no educational content is detected */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-gray-400 mb-4 p-3 bg-gray-100 rounded">
                    Debug: No educational content detected<br/>
                    Summary: {documentDetail?.summary ? 'exists' : 'missing'}<br/>
                    Flashcards: {documentDetail?.flashcards ? 'exists' : 'missing'}<br/>
                    Quiz: {documentDetail?.quiz ? 'exists' : 'missing'}<br/>
                    Generated: {documentDetail?.educational_content_generated || 'never'}
                  </div>
                )}
                
                {/* AI Settings for initial generation */}
                {providers.length > 0 && (
                  <div className="max-w-md mx-auto mb-6 px-4 sm:px-0">
                    <div className="grid grid-cols-1 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                          AI Provider
                        </label>
                        <select
                          value={selectedProvider}
                          onChange={(e) => handleProviderChange(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          aria-label="Select AI Provider"
                        >
                          {providers.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                          Model
                        </label>
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          aria-label="Select AI Model"
                        >
                          {getAvailableModels(selectedProvider).map((model) => (
                            <option key={model.value} value={model.value}>
                              {model.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={() => generateEducationalContent(false)} 
                  disabled={generating || providers.length === 0}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Study Materials...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      {providers.length === 0 ? 'No AI Providers Available' : 'Generate Study Materials'}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="summary" className="space-y-4 sm:space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="summary" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Summary</span>
                  <span className="sm:hidden">📄</span>
                </TabsTrigger>
                <TabsTrigger value="flashcards" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Target className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Flashcards</span>
                  <span className="sm:hidden">🎯</span>
                </TabsTrigger>
                <TabsTrigger value="quiz" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Brain className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Quiz</span>
                  <span className="sm:hidden">🧠</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary">
                <Card>
                  <CardHeader>
                    <CardTitle>Document Summary</CardTitle>
                    <CardDescription>
                      AI-generated summary of the key points and concepts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {documentDetail.summary ? (
                      <div className="space-y-4 sm:space-y-6">
                        <div className="prose max-w-none">
                          <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Summary</h4>
                          <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                            {documentDetail.summary.summary}
                          </p>
                        </div>
                        
                        {documentDetail.summary.key_points && documentDetail.summary.key_points.length > 0 && (
                          <div>
                            <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Key Points</h4>
                            <ul className="space-y-3">
                              {documentDetail.summary.key_points.map((point: string, index: number) => (
                                <li key={index} className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium">
                                    {index + 1}
                                  </div>
                                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{point}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm sm:text-base">No summary available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="flashcards">
                <div className="space-y-4">
                  {documentDetail.flashcards?.flashcards && documentDetail.flashcards.flashcards.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h3 className="text-base sm:text-lg font-semibold">
                          Flashcard {currentCardIndex + 1} of {documentDetail.flashcards.flashcards.length}
                        </h3>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={prevCard} 
                            disabled={documentDetail.flashcards.flashcards.length <= 1}
                            className="flex-1 sm:flex-none"
                          >
                            ← Previous
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={nextCard} 
                            disabled={documentDetail.flashcards.flashcards.length <= 1}
                            className="flex-1 sm:flex-none"
                          >
                            Next →
                          </Button>
                        </div>
                      </div>

                      <Card className="min-h-[200px] sm:h-64 cursor-pointer" onClick={flipCard}>
                        <CardContent className="h-full flex items-center justify-center p-4 sm:p-8">
                          <div className="text-center">
                            <p className="text-sm sm:text-lg mb-3 sm:mb-4 font-medium text-blue-600">
                              {showCardBack ? 'Answer:' : 'Question:'}
                            </p>
                            <div className="text-base sm:text-xl text-gray-800 leading-relaxed">
                              {showCardBack 
                                ? documentDetail.flashcards.flashcards[currentCardIndex]?.back
                                : documentDetail.flashcards.flashcards[currentCardIndex]?.front
                              }
                            </div>
                            <p className="text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4">
                              Tap to {showCardBack ? 'see question' : 'reveal answer'}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-2">
                        <Progress 
                          value={((currentCardIndex + 1) / documentDetail.flashcards.flashcards.length) * 100} 
                          className="w-full"
                        />
                        <div className="flex justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={flipCard}
                            className="text-xs sm:text-sm"
                          >
                            {showCardBack ? '🔄 Show Question' : '🔄 Show Answer'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="text-center py-8">
                        <p className="text-gray-500">No flashcards available</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="quiz">
                <div className="space-y-4">
                  {documentDetail.quiz?.questions && documentDetail.quiz.questions.length > 0 ? (
                    <div>
                      {!quizSubmitted ? (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              Interactive Quiz
                              {quizStartTime && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  In Progress
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription>
                              Test your understanding with {documentDetail.quiz.questions.length} questions
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            {quizQuestions.length === 0 ? (
                              <div className="text-center py-8">
                                <p className="text-gray-600 mb-4">Ready to test your knowledge?</p>
                                <Button onClick={loadQuizQuestions} disabled={quizLoading}>
                                  {quizLoading ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Loading Quiz...
                                    </>
                                  ) : (
                                    <>
                                      <Brain className="h-4 w-4 mr-2" />
                                      Start Quiz
                                    </>
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-4 sm:space-y-6">
                                {quizQuestions.map((question, questionIndex) => (
                                  <div key={question.id} className="border rounded-lg p-3 sm:p-4">
                                    <h4 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">
                                      Question {questionIndex + 1}. {question.question}
                                    </h4>
                                    <div className="space-y-2 sm:space-y-3">
                                      {question.options.map((option, optionIndex) => (
                                        <label key={optionIndex} className="flex items-start space-x-3 cursor-pointer p-2 hover:bg-gray-50 rounded">
                                          <input
                                            type="radio"
                                            name={`question-${question.id}`}
                                            value={optionIndex}
                                            checked={quizAnswers[question.id] === optionIndex}
                                            onChange={(e) => handleQuizAnswerChange(question.id, parseInt(e.target.value))}
                                            className="form-radio h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0"
                                          />
                                          <span className="text-gray-700 text-sm sm:text-base leading-relaxed">
                                            {String.fromCharCode(65 + optionIndex)}. {option}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                                
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-4 gap-3">
                                  <p className="text-xs sm:text-sm text-gray-600">
                                    {Object.keys(quizAnswers).length} of {quizQuestions.length} questions answered
                                  </p>
                                  <Button 
                                    onClick={submitQuiz} 
                                    disabled={Object.keys(quizAnswers).length !== quizQuestions.length || quizLoading}
                                    className="w-full sm:w-auto"
                                  >
                                    {quizLoading ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Submitting...
                                      </>
                                    ) : (
                                      '✅ Submit Quiz'
                                    )}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-4">
                          {/* Quiz Results */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                {quizScore && quizScore >= 70 ? (
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-600" />
                                )}
                                Quiz Results
                              </CardTitle>
                              <CardDescription>
                                {quizScore !== null && (
                                  <div className="flex items-center gap-4">
                                    <span>Your Score: {quizScore}%</span>
                                    <Badge variant={quizScore >= 70 ? "default" : "destructive"}>
                                      {quizScore >= 70 ? "Passed" : "Failed"}
                                    </Badge>
                                  </div>
                                )}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              {quizScore !== null && (
                                <div className="mb-4">
                                  <Progress value={quizScore} className="w-full" />
                                  <p className="text-sm text-gray-600 mt-2">
                                    {quizResults.filter(r => r.isCorrect).length} out of {quizResults.length} questions correct
                                  </p>
                                </div>
                              )}
                              
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Button 
                                  variant="outline" 
                                  onClick={loadQuizQuestions}
                                  className="w-full sm:w-auto"
                                >
                                  🔄 Retake Quiz
                                </Button>
                                <Button 
                                  variant="outline" 
                                  onClick={() => {
                                    setQuizQuestions([])
                                    setQuizAnswers({})
                                    setQuizSubmitted(false)
                                    setQuizResults([])
                                    setQuizScore(null)
                                    setQuizStartTime(null)
                                  }}
                                  className="w-full sm:w-auto"
                                >
                                  🗑️ Reset
                                </Button>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Detailed Results */}
                          <div className="space-y-3 sm:space-y-4">
                            {quizResults.map((result, index) => (
                              <Card key={result.questionId}>
                                <CardHeader className="pb-3 sm:pb-4">
                                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                    {result.isCorrect ? (
                                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                                    ) : (
                                      <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0" />
                                    )}
                                    Question {index + 1}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0">
                                  <div className="space-y-3 sm:space-y-4">
                                    <p className="font-medium text-gray-900 text-sm sm:text-base leading-relaxed">{result.question}</p>
                                    
                                    <div className="space-y-2">
                                      {result.options.map((option, optionIndex) => (
                                        <div key={optionIndex} className={`p-2 sm:p-3 rounded-lg border text-sm sm:text-base ${
                                          optionIndex === result.correctAnswer 
                                            ? 'bg-green-50 border-green-200 text-green-800' 
                                            : optionIndex === result.userAnswer && !result.isCorrect
                                            ? 'bg-red-50 border-red-200 text-red-800'
                                            : 'bg-gray-50 border-gray-200'
                                        }`}>
                                          <div className="flex items-start gap-2">
                                            <span className="font-medium flex-shrink-0">
                                              {String.fromCharCode(65 + optionIndex)}.
                                            </span>
                                            <span className="flex-1">{option}</span>
                                            <div className="flex flex-col gap-1">
                                              {optionIndex === result.correctAnswer && (
                                                <span className="text-green-600 text-xs sm:text-sm whitespace-nowrap">✓ Correct</span>
                                              )}
                                              {optionIndex === result.userAnswer && !result.isCorrect && (
                                                <span className="text-red-600 text-xs sm:text-sm whitespace-nowrap">✗ Your answer</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    
                                    {result.explanation && (
                                      <div className="mt-3 sm:mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <h5 className="font-medium text-blue-800 mb-1 text-sm sm:text-base">Explanation:</h5>
                                        <p className="text-blue-700 text-sm sm:text-base leading-relaxed">{result.explanation}</p>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="text-center py-8">
                        <p className="text-gray-500">No quiz questions available</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  </LayoutClient>
)
} 