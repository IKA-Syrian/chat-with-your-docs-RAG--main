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
  card_type?: 'basic' | 'cloze' | 'short_answer';
  cloze_text?: string | null;
  expected_answer?: string | null;
  review: null | { due_at: string; reps: number };
}

/** Phase 3 #7 — render Anki-style cloze format with blanks. */
function renderCloze(text: string, reveal: boolean) {
  // Strip optional hint after the "::". Example: {{c1::Paris::capital city}}
  const re = /\{\{c\d+::([^}|:]+)(?:::[^}]+)?\}\}/g;
  if (reveal) return text.replace(re, (_, ans) => `**${ans}**`);
  return text.replace(re, () => '_____');
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
  const cardType = current?.card_type || 'basic';
  const [shortAnswerInput, setShortAnswerInput] = useState('');
  const [shortAnswerResult, setShortAnswerResult] = useState<null | {
    score: number; rating_suggested: 1 | 2 | 3 | 4; feedback: string;
    missing_keywords: string[]; matched_keywords: string[];
  }>(null);

  // Reset per-card transient state whenever the head of the queue changes.
  useEffect(() => {
    setShortAnswerInput('');
    setShortAnswerResult(null);
  }, [current?.id]);

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

  const submitShortAnswer = async () => {
    if (!current || submitting || !shortAnswerInput.trim()) return;
    setSubmitting(true);
    try {
      const result = await apiClient.gradeShortAnswer(current.id, shortAnswerInput);
      setShortAnswerResult(result);
      setShowBack(true);
    } catch (err) {
      console.error('Short-answer grading failed:', err);
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

      {cardType === 'cloze' && current!.cloze_text ? (
        // CLOZE — show text with blanks; tap to reveal answers.
        <Card className="min-h-[180px] cursor-pointer" onClick={() => setShowBack(v => !v)}>
          <CardContent className="h-full flex items-center justify-center p-6">
            <div className="text-center w-full">
              <p className="text-xs uppercase tracking-wide text-purple-600 mb-2">Cloze</p>
              <div className="text-lg text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                {/* Use simple **bold** rendering for revealed clozes */}
                {renderCloze(current!.cloze_text, showBack).split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                  /^\*\*[^*]+\*\*$/.test(part)
                    ? <strong key={i} className="text-blue-700">{part.slice(2, -2)}</strong>
                    : <span key={i}>{part}</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                {showBack ? 'Rate your recall below' : 'Tap or press Space to reveal'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : cardType === 'short_answer' ? (
        // SHORT-ANSWER — input box; submit grades via LLM.
        <Card className="min-h-[180px]">
          <CardContent className="p-6 space-y-3">
            <p className="text-xs uppercase tracking-wide text-orange-600">Short answer</p>
            <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
              {current!.front}
            </div>
            <textarea
              value={shortAnswerInput}
              onChange={e => setShortAnswerInput(e.target.value)}
              disabled={submitting || !!shortAnswerResult}
              placeholder="Type your answer…"
              className="w-full min-h-[80px] border rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {!shortAnswerResult ? (
              <Button
                onClick={submitShortAnswer}
                disabled={submitting || !shortAnswerInput.trim()}
                className="w-full"
              >
                {submitting ? 'Grading…' : 'Submit answer'}
              </Button>
            ) : (
              <div className={`p-3 rounded text-sm ${
                shortAnswerResult.score >= 0.7 ? 'bg-green-50 border border-green-200' :
                shortAnswerResult.score >= 0.4 ? 'bg-yellow-50 border border-yellow-200' :
                'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">Score: {(shortAnswerResult.score * 100).toFixed(0)}%</span>
                  <span className="text-xs text-gray-500">Suggests: {RATING_LABELS[shortAnswerResult.rating_suggested - 1]?.label}</span>
                </div>
                <p className="text-gray-700">{shortAnswerResult.feedback}</p>
                {shortAnswerResult.missing_keywords?.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Missing: {shortAnswerResult.missing_keywords.join(', ')}
                  </p>
                )}
                <details className="mt-2 text-xs text-gray-600">
                  <summary className="cursor-pointer">Show model answer</summary>
                  <p className="mt-1 whitespace-pre-wrap">{current!.expected_answer || current!.back}</p>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        // BASIC — original front/back flip card.
        <Card className="min-h-[180px] cursor-pointer" onClick={() => setShowBack(v => !v)}>
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
      )}

      <Progress
        value={initialTotal === 0 ? 0 : ((initialTotal - cards.length) / initialTotal) * 100}
      />

      <div className="grid grid-cols-4 gap-2">
        {RATING_LABELS.map(r => {
          const enabled = cardType === 'short_answer' ? !!shortAnswerResult : showBack;
          return (
            <Button
              key={r.rating}
              disabled={!enabled || submitting}
              onClick={() => grade(r.rating)}
              className={r.color + ' disabled:opacity-40'}
            >
              <span className="font-semibold">{r.label}</span>
              <span className="ml-2 text-xs opacity-80">[{r.key}]</span>
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 text-center">
        Shortcuts: Space flip · 1 Again · 2 Hard · 3 Good · 4 Easy
      </p>
    </div>
  );
}
