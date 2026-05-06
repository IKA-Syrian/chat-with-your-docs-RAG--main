'use client';

/**
 * Phase 2 #6 — FSRS review queue.
 *
 * Fetches /flashcards/due, walks the user through them one at a time, and
 * sends ratings back to /flashcards/:id/review. Self-contained: silently
 * hides itself if the backend isn't ready (i.e. migration not yet run).
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/lib/api/client';
import { useKeyboardShortcuts, type Shortcut } from '@/lib/hooks/use-keyboard-shortcuts';

interface DueCard {
  id: string;
  document_id: string;
  front: string;
  back: string;
  card_index: number | null;
  review: null | { due_at: string; reps: number };
}

interface Props {
  documentId?: string;
}

const RATING_LABELS: Array<{ rating: 1 | 2 | 3 | 4; label: string; key: string; color: string }> = [
  { rating: 1, label: 'Again', key: '1', color: 'bg-red-500 hover:bg-red-600 text-white' },
  { rating: 2, label: 'Hard',  key: '2', color: 'bg-orange-500 hover:bg-orange-600 text-white' },
  { rating: 3, label: 'Good',  key: '3', color: 'bg-green-500 hover:bg-green-600 text-white' },
  { rating: 4, label: 'Easy',  key: '4', color: 'bg-blue-500 hover:bg-blue-600 text-white' }
];

export default function ReviewQueue({ documentId }: Props) {
  const [cards, setCards] = useState<DueCard[]>([]);
  const [initialTotal, setInitialTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getDueFlashcards({ documentId, limit: 50 });
      const next = data.cards || [];
      setCards(next);
      setInitialTotal(next.length);
      setShowBack(false);
    } catch (err) {
      // 404 / table not present → hide ourselves silently.
      const msg = err instanceof Error ? err.message : '';
      if (/not found|does not exist|HTTP 404|HTTP 400/i.test(msg)) {
        setUnavailable(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const current = cards[0];

  const grade = async (rating: 1 | 2 | 3 | 4) => {
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.reviewFlashcard(current.id, rating);
      // Pop the card and reset to "front" view.
      setCards(rest => rest.slice(1));
      setShowBack(false);
    } catch (err) {
      console.error('Failed to record review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const shortcuts: Shortcut[] = [
    { key: ' ', description: 'Reveal answer', handler: () => current && setShowBack(v => !v) },
    ...RATING_LABELS.map<Shortcut>(r => ({
      key: r.key,
      description: `Rate: ${r.label}`,
      handler: () => showBack && grade(r.rating)
    }))
  ];
  useKeyboardShortcuts(shortcuts, !!current);

  if (unavailable) return null;
  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-gray-500 text-sm">
          Loading review queue…
        </CardContent>
      </Card>
    );
  }
  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <div className="text-gray-700 font-medium">🎉 No cards due right now</div>
          <div className="text-xs text-gray-500 mt-1">
            New cards from this document will appear here once they exist in your library.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Review queue</h3>
        <span className="text-xs text-gray-500">{cards.length} card{cards.length === 1 ? '' : 's'} due</span>
      </div>

      <Card
        className="min-h-[180px] cursor-pointer"
        onClick={() => setShowBack(v => !v)}
      >
        <CardContent className="h-full flex items-center justify-center p-6">
          <div className="text-center w-full">
            <p className="text-xs uppercase tracking-wide text-blue-600 mb-2">
              {showBack ? 'Answer' : 'Question'}
            </p>
            <div className="text-lg text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
              {showBack ? current!.back : current!.front}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {showBack ? 'Rate your recall below' : 'Tap or press Space to reveal'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Progress
        value={initialTotal === 0 ? 0 : ((initialTotal - cards.length) / initialTotal) * 100}
      />

      <div className="grid grid-cols-4 gap-2">
        {RATING_LABELS.map(r => (
          <Button
            key={r.rating}
            disabled={!showBack || submitting}
            onClick={() => grade(r.rating)}
            className={r.color + ' disabled:opacity-40'}
          >
            <span className="font-semibold">{r.label}</span>
            <span className="ml-2 text-xs opacity-80">[{r.key}]</span>
          </Button>
        ))}
      </div>
      <p className="text-xs text-gray-500 text-center">
        Shortcuts: Space flip · 1 Again · 2 Hard · 3 Good · 4 Easy
      </p>
    </div>
  );
}
