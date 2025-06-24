'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useMemo } from 'react';
import { AuthProvider } from './api/auth';
import TokenMismatchFix from '@/components/TokenMismatchFix';

export default function Providers({ children }: PropsWithChildren<{}>) {
  const queryClient = useMemo(() => new QueryClient(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TokenMismatchFix />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
