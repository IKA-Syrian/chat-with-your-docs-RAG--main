'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/api/auth';

export default function TestPage() {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { user, isAuthenticated } = useAuth();

  const testHealthCheck = async () => {
    setLoading(true);
    try {
      const result = await apiClient.healthCheck();
      setHealthStatus(result);
    } catch (error) {
      setHealthStatus({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testHealthCheck();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Backend Connection Test</h1>
      
      <div className="space-y-6">
        {/* Health Check */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Backend Health Check</h2>
          <button
            onClick={testHealthCheck}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 mb-4"
          >
            {loading ? 'Testing...' : 'Test Connection'}
          </button>
          
          {healthStatus && (
            <div className="bg-gray-100 p-4 rounded">
              <pre>{JSON.stringify(healthStatus, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Authentication Status */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          <div className="space-y-2">
            <p><strong>Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
            <p><strong>User:</strong> {user ? user.email : 'None'}</p>
            <p><strong>Token:</strong> {apiClient.getToken() ? 'Present' : 'None'}</p>
          </div>
        </div>

        {/* API Configuration */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">API Configuration</h2>
          <div className="space-y-2">
            <p><strong>API URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}</p>
            <p><strong>Frontend URL:</strong> {typeof window !== 'undefined' ? window.location.origin : 'N/A'}</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Navigation</h2>
          <div className="space-x-4">
            <a href="/login" className="text-blue-500 hover:underline">Login</a>
            <a href="/files" className="text-blue-500 hover:underline">Files</a>
            <a href="/chat" className="text-blue-500 hover:underline">Chat</a>            <a href="http://localhost:3001/health" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              Backend Health (Direct)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
