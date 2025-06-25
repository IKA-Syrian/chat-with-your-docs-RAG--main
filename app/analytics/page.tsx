"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, Brain, Award, ArrowLeft, TrendingUp, Target, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import LayoutClient from "../layout-client"
import { apiClient } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth"

// Types for analytics data
interface OverallAnalytics {
  total_study_time: number
  current_streak: number
  longest_streak: number
  total_flashcards_seen: number
  total_flashcards_mastered: number
  flashcard_accuracy_overall: number
  total_quizzes_completed: number
  average_quiz_score_overall: number
  study_sessions_this_week_count: number
}

interface DatedStudyData {
  date: string
  duration: number
  sessions: number
}

interface DocumentPerformance {
  document_title: string
  accuracy: number
  attempts: number
}

interface RecentQuizPerformance {
  date: string
  score: number
  quiz_title: string
}

interface AnalyticsPageData {
  overall_analytics: OverallAnalytics
  study_sessions_chart_data: DatedStudyData[]
  flashcard_performance_chart_data: DocumentPerformance[]
  quiz_performance_chart_data: RecentQuizPerformance[]
}

export default function AnalyticsPage() {
  const { isAuthenticated } = useAuth()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)

  useEffect(() => {
    const fetchPageData = async () => {
      if (!isAuthenticated) return
      
      setLoading(true)
      try {
        const response = await apiClient.getAnalytics()
        console.log('Raw API response:', response)
        // Handle wrapped response format - API returns {success: true, data: {...}}
        const data = (response as any).data || response
        console.log('Processed data:', data)
        setAnalyticsData(data)
      } catch (error) {
        console.error("Error fetching analytics:", error)
        // Set default data on error
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
  }, [isAuthenticated])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  if (loading) {
    return (
      <LayoutClient>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </LayoutClient>
    )
  }

  const overall = analyticsData?.overall_analytics

  // Enhanced bar chart component with animations and tooltips
  const SimpleBarChart = ({ data, title, dataKey, valueKey, color = "#3B82F6", unit = "", showPercentage = false }: {
    data: any[],
    title: string,
    dataKey: string,
    valueKey: string,
    color?: string,
    unit?: string,
    showPercentage?: boolean
  }) => {
    if (!data || data.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No data available
        </div>
      )
    }

    const maxValue = Math.max(...data.map(item => item[valueKey]), 1)
    
    return (
      <div className="space-y-4">
        {title && <h4 className="font-medium text-gray-900">{title}</h4>}
        <div className="space-y-3">
          {data.slice(0, 10).map((item, index) => (
            <div 
              key={index} 
              className="group flex items-center gap-3"
              onMouseEnter={() => setHoveredBar(index)}
              onMouseLeave={() => setHoveredBar(null)}
            >
              <div className="w-24 text-sm text-gray-600 truncate" title={item[dataKey]}>
                {typeof item[dataKey] === 'string' && item[dataKey].includes('-') 
                  ? new Date(item[dataKey]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : item[dataKey]
                }
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-4 relative overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-700 ease-out relative"
                    style={{ 
                      width: `${(item[valueKey] / maxValue) * 100}%`,
                      backgroundColor: color,
                      transform: hoveredBar === index ? 'scaleY(1.1)' : 'scaleY(1)',
                    }}
                  >
                    {hoveredBar === index && (
                      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded -mr-1 whitespace-nowrap z-10">
                        {item[valueKey]}{unit}{showPercentage && '%'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-14 text-right text-sm font-medium text-gray-700">
                  {item[valueKey]}{unit}{showPercentage && '%'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Enhanced line chart for trends with better interactivity
  const SimpleTrendChart = ({ data, title, color = "#10B981", valueKey = "duration", showTooltip = true }: {
    data: any[],
    title: string,
    color?: string,
    valueKey?: string,
    showTooltip?: boolean
  }) => {
    if (!data || data.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No data available
        </div>
      )
    }
    
    const values = data.map(item => item.score || item[valueKey] || 0)
    const maxValue = Math.max(...values, 1)
    const minValue = Math.min(...values, 0)
    const range = maxValue - minValue || 1
    
    // Calculate chart dimensions
    const chartWidth = 300
    const chartHeight = 100
    const padding = 10
    
    return (
      <div className="space-y-4">
        {title && <h4 className="font-medium text-gray-900">{title}</h4>}
        <div className="h-40 bg-gray-50 rounded-lg p-4 relative">
          <svg 
            className="w-full h-full" 
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(y => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2={chartWidth}
                y2={y}
                stroke="#E5E7EB"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
            ))}
            
            {/* Data line and area */}
            {values.length > 1 && (
              <>
                {/* Area fill */}
                <defs>
                  <linearGradient id={`gradient-${title?.replace(/\s+/g, '-')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.3 }} />
                    <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.05 }} />
                  </linearGradient>
                </defs>
                
                <polygon
                  fill={`url(#gradient-${title?.replace(/\s+/g, '-')})`}
                  points={[
                    ...values.map((value, index) => {
                      const x = (index / (values.length - 1)) * chartWidth
                      const y = chartHeight - ((value - minValue) / range) * chartHeight
                      return `${x},${y}`
                    }),
                    `${chartWidth},${chartHeight}`,
                    `0,${chartHeight}`
                  ].join(' ')}
                />
                
                {/* Data line */}
                <polyline
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={values.map((value, index) => {
                    const x = (index / (values.length - 1)) * chartWidth
                    const y = chartHeight - ((value - minValue) / range) * chartHeight
                    return `${x},${y}`
                  }).join(' ')}
                />
              </>
            )}
            
            {/* Data points with hover effects */}
            {values.map((value, index) => {
              const x = (index / Math.max(values.length - 1, 1)) * chartWidth
              const y = chartHeight - ((value - minValue) / range) * chartHeight
              const isHovered = hoveredPoint === index
              
              return (
                <g key={index}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? "5" : "3.5"}
                    fill={color}
                    stroke="white"
                    strokeWidth="2"
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredPoint(index)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {isHovered && showTooltip && (
                    <g>
                      <rect
                        x={x - 30}
                        y={y - 35}
                        width="60"
                        height="25"
                        rx="4"
                        fill="rgba(0,0,0,0.8)"
                      />
                      <text
                        x={x}
                        y={y - 18}
                        textAnchor="middle"
                        fill="white"
                        fontSize="12"
                        fontWeight="bold"
                      >
                        {Math.round(value)}{valueKey === 'score' ? '%' : ''}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
          
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -translate-x-8">
            <span>{Math.round(maxValue)}</span>
            <span>{Math.round((maxValue + minValue) / 2)}</span>
            <span>{Math.round(minValue)}</span>
          </div>
          
          {/* X-axis info */}
          {data.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 mt-2">
              <span>{new Date(data[0].date || data[0].created_at || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span>{new Date(data[data.length - 1].date || data[data.length - 1].created_at || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Progress Ring Component for metrics
  const ProgressRing = ({ value, maxValue, color = "#3B82F6", size = 60, strokeWidth = 6 }: {
    value: number,
    maxValue: number,
    color?: string,
    size?: number,
    strokeWidth?: number
  }) => {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const strokeDashoffset = circumference - (value / maxValue) * circumference

    return (
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
    )
  }

  return (
    <LayoutClient>
      <div className="h-full bg-gray-50 overflow-auto">
        {/* Fixed Header */}
        <div className="sticky top-0 z-50 bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <Link href="/" className="flex-shrink-0">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Study Analytics</h1>
                  <p className="text-sm text-gray-500">Track your learning progress and performance</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/files">
                    <BookOpen className="h-4 w-4 mr-1" />
                    Files
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
          {/* Key Metrics Cards with Progress Rings */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Study Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatTime(overall?.total_study_time || 0)}</div>
                <p className="text-xs text-muted-foreground">Across all documents</p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overall?.current_streak || 0} days</div>
                <p className="text-xs text-muted-foreground">Longest: {overall?.longest_streak || 0} days</p>
                <div className="mt-2">
                  <ProgressRing 
                    value={overall?.current_streak || 0} 
                    maxValue={Math.max(overall?.longest_streak || 1, overall?.current_streak || 1)} 
                    color="#10B981"
                    size={40}
                    strokeWidth={4}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Flashcard Accuracy</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(overall?.flashcard_accuracy_overall || 0)}%</div>
                <p className="text-xs text-muted-foreground">
                  {overall?.total_flashcards_mastered || 0} of {overall?.total_flashcards_seen || 0} correct
                </p>
                <div className="mt-2">
                  <ProgressRing 
                    value={overall?.flashcard_accuracy_overall || 0} 
                    maxValue={100} 
                    color="#8B5CF6"
                    size={40}
                    strokeWidth={4}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Quiz Score</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(overall?.average_quiz_score_overall || 0)}%</div>
                <p className="text-xs text-muted-foreground">
                  {overall?.total_quizzes_completed || 0} quizzes completed
                </p>
                <div className="mt-2">
                  <ProgressRing 
                    value={overall?.average_quiz_score_overall || 0} 
                    maxValue={100} 
                    color="#F59E0B"
                    size={40}
                    strokeWidth={4}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Visual Charts and Analytics */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sessions">Study Sessions</TabsTrigger>
              <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
              <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Study Time Trend */}
                <Card>
                  <CardHeader>
                    <CardTitle>Study Time Trend</CardTitle>
                    <CardDescription>Your daily study patterns over the last week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.study_sessions_chart_data?.length ? (
                      <SimpleTrendChart 
                        data={analyticsData.study_sessions_chart_data.slice(-7)}
                        title="Study Minutes per Day"
                        color="#3B82F6"
                        valueKey="duration"
                      />
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No study data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quiz Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quiz Performance</CardTitle>
                    <CardDescription>Your quiz scores over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.quiz_performance_chart_data?.length ? (
                      <SimpleTrendChart 
                        data={analyticsData.quiz_performance_chart_data.slice(-10)}
                        title="Quiz Scores (%)"
                        color="#10B981"
                        valueKey="score"
                      />
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No quiz data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Weekly Summary */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Weekly Summary</CardTitle>
                    <CardDescription>Your learning activity breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                        <div className="text-2xl font-bold text-blue-600">{overall?.study_sessions_this_week_count || 0}</div>
                        <div className="text-sm text-blue-700">Sessions This Week</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                        <div className="text-2xl font-bold text-green-600">{formatTime(overall?.total_study_time || 0)}</div>
                        <div className="text-sm text-green-700">Total Study Time</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                        <div className="text-2xl font-bold text-purple-600">{overall?.total_flashcards_seen || 0}</div>
                        <div className="text-sm text-purple-700">Flashcards Reviewed</div>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                        <div className="text-2xl font-bold text-orange-600">{overall?.total_quizzes_completed || 0}</div>
                        <div className="text-sm text-orange-700">Quizzes Completed</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="sessions">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Study Duration</CardTitle>
                    <CardDescription>Minutes studied each day (Last 7 days)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.study_sessions_chart_data?.length ? (
                      <SimpleBarChart 
                        data={analyticsData.study_sessions_chart_data.slice(-7)}
                        title=""
                        dataKey="date"
                        valueKey="duration"
                        color="#3B82F6"
                        unit=" min"
                      />
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No study session data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Session Count</CardTitle>
                    <CardDescription>Number of study sessions per day</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.study_sessions_chart_data?.length ? (
                      <SimpleBarChart 
                        data={analyticsData.study_sessions_chart_data.slice(-7)}
                        title=""
                        dataKey="date"
                        valueKey="sessions"
                        color="#8B5CF6"
                      />
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No session data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Detailed Data */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Detailed Session Data</CardTitle>
                    <CardDescription>Daily breakdown of your study activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.study_sessions_chart_data?.length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Date</th>
                              <th className="text-right py-2">Duration</th>
                              <th className="text-right py-2">Sessions</th>
                              <th className="text-right py-2">Avg Session</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsData.study_sessions_chart_data.slice(-14).map((session, index) => (
                              <tr key={index} className="border-b hover:bg-gray-50">
                                <td className="py-2 font-medium">
                                  {new Date(session.date).toLocaleDateString('en-US', { 
                                    weekday: 'short', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </td>
                                <td className="text-right py-2">{session.duration} min</td>
                                <td className="text-right py-2">{session.sessions}</td>
                                <td className="text-right py-2">
                                  {session.sessions > 0 ? Math.round(session.duration / session.sessions) : 0} min
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No detailed session data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="flashcards">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Accuracy by Document</CardTitle>
                    <CardDescription>Your flashcard performance per document</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.flashcard_performance_chart_data?.length ? (
                      <SimpleBarChart 
                        data={analyticsData.flashcard_performance_chart_data}
                        title=""
                        dataKey="document_title"
                        valueKey="accuracy"
                        color="#10B981"
                        showPercentage={true}
                      />
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No flashcard performance data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Attempt Count</CardTitle>
                    <CardDescription>Number of flashcard attempts per document</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.flashcard_performance_chart_data?.length ? (
                      <SimpleBarChart 
                        data={analyticsData.flashcard_performance_chart_data}
                        title=""
                        dataKey="document_title"
                        valueKey="attempts"
                        color="#F59E0B"
                      />
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No flashcard attempt data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Flashcard Performance Details</CardTitle>
                    <CardDescription>Detailed breakdown by document</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.flashcard_performance_chart_data?.length ? (
                      <div className="space-y-4">
                        {analyticsData.flashcard_performance_chart_data.map((perf, index) => (
                          <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">{perf.document_title}</div>
                              <div className="text-sm text-gray-500">{perf.attempts} attempts</div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-lg font-semibold text-gray-900">{perf.accuracy}%</div>
                                <div className="text-sm text-gray-500">accuracy</div>
                              </div>
                              <div className="w-20 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${perf.accuracy}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No flashcard performance data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="quizzes">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Quiz Scores Over Time</CardTitle>
                    <CardDescription>Track your quiz performance progress</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.quiz_performance_chart_data?.length ? (
                      <SimpleTrendChart 
                        data={analyticsData.quiz_performance_chart_data}
                        title=""
                        color="#EF4444"
                        valueKey="score"
                      />
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No quiz performance data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quiz Scores by Document</CardTitle>
                    <CardDescription>Performance breakdown by quiz</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.quiz_performance_chart_data?.length ? (
                      <SimpleBarChart 
                        data={analyticsData.quiz_performance_chart_data.slice(-10)}
                        title=""
                        dataKey="quiz_title"
                        valueKey="score"
                        color="#EF4444"
                        showPercentage={true}
                      />
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No quiz score data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Recent Quiz Results</CardTitle>
                    <CardDescription>Detailed history of your quiz attempts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData?.quiz_performance_chart_data?.length ? (
                      <div className="space-y-3">
                        {analyticsData.quiz_performance_chart_data.slice(-10).reverse().map((quiz, index) => (
                          <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">{quiz.quiz_title}</div>
                              <div className="text-sm text-gray-500">
                                {new Date(quiz.date).toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className={`text-2xl font-bold ${
                                  quiz.score >= 80 ? 'text-green-600' :
                                  quiz.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {quiz.score}%
                                </div>
                                <div className="text-sm text-gray-500">
                                  {quiz.score >= 80 ? 'Excellent' :
                                   quiz.score >= 60 ? 'Good' : 'Needs Work'}
                                </div>
                              </div>
                              <div className="w-16 bg-gray-200 rounded-full h-3">
                                <div 
                                  className={`h-3 rounded-full transition-all duration-300 ${
                                    quiz.score >= 80 ? 'bg-green-500' :
                                    quiz.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${quiz.score}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No quiz performance data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </LayoutClient>
  )
}