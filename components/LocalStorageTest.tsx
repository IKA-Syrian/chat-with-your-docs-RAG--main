'use client';

import { useEffect, useState } from 'react';

export default function LocalStorageTest() {
  const [testToken, setTestToken] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 10));
    console.log(`[LocalStorage Test] ${message}`);
  };

  useEffect(() => {
    // Check if test token exists on mount
    const savedToken = localStorage.getItem('test_token');
    if (savedToken) {
      setTestToken(savedToken);
      addLog(`✅ Test token found on page load: ${savedToken}`);
    } else {
      addLog('ℹ️ No test token found on page load');
    }
  }, []);

  const setToken = () => {
    const newToken = `test-token-${Date.now()}`;
    localStorage.setItem('test_token', newToken);
    setTestToken(newToken);
    addLog(`💾 Set test token: ${newToken}`);
  };

  const clearToken = () => {
    localStorage.removeItem('test_token');
    setTestToken(null);
    addLog('🗑️ Cleared test token');
  };

  const checkToken = () => {
    const currentToken = localStorage.getItem('test_token');
    setTestToken(currentToken);
    addLog(`🔍 Current test token: ${currentToken || 'none'}`);
  };

  const simulateRefresh = () => {
    addLog('🔄 Simulating page refresh...');
    window.location.reload();
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-bold mb-4">LocalStorage Persistence Test</h3>
      
      <div className="mb-4">
        <p className="text-sm mb-2">
          <strong>Current Test Token:</strong> {testToken || 'None'}
        </p>
      </div>

      <div className="space-x-2 mb-4">
        <button
          onClick={setToken}
          className="bg-green-500 text-white px-3 py-1 rounded text-sm"
        >
          Set Token
        </button>
        <button
          onClick={clearToken}
          className="bg-red-500 text-white px-3 py-1 rounded text-sm"
        >
          Clear Token
        </button>
        <button
          onClick={checkToken}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
        >
          Check Token
        </button>
        <button
          onClick={simulateRefresh}
          className="bg-purple-500 text-white px-3 py-1 rounded text-sm"
        >
          Refresh Page
        </button>
      </div>

      <div className="text-xs">
        <h4 className="font-semibold mb-2">Activity Log:</h4>
        <div className="bg-white p-2 rounded border max-h-32 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500">No activity yet...</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="font-mono text-xs">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-600">
        <h4 className="font-semibold">Test Steps:</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>Click "Set Token" to create a test token</li>
          <li>Click "Refresh Page" to simulate a page refresh</li>
          <li>Check if the token persists after refresh</li>
          <li>If token disappears, there's a localStorage clearing issue</li>
        </ol>
      </div>
    </div>
  );
}
