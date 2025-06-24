"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile)
      if (!title) {
        setTitle(selectedFile.name.replace(".pdf", ""))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !title) return

    setUploading(true)
    setProcessing(false)

    const fastapiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL
    if (!fastapiUrl) {
      console.error("FastAPI URL not configured. Please set NEXT_PUBLIC_FASTAPI_URL.")
      setConfigError(
        "FastAPI backend URL is not configured. Please set the NEXT_PUBLIC_FASTAPI_URL environment variable.",
      )
      setUploading(false)
      setProcessing(false)
      return
    }
    setConfigError(null) // Clear any previous error

    try {
      const formData = new FormData()
      formData.append("pdf", file)
      formData.append("title", title)

      // 1. Upload to FastAPI
      const uploadResponse = await fetch(`${fastapiUrl}/documents/upload`, {
        method: "POST",
        body: formData,
        // No 'Content-Type' header for FormData, browser sets it with boundary
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}))
        throw new Error(errorData.detail || "Upload to FastAPI failed")
      }

      const uploadedDocument = await uploadResponse.json()
      const documentId = uploadedDocument.id

      setUploading(false)
      setProcessing(true)

      // 2. Trigger processing in FastAPI
      const processResponse = await fetch(`${fastapiUrl}/documents/${documentId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No body needed if document_id is in URL, or pass { documentId } if endpoint expects it
      })

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({}))
        throw new Error(errorData.detail || "Processing via FastAPI failed")
      }

      router.push(`/document/${documentId}`)
    } catch (error) {
      console.error("Error in FastAPI flow:", error)
      // Add user-friendly error display here
      alert(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setUploading(false)
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Upload Your PDF</h1>
          <p className="text-lg text-gray-600">
            Upload a PDF document and we'll generate summaries, flashcards, and quizzes to help you study
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Document Upload</CardTitle>
            <CardDescription>Choose a PDF file to upload and start your AI-powered study session</CardDescription>
          </CardHeader>
          <CardContent>
            {configError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
                <p className="font-semibold">Configuration Error:</p>
                <p>{configError}</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="title">Document Title</Label>
                <Input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a title for your document"
                  required
                />
              </div>

              <div>
                <Label htmlFor="file">PDF File</Label>
                <div className="mt-2">
                  <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400">
                    <div className="space-y-1 text-center">
                      {file ? (
                        <div className="flex items-center justify-center space-x-2">
                          <FileText className="h-8 w-8 text-blue-600" />
                          <span className="text-sm font-medium text-gray-900">{file.name}</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="mx-auto h-12 w-12 text-gray-400" />
                          <div className="flex text-sm text-gray-600">
                            <label
                              htmlFor="file-upload"
                              className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                            >
                              <span>Upload a file</span>
                              <input
                                id="file-upload"
                                name="file-upload"
                                type="file"
                                accept=".pdf"
                                className="sr-only"
                                onChange={handleFileChange}
                                required
                              />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                          </div>
                          <p className="text-xs text-gray-500">PDF up to 10MB</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!!configError || !file || !title || uploading || processing}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing with AI...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload and Process
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
