'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/api/auth';
import { apiClient } from '@/lib/api/client';

/**
 * TokenMismatchFix component
 * 
 * This component helps detect and fix token issues that might occur during page refreshes
 * or when tokens are lost from localStorage.
 */
export default function TokenMismatchFix() {
  const { user, loading, refreshAuth } = useAuth();

  useEffect(() => {
    // Check if there's a token in sessionStorage but not in localStorage (indicates localStorage was cleared)
    const checkAndFixTokens = () => {
      try {
        const localStorageToken = localStorage.getItem('auth_token');
        const sessionStorageToken = sessionStorage.getItem('auth_token_backup');
        
        if (!localStorageToken && sessionStorageToken) {
          console.log('🛠️ TokenMismatchFix: Detected missing localStorage token with backup available');
          localStorage.setItem('auth_token', sessionStorageToken);
          console.log('🛠️ TokenMismatchFix: Restored token from backup');
          
          // Force auth refresh
          refreshAuth();
        }
      } catch (error) {
        console.error('Error in TokenMismatchFix:', error);
      }
    };
    
    // Run on mount
    checkAndFixTokens();
    
    // Set up periodic checks
    const intervalId = setInterval(checkAndFixTokens, 5000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [refreshAuth]);
  
  // This component doesn't render anything
  return null;
}
