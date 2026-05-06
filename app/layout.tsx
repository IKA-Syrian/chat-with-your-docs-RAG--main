// Server component metadata
export const metadata = {
  title: 'Chat with Your Documents',
  description: 'A simple RAG application to chat with your documents',
};

// Server component
import 'three-dots/dist/three-dots.css';
import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import Providers from '@/lib/providers';
import { PropsWithChildren } from 'react';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={inter.className + " h-full"}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
