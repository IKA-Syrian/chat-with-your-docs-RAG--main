'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  exportFlashcardsCSV,
  exportFlashcardsAnki,
  exportFlashcardsMarkdown,
  exportSummaryMarkdown,
  exportQuizMarkdown,
  exportQuizPDF,
  type FlashcardLike,
  type QuizQuestionLike
} from '@/lib/export';

interface ExportMenuProps {
  baseName: string;
  summary?: unknown;
  flashcards?: FlashcardLike[];
  quiz?: { questions?: QuizQuestionLike[] } | QuizQuestionLike[];
}

export default function ExportMenu({ baseName, summary, flashcards = [], quiz }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hasFlashcards = (flashcards?.length || 0) > 0;
  const hasSummary = !!summary;
  const hasQuiz = Array.isArray(quiz)
    ? quiz.length > 0
    : !!(quiz?.questions && quiz.questions.length > 0);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative flex justify-end">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-64 bg-white border rounded-md shadow-lg py-1 text-sm">
          <Section label="Flashcards" disabled={!hasFlashcards}>
            <Item disabled={!hasFlashcards} onClick={() => { exportFlashcardsAnki(flashcards, baseName); close(); }}>
              Anki (.tsv)
            </Item>
            <Item disabled={!hasFlashcards} onClick={() => { exportFlashcardsCSV(flashcards, baseName); close(); }}>
              CSV
            </Item>
            <Item disabled={!hasFlashcards} onClick={() => { exportFlashcardsMarkdown(flashcards, baseName); close(); }}>
              Markdown
            </Item>
          </Section>

          <Section label="Summary" disabled={!hasSummary}>
            <Item disabled={!hasSummary} onClick={() => { exportSummaryMarkdown(summary, baseName); close(); }}>
              Markdown
            </Item>
          </Section>

          <Section label="Quiz" disabled={!hasQuiz}>
            <Item disabled={!hasQuiz} onClick={() => { exportQuizPDF(quiz, baseName, { withAnswers: true }); close(); }}>
              PDF (with answers)
            </Item>
            <Item disabled={!hasQuiz} onClick={() => { exportQuizPDF(quiz, baseName, { withAnswers: false }); close(); }}>
              PDF (questions only)
            </Item>
            <Item disabled={!hasQuiz} onClick={() => { exportQuizMarkdown(quiz, baseName, { withAnswers: true }); close(); }}>
              Markdown (with answers)
            </Item>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ label, disabled, children }: { label: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div className="px-1 py-1">
      <div className={`px-2 py-1 text-xs font-medium ${disabled ? 'text-gray-300' : 'text-gray-500'}`}>
        {label}{disabled && <span className="ml-2 italic">(none)</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Item({
  onClick,
  disabled,
  children
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-1.5 rounded ${
        disabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-800'
      }`}
    >
      {children}
    </button>
  );
}
