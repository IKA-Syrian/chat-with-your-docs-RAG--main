'use client';

import Link from 'next/link';
import { PropsWithChildren } from 'react';
import { useAuth } from '@/lib/api/auth';
import LogoutButton from '@/components/LogoutButton';

export default function LayoutClient({ children }: PropsWithChildren) {
  const { user } = useAuth();
  
  return (
    <div className="flex flex-col h-screen">
      <header className="bg-slate-800 text-white flex-shrink-0 z-10">
        <div className="w-full flex justify-between px-4">
          <Link href="/" className="py-3 px-2 font-bold text-lg">
            Chat with Your Documents
          </Link>
          <div className="flex items-center">
            {/* Navigation links */}
            <div className="hidden sm:flex items-center">
              <Link
                href="/files"
                className="py-3 px-3 cursor-pointer hover:bg-slate-700 font-medium text-sm"
              >
                Files
              </Link>
              <Link
                href="/chat"
                className="py-3 px-3 cursor-pointer hover:bg-slate-700 font-medium text-sm"
              >
                Chat
              </Link>
              <Link
                href="/chat?new=true"
                className="py-3 px-3 cursor-pointer hover:bg-slate-700 font-medium text-sm"
              >
                New Chat
              </Link>
              <Link
                href="/analytics"
                className="py-3 px-3 cursor-pointer hover:bg-slate-700 font-medium text-sm"
              >
                Analytics
              </Link>
            </div>
            
            {/* User info */}
            <div className="flex items-center ml-2">
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:block text-sm px-2">
                    {user.email}
                  </span>
                  <LogoutButton />
                </div>
              ) : (
                <Link
                  href="/login"
                  className="py-3 px-3 cursor-pointer hover:bg-slate-700 font-medium text-sm"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
} 