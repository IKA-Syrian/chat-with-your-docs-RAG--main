'use client';

import Link from 'next/link';
import { PropsWithChildren, useState } from 'react';
import { useAuth } from '@/lib/api/auth';
import LogoutButton from '@/components/LogoutButton';

export default function LayoutClient({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <div className="flex flex-col h-screen">
      <header className="bg-slate-800 text-white flex-shrink-0 z-10">
        <div className="w-full flex justify-between items-center px-4">
          <Link href="/" className="py-3 px-2 font-bold text-base sm:text-lg truncate">
            Chat with Your Documents
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center">
            {user ? (
              <>
                <div className="flex items-center">
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
                  <Link
                    href="/explore"
                    className="py-3 px-3 cursor-pointer hover:bg-slate-700 font-medium text-sm"
                  >
                    Explore
                  </Link>
                </div>
                
                {/* User info */}
                <div className="flex items-center ml-2">
                  <div className="flex items-center gap-2">
                    <span className="hidden md:block text-sm px-2">
                      {user.email}
                    </span>
                    <LogoutButton />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center">
                <Link
                  href="/login"
                  className="py-3 px-3 cursor-pointer hover:bg-slate-700 font-medium text-sm"
                >
                  Login
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="sm:hidden flex items-center">
            {user ? (
              <>
                <span className="text-xs px-2 truncate max-w-24">
                  {user.email?.split('@')[0]}
                </span>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  aria-label="Toggle mobile menu"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    {mobileMenuOpen ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    )}
                  </svg>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="py-2 px-3 rounded-md hover:bg-slate-700 font-medium text-sm"
              >
                Login
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && user && (
          <div className="sm:hidden bg-slate-700 border-t border-slate-600">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link
                href="/files"
                className="block px-3 py-2 text-sm font-medium hover:bg-slate-600 rounded-md"
                onClick={() => setMobileMenuOpen(false)}
              >
                📁 Files
              </Link>
              <Link
                href="/chat"
                className="block px-3 py-2 text-sm font-medium hover:bg-slate-600 rounded-md"
                onClick={() => setMobileMenuOpen(false)}
              >
                💬 Chat
              </Link>
              <Link
                href="/chat?new=true"
                className="block px-3 py-2 text-sm font-medium hover:bg-slate-600 rounded-md"
                onClick={() => setMobileMenuOpen(false)}
              >
                ➕ New Chat
              </Link>
              <Link
                href="/analytics"
                className="block px-3 py-2 text-sm font-medium hover:bg-slate-600 rounded-md"
                onClick={() => setMobileMenuOpen(false)}
              >
                📊 Analytics
              </Link>
              <Link
                href="/explore"
                className="block px-3 py-2 text-sm font-medium hover:bg-slate-600 rounded-md"
                onClick={() => setMobileMenuOpen(false)}
              >
                🌍 Explore
              </Link>
              <div className="px-3 py-2 border-t border-slate-600 mt-2 pt-2">
                <div className="text-xs text-slate-300 mb-2">{user.email}</div>
                <LogoutButton />
              </div>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
} 