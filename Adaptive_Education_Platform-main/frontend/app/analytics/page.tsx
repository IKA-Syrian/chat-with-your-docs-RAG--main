"use client"

import { useState, useEffect, useMemo } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts"
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, Brain, Award, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Schemas matching FastAPI responses
interface OverallAnalytics {
  total_study_time: number
  current_streak: number
  longest_streak: number
  total_flashcards_seen: number
  total_flashcards_mastered: number
  flashcard_accuracy_overall: number // percentage
  total_quizzes_completed: number
  average_quiz_score_overall: number // percentage
  study_sessions_this_week_count: number
}

interface DatedStudyData {
  date: string // YYYY-MM-DD
  duration: number // minutes
  sessions: number
}

interface DocumentPerformance {
  document_title: string
  accuracy: number // percentage
  attempts: number
}

interface RecentQuizPerformance {
  date: string // YYYY-MM-DD
  score: number // percentage
  quiz_title: string
}

interface AnalyticsPageData {
  overall_analytics: OverallAnalytics
  study_sessions_chart_data: DatedStudyData[]
  flashcard_performance_chart_data: DocumentPerformance[]
  quiz_performance_chart_data: RecentQuizPerformance[]
}

// Helper to safely convert to number and default if NaN or non-finite
const safeNumber = (value: any, defaultValue = 0): number => {
  const num = Number(value)
  return isFinite(num) ? num : defaultValue
}

// Helper to safely round a number, defaulting if NaN or non-finite
const safeRound = (value: any, defaultValue = 0): number => {
  const num = Number(value)
  return isFinite(num) ? Math.round(num) : defaultValue
}

