'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/api/auth';
import { apiClient } from '@/lib/api/client';
import { getSupabaseClient } from '@/lib/supabase/client';
import LocalStorageTest from '@/components/LocalStorageTest';
import TokenMismatchFix from '@/components/TokenMismatchFix';

export default function AuthDebugPage() {
  const { user: apiUser, loading: apiLoading } = useAuth();  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [testLoginForm, setTestLoginForm] = useState({ email: '', password: '' });
  const [loginResult, setLoginResult] = useState<any>(null);

  const supabase = getSupabaseClient();

  useEffect(() => {
    checkSupabaseAuth();
    checkDebugInfo();
  }, []);

  const checkSupabaseAuth = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      setSupabaseUser(user);
      console.log('Direct Supabase auth check:', { user, error });
    } catch (error) {
      console.error('Supabase auth check failed:', error);
    }
  };

  const checkDebugInfo = () => {
    const token = apiClient.getToken();
    const hasLocalStorageToken = typeof window !== 'undefined' 
      ? !!localStorage.getItem('auth_token') 
      : false;
    
    setDebugInfo({
      hasApiClientToken: !!token,
      tokenLength: token?.length || 0,
      hasLocalStorageToken,
      localStorageTokenLength: typeof window !== 'undefined' 
        ? localStorage.getItem('auth_token')?.length || 0 
        : 0,
    });
  };
  const runTests = async () => {
    console.log('🧪 Starting comprehensive auth tests...');
    const results: any = {};

    try {
      // Test 1: API Client health check
      console.log('Test 1: Health check');
      results.healthCheck = await apiClient.healthCheck();
    } catch (error) {
      results.healthCheck = { error: (error as Error).message };
    }

    try {
      // Test 2: Token validation
      console.log('Test 2: Token validation');
      results.tokenValidation = await apiClient.validateToken();
    } catch (error) {
      results.tokenValidation = { error: (error as Error).message };
    }

    try {
      // Test 3: Current user via API
      console.log('Test 3: Get current user');
      results.apiCurrentUser = await apiClient.getCurrentUser();
    } catch (error) {
      results.apiCurrentUser = { error: (error as Error).message };
    }

    try {
      // Test 4: Supabase session
      console.log('Test 4: Supabase session');
      const { data, error } = await supabase.auth.getSession();
      results.supabaseSession = { data: data.session ? 'present' : 'null', error };
    } catch (error) {
      results.supabaseSession = { error: (error as Error).message };
    }

    try {
      // Test 5: Check documents endpoint (requires auth)
      console.log('Test 5: Protected endpoint test');
      results.documentsEndpoint = await apiClient.getDocuments();
    } catch (error) {
      results.documentsEndpoint = { error: (error as Error).message };
    }

    try {
      // Test 6: Check localStorage state
      console.log('Test 6: LocalStorage state');
      results.localStorageState = {
        authToken: typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null,
        allKeys: typeof window !== 'undefined' ? Object.keys(localStorage) : [],
      };
    } catch (error) {
      results.localStorageState = { error: (error as Error).message };
    }

    console.log('🧪 All tests completed');
    setTestResults(results);
  };
  const clearAllAuth = () => {
    apiClient.clearAuth();
    supabase.auth.signOut();
    setSupabaseUser(null);
    setLoginResult(null);
    checkDebugInfo();
    console.log('All authentication state cleared');
  };

  const validateCurrentToken = async () => {
    const token = apiClient.getToken();
    if (!token) {
      setLoginResult({ error: 'No token to validate' });
      return;
    }

    try {
      console.log('🔍 Validating current token...');
      const response = await apiClient.validateToken();
      setLoginResult({ tokenValidation: response });
      console.log('Token validation result:', response);
    } catch (error) {
      console.error('Token validation failed:', error);
      setLoginResult({ tokenValidationError: (error as Error).message });
    }
  };

  const testLogin = async () => {
    if (!testLoginForm.email || !testLoginForm.password) {
      setLoginResult({ error: 'Email and password required' });
      return;
    }

    try {
      console.log('🔐 Testing login with:', testLoginForm.email);
      const response = await apiClient.signIn(testLoginForm.email, testLoginForm.password);
      setLoginResult({ success: true, response });
      
      // Refresh auth state
      checkSupabaseAuth();
      checkDebugInfo();
    } catch (error) {
      console.error('Login test failed:', error);
      setLoginResult({ error: (error as Error).message });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug Page</h1>      {/* Token Mismatch Fix */}
      <TokenMismatchFix />

      {/* LocalStorage Test */}
      <LocalStorageTest />

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="border p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">API Authentication</h2>
          <p>Loading: {apiLoading ? 'Yes' : 'No'}</p>
          <p>User: {apiUser ? apiUser.email || 'Authenticated' : 'Not authenticated'}</p>
        </div>
        
        <div className="border p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Supabase Direct</h2>
          <p>User: {supabaseUser ? supabaseUser.email || 'Authenticated' : 'Not authenticated'}</p>
        </div>
      </div>

      {/* Debug Info */}
      {debugInfo && (
        <div className="border p-4 rounded mb-6">
          <h2 className="text-lg font-semibold mb-2">Debug Information</h2>
          <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}      {/* Test Results */}
      {testResults && (
        <div className="border p-4 rounded mb-6">
          <h2 className="text-lg font-semibold mb-2">Test Results</h2>
          <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto max-h-96">
            {JSON.stringify(testResults, null, 2)}
          </pre>
        </div>
      )}

      {/* Login Test */}
      <div className="border p-4 rounded mb-6">
        <h2 className="text-lg font-semibold mb-2">Login Test</h2>
        <div className="grid grid-cols-1 gap-2 mb-4">
          <input
            type="email"
            placeholder="Email"
            value={testLoginForm.email}
            onChange={(e) => setTestLoginForm(prev => ({ ...prev, email: e.target.value }))}
            className="border p-2 rounded"
          />
          <input
            type="password"
            placeholder="Password"
            value={testLoginForm.password}
            onChange={(e) => setTestLoginForm(prev => ({ ...prev, password: e.target.value }))}
            className="border p-2 rounded"
          />
          <button
            onClick={testLogin}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Test Login
          </button>
        </div>
        
        {loginResult && (
          <div className="text-sm bg-gray-100 p-2 rounded">
            <strong>Login Result:</strong>
            <pre>{JSON.stringify(loginResult, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4 flex-wrap">
        <button
          onClick={runTests}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Run Tests
        </button>
        
        <button
          onClick={checkSupabaseAuth}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Check Supabase Auth
        </button>
        
        <button
          onClick={checkDebugInfo}
          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
        >
          Refresh Debug Info
        </button>
          <button
          onClick={clearAllAuth}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Clear All Auth
        </button>
        
        <button
          onClick={validateCurrentToken}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
        >
          Validate Current Token
        </button>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 rounded">
        <h2 className="text-lg font-semibold mb-2">Instructions</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Check if you have authentication state from both systems</li>
          <li>Click "Run Tests" to see detailed test results</li>
          <li>If tests show token validation failures, the issue is in token format/storage</li>
          <li>Use "Clear All Auth" if you need to reset authentication completely</li>
          <li>Refresh the page after clearing to test persistence behavior</li>
        </ol>
      </div>
    </div>
  );
}
