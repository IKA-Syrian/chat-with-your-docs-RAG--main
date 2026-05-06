'use client';

/**
 * Phase 4 #23 — public deck library browser at /explore.
 *
 * Anyone (signed-out included) can browse. Authenticated users can upvote
 * and fork. Forking copies the deck into the user's account and redirects
 * them to /study/[newId].
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Heart, GitFork, Search, Loader2, Globe } from 'lucide-react';
import LayoutClient from '../layout-client';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/api/auth';

interface Deck {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  upvotes_count: number;
  published_at: string | null;
}

export default function ExplorePage() {
  const router = useRouter();
  const params = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [tag, setTag] = useState(params?.get('tag') || '');
  const [q, setQ] = useState(params?.get('q') || '');
  const [sort, setSort] = useState<'upvotes' | 'recent'>((params?.get('sort') as any) || 'upvotes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forking, setForking] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.exploreDecks({ tag: tag || undefined, q: q || undefined, sort, limit: 24 });
      setDecks(data.decks || []);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    reload();
  };

  const upvote = async (id: string) => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/explore');
      return;
    }
    try {
      await apiClient.upvoteDeck(id);
      setDecks(list => list.map(d => d.id === id ? { ...d, upvotes_count: d.upvotes_count + 1 } : d));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Upvote failed', description: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const fork = async (id: string) => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/explore');
      return;
    }
    setForking(id);
    try {
      const { document_id } = await apiClient.forkDeck(id);
      toast({ title: 'Deck forked', description: 'A copy is now in your library.' });
      router.push(`/study/${document_id}`);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Fork failed',
        description: err instanceof Error ? err.message : 'Unknown error'
      });
      setForking(null);
    }
  };

  return (
    <LayoutClient>
      <div className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-6xl mx-auto px-4">
          <header className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-gray-900">
              <Globe className="h-6 w-6 text-blue-600" />
              Explore
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Public decks shared by the community. Upvote what's useful and fork to study.
            </p>
          </header>

          <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search published decks…"
                className="pl-9"
              />
            </div>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Tag filter"
              className="sm:w-40"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'upvotes' | 'recent')}
              className="rounded border bg-background px-3 py-2 text-sm"
            >
              <option value="upvotes">Top voted</option>
              <option value="recent">Most recent</option>
            </select>
            <Button type="submit">Search</Button>
          </form>

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : error ? (
            <Card><CardContent className="p-6 text-center text-red-600">{error}</CardContent></Card>
          ) : decks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No decks match. Try a different search or tag.
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Showing {decks.length}{total != null && total > decks.length ? ` of ${total}` : ''} decks
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {decks.map(d => (
                  <Card key={d.id} className="flex flex-col">
                    <CardContent className="p-4 flex-1 flex flex-col gap-2">
                      <h3 className="font-semibold text-gray-900 line-clamp-2">{d.title}</h3>
                      {d.description && (
                        <p className="text-sm text-gray-600 line-clamp-3">{d.description}</p>
                      )}
                      {d.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {d.tags.slice(0, 5).map(t => (
                            <button
                              key={t}
                              onClick={() => { setTag(t); reload(); }}
                              className="px-2 py-0.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs"
                            >
                              #{t}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="mt-auto pt-3 flex items-center justify-between border-t">
                        <button
                          onClick={() => upvote(d.id)}
                          className="flex items-center gap-1 text-xs text-gray-600 hover:text-pink-600"
                        >
                          <Heart className="h-3.5 w-3.5" />
                          {d.upvotes_count}
                        </button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={forking === d.id}
                          onClick={() => fork(d.id)}
                          className="flex items-center gap-1"
                        >
                          {forking === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitFork className="h-3 w-3" />}
                          Fork
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </LayoutClient>
  );
}
