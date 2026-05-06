'use client';

/**
 * /explore — public deck library.
 * Editorial list, not a deck-card grid. Each row is a "spine on a shelf":
 * title in display serif, tags inline, upvote count in mono on the right.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Heart, GitFork, Search, Loader2, Globe, ArrowUpRight } from 'lucide-react';
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
      const data = await apiClient.exploreDecks({ tag: tag || undefined, q: q || undefined, sort, limit: 30 });
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
    if (!isAuthenticated) { router.push('/login?redirect=/explore'); return; }
    try {
      await apiClient.upvoteDeck(id);
      setDecks(list => list.map(d => d.id === id ? { ...d, upvotes_count: d.upvotes_count + 1 } : d));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Upvote failed', description: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const fork = async (id: string) => {
    if (!isAuthenticated) { router.push('/login?redirect=/explore'); return; }
    setForking(id);
    try {
      const { document_id } = await apiClient.forkDeck(id);
      toast({ title: 'Forked', description: 'A copy is now in your library.' });
      router.push(`/study/${document_id}`);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Fork failed', description: err instanceof Error ? err.message : 'Unknown error' });
      setForking(null);
    }
  };

  return (
    <LayoutClient>
      <div className="bg-bg text-ink min-h-full">
        {/* ---------- Header ---------- */}
        <header className="px-5 sm:px-10 lg:px-16 pt-12 sm:pt-16 pb-10 max-w-6xl">
          <div className="numeral text-2xs uppercase tracking-[0.2em] text-ink-soft mb-4 flex items-center gap-3">
            <span className="inline-block w-6 h-px bg-accent" />
            Public library
            <Globe className="h-3 w-3 text-accent-deep" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.04]">
            What others are{' '}
            <span className="italic font-light text-ink-soft">studying.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft prose-cap">
            Decks shared by the community. Upvote what's useful, fork to add a
            personal copy to your library, then build your own schedule on top.
          </p>
        </header>

        {/* ---------- Search bar ---------- */}
        <section className="px-5 sm:px-10 lg:px-16 max-w-6xl pb-8 border-b border-rule">
          <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-2 items-stretch">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint pointer-events-none" />
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
              placeholder="#tag"
              className="sm:w-44 numeral"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'upvotes' | 'recent')}
              className="rounded-md border border-rule bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-focus transition-[border-color,box-shadow]"
            >
              <option value="upvotes">Top voted</option>
              <option value="recent">Most recent</option>
            </select>
            <Button type="submit">Search</Button>
          </form>
        </section>

        {/* ---------- Results ---------- */}
        <section className="px-5 sm:px-10 lg:px-16 max-w-6xl py-10 pb-24">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
            </div>
          ) : error ? (
            <p className="text-bad text-sm">{error}</p>
          ) : decks.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-display text-2xl mb-1">Nothing matches.</p>
              <p className="text-sm text-ink-soft">Try a different search or clear your filters.</p>
            </div>
          ) : (
            <>
              <p className="numeral text-2xs uppercase tracking-[0.18em] text-ink-faint mb-4">
                {decks.length}{total != null && total > decks.length ? ` of ${total}` : ''} decks
              </p>
              <ul>
                {decks.map((d, i) => (
                  <li
                    key={d.id}
                    className="group border-b border-rule py-6 sm:py-7 grid grid-cols-[auto_1fr_auto] gap-4 sm:gap-8 items-baseline"
                  >
                    {/* Index numeral, left margin */}
                    <div className="numeral text-2xs text-ink-faint pt-1 w-8">
                      {String(i + 1).padStart(2, '0')}
                    </div>

                    {/* Body */}
                    <div className="min-w-0">
                      <button
                        onClick={() => fork(d.id)}
                        className="text-left group/title"
                      >
                        <h2 className="font-display text-2xl sm:text-3xl leading-[1.08] tracking-tight text-ink group-hover/title:text-accent-deep transition-colors duration-300 ease-out-expo">
                          {d.title}
                          <ArrowUpRight className="inline h-5 w-5 ml-1 -mt-1 text-ink-faint group-hover/title:text-accent-deep group-hover/title:translate-x-0.5 group-hover/title:-translate-y-0.5 transition-transform duration-300 ease-out-expo" />
                        </h2>
                      </button>
                      {d.description && (
                        <p className="mt-2 text-sm sm:text-base text-ink-soft prose-cap leading-relaxed">
                          {d.description}
                        </p>
                      )}
                      {d.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {d.tags.slice(0, 6).map(t => (
                            <button
                              key={t}
                              onClick={() => { setTag(t); reload(); }}
                              className="numeral text-2xs uppercase tracking-[0.08em] text-ink-soft hover:text-accent-deep transition-colors"
                            >
                              #{t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right rail — upvote + fork */}
                    <div className="flex items-center gap-3 sm:gap-4 pt-1">
                      <button
                        onClick={() => upvote(d.id)}
                        className="flex items-center gap-1.5 text-ink-soft hover:text-accent-deep transition-colors duration-200 ease-out-expo"
                        title="Upvote"
                      >
                        <Heart className="h-4 w-4" />
                        <span className="numeral text-sm tabular-nums">{d.upvotes_count}</span>
                      </button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={forking === d.id}
                        onClick={() => fork(d.id)}
                      >
                        {forking === d.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <GitFork className="h-3 w-3" />}
                        Fork
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </LayoutClient>
  );
}
