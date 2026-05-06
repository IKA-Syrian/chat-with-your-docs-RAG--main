'use client';

import Link from 'next/link';
import { PropsWithChildren, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/api/auth';
import LogoutButton from '@/components/LogoutButton';

/**
 * Top-of-page navigation. The "desk shelf" — sits high, hairline below,
 * sticky so it follows the reader. Logo is wordmark-only, set in the
 * display serif.
 */
export default function LayoutClient({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const pathname = usePathname() || '/';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NAV: Array<{ href: string; label: string }> = user
    ? [
        { href: '/files', label: 'Library' },
        { href: '/chat', label: 'Chat' },
        { href: '/explore', label: 'Explore' },
        { href: '/analytics', label: 'Analytics' },
      ]
    : [
        { href: '/explore', label: 'Explore' },
      ];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <div className="flex flex-col h-screen bg-bg text-ink">
      <header className="desk-shelf sticky top-0 z-30 flex-shrink-0">
        <div className="w-full max-w-[1400px] mx-auto flex items-center justify-between px-5 sm:px-8 lg:px-10 h-14">
          {/* Wordmark */}
          <Link
            href="/"
            className="font-display text-xl tracking-tight hover:text-accent-deep transition-colors duration-200 ease-out-expo"
          >
            Study<span className="italic font-light text-ink-soft">AI</span>
          </Link>

          {/* Desktop nav — pill links, accent underline on active */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                data-state={isActive(item.href) ? 'active' : undefined}
                className="nb-tab"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Account */}
          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <>
                <span className="text-xs text-ink-soft hidden md:block tracking-tight">
                  {user.email}
                </span>
                <LogoutButton />
              </>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-ink hover:text-accent-deep transition-colors"
              >
                Sign in
                <span aria-hidden className="ml-1.5 text-ink-faint">→</span>
              </Link>
            )}
          </div>

          {/* Mobile trigger */}
          <button
            onClick={() => setMobileMenuOpen(v => !v)}
            className="sm:hidden inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-surface-2 text-ink transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {mobileMenuOpen
                ? <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" d="M4 7h16M4 17h16" />
              }
            </svg>
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-rule bg-surface animate-fade-in-up">
            <nav className="px-4 py-3 flex flex-col gap-1">
              {NAV.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  data-state={isActive(item.href) ? 'active' : undefined}
                  className="nb-tab block py-2.5"
                >
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-rule mt-2 pt-3">
                {user ? (
                  <>
                    <div className="text-xs text-ink-faint mb-2 truncate">{user.email}</div>
                    <LogoutButton />
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="text-sm font-medium text-ink hover:text-accent-deep"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign in →
                  </Link>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
