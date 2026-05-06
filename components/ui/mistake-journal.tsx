'use client';

/**
 * Phase 3 #9 — Mistake journal tab.
 *
 * Lists `wrong_answers` rows for the current document with their source-chunk
 * excerpts. Each row supports lazy AI explanation, mark-resolved, and links
 * back to the source chunk.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, RefreshCw, Sparkles, BookOpen } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface Mistake {
  id: string;
  source_kind: 'quiz' | 'flashcard' | 'short_answer';
  question: string;
  user_answer: string | null;
  expected_answer: string | null;
  source_chunk_excerpt: string | null;
  document_id: string | null;
  document_name: string | null;
  ai_explanation: string | null;
  details: any;
  resolved: boolean;
  created_at: string;
}

interface Props {
  documentId?: string;
}

const KIND_BADGE: Record<Mistake['source_kind'], { label: string; className: string }> = {
  quiz: { label: 'Quiz', className: 'bg-purple-100 text-purple-700' },
  flashcard: { label: 'Flashcard', className: 'bg-blue-100 text-blue-700' },
  short_answer: { label: 'Short answer', className: 'bg-orange-100 text-orange-700' }
};

export default function MistakeJournal({ documentId }: Props) {
  const [items, setItems] = useState<Mistake[]>([]);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [unresolved, setUnresolved] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getMistakes({ documentId, includeResolved, limit: 100 });
      setItems(data.mistakes || []);
      setUnresolved(data.unresolved || 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/HTTP 404|HTTP 400|does not exist/i.test(msg)) setUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, includeResolved]);

  const explain = async (id: string) => {
    setBusyId(id);
    try {
      const { explanation } = await apiClient.explainMistake(id);
      setItems(list => list.map(m => m.id === id ? { ...m, ai_explanation: explanation } : m));
    } catch (err) {
      console.error('explain failed', err);
    } finally {
      setBusyId(null);
    }
  };

  const toggleResolved = async (m: Mistake) => {
    setBusyId(m.id);
    try {
      await apiClient.resolveMistake(m.id, !m.resolved);
      setItems(list => list.map(x => x.id === m.id ? { ...x, resolved: !x.resolved } : x));
      setUnresolved(n => Math.max(0, n + (m.resolved ? 1 : -1)));
    } catch (err) {
      console.error('resolve failed', err);
    } finally {
      setBusyId(null);
    }
  };

  if (unavailable) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-gray-500">
          Mistake journal isn't available yet — apply migrations 006–009 to enable it.
        </CardContent>
      </Card>
    );
  }
  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-gray-500">Loading mistakes…</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Mistake journal</h3>
          <p className="text-xs text-gray-500">
            {unresolved} unresolved · {items.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={e => setIncludeResolved(e.target.checked)}
            />
            Include resolved
          </label>
          <Button size="sm" variant="outline" onClick={reload}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-gray-500">
            🎉 No mistakes recorded yet. Get a quiz question wrong, rate a flashcard "Again", or
            score below 50% on a short-answer card to populate this list.
          </CardContent>
        </Card>
      ) : (
        items.map(m => {
          const badge = KIND_BADGE[m.source_kind];
          return (
            <Card key={m.id} className={m.resolved ? 'opacity-60' : ''}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={badge.className}>{badge.label}</Badge>
                      {m.document_name && (
                        <span className="text-xs text-gray-500 truncate">{m.document_name}</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(m.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-gray-800 whitespace-pre-wrap break-words">
                      {m.question || <span className="italic text-gray-400">(question text missing)</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={m.resolved ? 'ghost' : 'outline'}
                    disabled={busyId === m.id}
                    onClick={() => toggleResolved(m)}
                    title={m.resolved ? 'Unresolve' : 'Mark resolved'}
                  >
                    <CheckCircle className={`h-4 w-4 ${m.resolved ? 'text-green-600' : ''}`} />
                  </Button>
                </div>

                {(m.user_answer || m.expected_answer) && (
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    {m.user_answer && (
                      <div className="bg-red-50 border border-red-100 rounded p-2">
                        <div className="font-medium text-red-700 mb-0.5">Your answer</div>
                        <div className="text-gray-700 whitespace-pre-wrap break-words">{m.user_answer}</div>
                      </div>
                    )}
                    {m.expected_answer && (
                      <div className="bg-green-50 border border-green-100 rounded p-2">
                        <div className="font-medium text-green-700 mb-0.5">Correct answer</div>
                        <div className="text-gray-700 whitespace-pre-wrap break-words">{m.expected_answer}</div>
                      </div>
                    )}
                  </div>
                )}

                {m.source_chunk_excerpt && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 inline-flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> Source excerpt
                    </summary>
                    <div className="mt-1 bg-gray-50 border rounded p-2 text-gray-700 whitespace-pre-wrap">
                      {m.source_chunk_excerpt}
                    </div>
                  </details>
                )}

                {m.ai_explanation ? (
                  <div className="bg-blue-50 border border-blue-100 rounded p-2 text-xs">
                    <div className="font-medium text-blue-700 mb-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Explanation
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{m.ai_explanation}</p>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    disabled={busyId === m.id}
                    onClick={() => explain(m.id)}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {busyId === m.id ? 'Generating…' : 'Explain why'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
