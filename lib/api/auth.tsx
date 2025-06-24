import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { apiClient } from './client';

interface User {
  id: string;
  email: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuth: () => void;
  isAuthenticated: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
    
    // Add listener for storage events to handle changes in other tabs
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'auth_token') {
        console.log('🔄 Auth token changed in another tab, refreshing auth state');
        checkAuth();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  // Add visibility change listener to refresh auth when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && authCheckComplete) {
        console.log('🔄 Page became visible, refreshing auth state');
        checkAuth();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authCheckComplete]);  
  
  const checkAuth = async () => {
    console.log('🚀 Starting auth check...');
    
    try {
      const token = apiClient.getToken();
      console.log('🔍 Auth check - Token exists:', !!token);
      console.log('🔍 Auth check - Token length:', token?.length || 0);
      
      if (token) {
        console.log('🔑 Attempting to validate stored token...');
        try {
          const response = await apiClient.getCurrentUser();
          setUser(response.user);
          console.log('✅ Authentication successful, user:', response.user?.email || 'authenticated');
        } catch (validationError) {
          console.log('⚠️ Token validation failed:', validationError);
          
          if (validationError instanceof Error) {
            if (validationError.message === 'UNAUTHENTICATED') {
              console.log('🗑️ Token is definitely invalid, clearing auth state');
              apiClient.clearAuth();
              setUser(null);
            } else if (validationError.message === 'NETWORK_ERROR') {
              console.log('🌐 Network error during auth check, keeping token and retrying later');
              // Don't clear token for network errors, but set user to null for UI
              setUser(null);
            } else {
              console.log('❓ Unknown error during auth check, keeping token');
              setUser(null);
            }
          } else {
            console.log('❓ Unexpected error type, keeping token');
            setUser(null);
          }
        }
      } else {
        console.log('ℹ️ No token found, user not authenticated');
        setUser(null);
      }
    } catch (error) {
      console.error('💥 Unexpected error during auth check:', error);
      // Don't clear auth state for unexpected errors
      setUser(null);
    } finally {
      setLoading(false);
      setAuthCheckComplete(true);
    }
  };
  
  const refreshAuth = async () => {
    console.log('🔄 Manually refreshing auth state');
    await checkAuth();
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await apiClient.signIn(email, password);
      setUser(response.user);
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const response = await apiClient.signUp(email, password);
      setUser(response.user);
    } catch (error) {
      console.error('Sign up failed:', error);
      throw error;
    }
  };
  const signOut = async () => {
    try {
      await apiClient.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out failed:', error);
      // Still clear user state even if API call fails
      setUser(null);
    }
  };

  const clearAuth = () => {
    console.log('Clearing authentication state');
    apiClient.clearAuth();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    clearAuth,
    isAuthenticated: !!user,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