// Custom Tooltip Content to handle potential NaN values gracefully
const CustomTooltipContent = (props: TooltipProps<ValueType, NameType>) => {
  const { active, payload, label } = props
  if (active && payload && payload.length) {
    return (
      <div className="bg-background p-2 shadow-lg rounded-md border">
        <p className="label text-sm text-muted-foreground">{`${label}`}</p>
        {payload.map((entry, index) => (
          <p key={`item-${index}`} style={{ color: entry.color || entry.stroke }} className="text-sm">
            {`${entry.name}: ${isFinite(Number(entry.value)) ? Number(entry.value).toFixed(0) : "N/A"}`}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsPageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPageData = async () => {
      setLoading(true)
      const fastapiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL
      try {
        const response = await fetch(`${fastapiUrl}/analytics/pagedata`) // Default user is handled by FastAPI
        if (!response.ok) {
          throw new Error(`Failed to fetch analytics data: ${response.statusText}`)
        }
        const data: AnalyticsPageData = await response.json()
        setAnalyticsData(data)
      } catch (error) {
        console.error("Error fetching analytics from FastAPI:", error)
        // Set to default empty state on error
        setAnalyticsData({
          overall_analytics: {
            total_study_time: 0,
            current_streak: 0,
            longest_streak: 0,
            total_flashcards_seen: 0,
            total_flashcards_mastered: 0,
            flashcard_accuracy_overall: 0,
            total_quizzes_completed: 0,
            average_quiz_score_overall: 0,
            study_sessions_this_week_count: 0,
          },
          study_sessions_chart_data: [],
          flashcard_performance_chart_data: [],
          quiz_performance_chart_data: [],
        })
      } finally {
        setLoading(false)
      }
    }
    fetchPageData()
  }, [])

  const formatTime = (seconds: number) => {
    const safeSeconds = safeNumber(seconds)
    const hours = Math.floor(safeSeconds / 3600)
    const minutes = Math.floor((safeSeconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const chartConfigBase: ChartConfig = useMemo(
    () => ({
      duration: { label: "Study Time (minutes)", color: "hsl(var(--chart-1))" },
      sessions: { label: "Sessions", color: "hsl(var(--chart-2))" }, // If you add sessions to chart
      accuracy: { label: "Accuracy (%)", color: "hsl(var(--chart-1))" },
      score: { label: "Score (%)", color: "hsl(var(--chart-1))" },
    }),
    [],
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const overall = analyticsData?.overall_analytics

  const renderChart = (
    chartData: any[] | undefined, // Allow undefined
    type: "bar" | "line" | "horizontalBar",
    dataKey: string,
    xAxisKey?: string,
    yAxisProps?: any,
    chartSpecificProps?: any,
  ) => {
    if (!chartData || chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-[400px] text-muted-foreground">
          No data available for this chart.
        </div>
      )
    }
    const specificConfig: ChartConfig = {
      [dataKey]: chartConfigBase[dataKey] || { label: dataKey, color: "hsl(var(--chart-1))" },
    }
    if (type === "horizontalBar" && xAxisKey) {
      // For horizontal bar, YAxis uses dataKey from xAxisKey
      specificConfig[xAxisKey] = chartConfigBase[xAxisKey] || { label: xAxisKey, color: "hsl(var(--chart-2))" }
    }

    return (
      <ChartContainer config={specificConfig} className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={chartData} {...chartSpecificProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey || "date"} />
              <YAxis {...yAxisProps} />
              <ChartTooltip content={<CustomTooltipContent />} cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : type === "line" ? (
            <LineChart data={chartData} {...chartSpecificProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey || "date"} />
              <YAxis domain={[0, 100]} {...yAxisProps} />
              <ChartTooltip content={<CustomTooltipContent />} cursor={{ fill: "hsl(var(--muted))" }} />
              <Line type="monotone" dataKey={dataKey} stroke={`var(--color-${dataKey})`} strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart
              data={chartData}
              layout="vertical"
              {...chartSpecificProps}
              margin={{ left: 30, right: 30, ...chartSpecificProps?.margin }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} {...yAxisProps} />
              <YAxis
                dataKey={xAxisKey || "document_title"}
                type="category"
                width={150}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip content={<CustomTooltipContent />} cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={[0, 4, 4, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </ChartContainer>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <Link href="/" className="mr-4">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Study Analytics</h1>
              <p className="text-sm text-gray-500">Track your learning progress and performance</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Study Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTime(overall?.total_study_time || 0)}</div>
              <p className="text-xs text-muted-foreground">Across all documents</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{safeNumber(overall?.current_streak)} days</div>
              <p className="text-xs text-muted-foreground">Longest: {safeNumber(overall?.longest_streak)} days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Flashcard Accuracy</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{safeRound(overall?.flashcard_accuracy_overall || 0)}%</div>
              <p className="text-xs text-muted-foreground">
                {safeNumber(overall?.total_flashcards_mastered)} of {safeNumber(overall?.total_flashcards_seen)} correct
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Quiz Score</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{safeRound(overall?.average_quiz_score_overall || 0)}%</div>
              <p className="text-xs text-muted-foreground">
                {safeNumber(overall?.total_quizzes_completed)} quizzes completed
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sessions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sessions">Study Sessions</TabsTrigger>
            <TabsTrigger value="flashcards">Flashcard Performance</TabsTrigger>
            <TabsTrigger value="quizzes">Quiz Performance</TabsTrigger>
          </TabsList>
          <TabsContent value="sessions">
            <Card>
              <CardHeader>
                <CardTitle>Study Sessions (Last 7 Days)</CardTitle>
                <CardDescription>Your daily study time and session count</CardDescription>
              </CardHeader>
              <CardContent>
                {renderChart(analyticsData?.study_sessions_chart_data, "bar", "duration", "date")}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="flashcards">
            <Card>
              <CardHeader>
                <CardTitle>Flashcard Performance by Document</CardTitle>
                <CardDescription>Your accuracy rate for each document's flashcards</CardDescription>
              </CardHeader>
              <CardContent>
                {renderChart(
                  analyticsData?.flashcard_performance_chart_data,
                  "horizontalBar",
                  "accuracy",
                  "document_title",
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="quizzes">
            <Card>
              <CardHeader>
                <CardTitle>Recent Quiz Performance</CardTitle>
                <CardDescription>Your quiz scores over time</CardDescription>
              </CardHeader>
              <CardContent>
                {renderChart(analyticsData?.quiz_performance_chart_data, "line", "score", "date")}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
