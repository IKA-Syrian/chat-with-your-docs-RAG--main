"use client"

import { useState, useEffect } from "react"
import { Upload, BookOpen, Brain, Target, TrendingUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

interface DocumentSchema {
  id: string
  title: string
  created_at: string
}

interface OverallAnalyticsSchema {
  total_study_time: number
  total_flashcards_mastered: number
  average_quiz_score_overall: number
}

const getMockData = () => ({
  documents: [
    { id: "1", title: "Sample Document: Intro to AI", created_at: new Date().toISOString() },
    { id: "2", title: "Sample Document: History of Computing", created_at: new Date().toISOString() },
  ],
  overallStats: {
    total_study_time: 7200,
    total_flashcards_mastered: 42,
    average_quiz_score_overall: 88,
  },
})

function DashboardContent() {
  const [documents, setDocuments] = useState<DocumentSchema[]>([])
  const [overallStats, setOverallStats] = useState<OverallAnalyticsSchema | null>(null)
  const [loading, setLoading] = useState(true)
  const [configWarning, setConfigWarning] = useState<string | null>(null)

  const fastapiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true)
      if (!fastapiUrl) {
        console.warn(
          "⚠️ FastAPI URL not configured. Loading mock data for preview. Please set NEXT_PUBLIC_FASTAPI_URL for a live connection.",
        )
        setConfigWarning("Displaying mock data. Set NEXT_PUBLIC_FASTAPI_URL to connect to your backend.")
        const mock = getMockData()
        setDocuments(mock.documents)
        setOverallStats(mock.overallStats)
        setLoading(false)
        return
      }

      setConfigWarning(null)
      try {
        const docsResponse = await fetch(`${fastapiUrl}/documents`)
        if (!docsResponse.ok) {
          console.warn("Documents endpoint returned non-OK status:", docsResponse.status)
          setDocuments([])
          return
        }
        const docsData = await docsResponse.json()
        setDocuments(Array.isArray(docsData) ? docsData : [])

        const analyticsResponse = await fetch(`${fastapiUrl}/analytics/pagedata`)
        if (!analyticsResponse.ok) {
          console.warn("Analytics endpoint returned non-OK status:", analyticsResponse.status)
          setOverallStats(null)
          return
        }
        const analyticsPageData = await analyticsResponse.json()
        setOverallStats(analyticsPageData.overall_analytics || null)
      } catch (error) {
        console.error("Error fetching dashboard data from FastAPI:", error)
        setDocuments([])
        setOverallStats(null)
      } finally {
        setLoading(false)
      }
    }
    fetchInitialData()
  }, [fastapiUrl])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-32 w-32 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">StudyAI</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/analytics">
                <Button variant="outline" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Analytics
                </Button>
              </Link>
              <Link href="/upload">
                <Button className="flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Upload PDF
                </Button>
              </Link>
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
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Welcome back!</h2>
          <p className="text-gray-600 mt-2">Ready to continue your learning journey?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documents.length}</div>
              <p className="text-xs text-muted-foreground">PDFs uploaded</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Flashcards Mastered</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats?.total_flashcards_mastered || 0}</div>
              <p className="text-xs text-muted-foreground">Across all documents</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Quiz Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(overallStats?.average_quiz_score_overall || 0)}%</div>
              <p className="text-xs text-muted-foreground">Overall performance</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
            <CardDescription>Your recently uploaded PDFs and study materials</CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
                <p className="text-gray-500 mb-4">Upload your first PDF to get started</p>
                <Link href="/upload">
                  <Button>
                    <Upload className="h-4 w-4 mr-2" /> Upload PDF
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <BookOpen className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{doc.title}</h3>
                        <p className="text-sm text-gray-500">
                          Uploaded {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Link href={`/document/${doc.id}`}>
                        <Button variant="outline" size="sm">
                          Study
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function Dashboard() {
  return <DashboardContent />
}
