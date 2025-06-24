"use client"

import { useState, useEffect } from "react"

export default function TestPage() {
  const [status, setStatus] = useState<string>("Loading...")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testConnection = async () => {
      try {
        const fastapiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL
        if (!fastapiUrl) {
          throw new Error("FastAPI URL not configured")
        }

        console.log("Trying to connect to:", fastapiUrl)
        const response = await fetch(`${fastapiUrl}/ping`)
        console.log("Response status:", response.status)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        setStatus(`Connected successfully! Server says: ${data.message}`)
      } catch (err) {
        console.error("Connection error:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
        setStatus("Failed to connect")
      }
    }

    testConnection()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-4">Backend Connection Test</h1>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-lg">Status: {status}</p>
          {error && (
            <p className="text-red-500 mt-2">
              Error: {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
