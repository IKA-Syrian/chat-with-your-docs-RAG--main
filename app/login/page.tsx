'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/api/auth';
import { toast } from '@/components/ui/use-toast';
import LayoutClient from '../layout-client';
import Messages from './messages';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        toast({
          title: 'Success',
          description: 'Account created successfully!',
        });
      } else {
        await signIn(email, password);
        toast({
          title: 'Success',
          description: 'Signed in successfully!',
        });
      }
      
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Authentication failed',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LayoutClient>
      <div className="flex-1 flex flex-col w-full items-center justify-center px-8">
        <div className="w-full max-w-md">
          <form
            className="flex flex-col w-full gap-4 text-foreground"
            onSubmit={handleSubmit}
          >
            <h1 className="text-2xl font-bold mb-4 text-center">
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </h1>
            
            <label className="text-md" htmlFor="email">
              Email
            </label>
            <input
              className="rounded-md px-4 py-2 bg-inherit border"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            
            <label className="text-md" htmlFor="password">
              Password
            </label>
            <input
              className="rounded-md px-4 py-2 bg-inherit border"
              type="password"
              name="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            <button 
              type="submit"
              disabled={loading}
              className={`rounded px-4 py-2 text-white mt-4 ${
                isSignUp 
                  ? 'bg-blue-700 hover:bg-blue-800' 
                  : 'bg-green-700 hover:bg-green-800'
              } disabled:opacity-50`}
            >
              {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </button>
            
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="border border-gray-700 rounded px-4 py-2 text-black hover:bg-gray-100"
            >
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </button>
            
            <Messages />
          </form>
        </div>
      </div>
    </LayoutClient>
  );
}
