import type { Metadata } from 'next';
import { Inter, Fraunces, JetBrains_Mono } from 'next/font/google';
import 'three-dots/dist/three-dots.css';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Providers from '@/lib/providers';

export const metadata: Metadata = {
  title: 'StudyAI',
  description: 'A focused study tool for chatting with documents, generating flashcards and quizzes, and tracking your progress.',
};

// Body — precise UI sans
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Display — variable serif for headings, gives the app personality
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['SOFT', 'opsz'],
});

// Numbers / badges / tabular data
const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`h-full ${inter.variable} ${fraunces.variable} ${mono.variable}`}
    >
      <body className="h-full font-sans bg-bg text-ink antialiased">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
