'use client';

import { useEffect, useState } from 'react';

export default function AuthStorageMonitor() {
  const [storageState, setStorageState] = useState({
    authToken: null as string | null,
    supabaseSession: null as string | null,
    lastChecked: new Date().toISOString(),
  });

  const checkStorage = () => {
    if (typeof window !== 'undefined') {
      const authToken = localStorage.getItem('auth_token');
      const supabaseKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('sb-') && key.includes('auth-token')
      );
      const supabaseSession = supabaseKeys.length > 0 ? localStorage.getItem(supabaseKeys[0]) : null;
      
      setStorageState({
        authToken,
        supabaseSession,
        lastChecked: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    // Check immediately
    checkStorage();

    // Check every 2 seconds
    const interval = setInterval(checkStorage, 2000);

    // Listen for storage events from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      console.log('Storage changed:', e.key, e.newValue);
      checkStorage();
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const clearStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      checkStorage();
    }
  };

  const addTestToken = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', 'test-token-' + Date.now());
      checkStorage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white border shadow-lg rounded p-4 max-w-sm text-xs">
      <h3 className="font-bold mb-2">Auth Storage Monitor</h3>
      
      <div className="space-y-1 mb-3">
        <div>
          <strong>Auth Token:</strong> {storageState.authToken ? `${storageState.authToken.length} chars` : 'None'}
        </div>
        <div>
          <strong>Supabase:</strong> {storageState.supabaseSession ? 'Present' : 'None'}
        </div>
        <div>
          <strong>Last Check:</strong> {new Date(storageState.lastChecked).toLocaleTimeString()}
        </div>
      </div>

      <div className="space-x-2">
        <button
          onClick={checkStorage}
          className="bg-blue-500 text-white px-2 py-1 rounded text-xs"
        >
          Refresh
        </button>
        <button
          onClick={clearStorage}
          className="bg-red-500 text-white px-2 py-1 rounded text-xs"
        >
          Clear
        </button>
        <button
          onClick={addTestToken}
          className="bg-green-500 text-white px-2 py-1 rounded text-xs"
        >
          Test
        </button>
      </div>
    </div>
  );
}
