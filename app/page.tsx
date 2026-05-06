import LayoutClient from './layout-client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, BookOpen, Brain, Sparkles, Network } from 'lucide-react';

/**
 * Landing — brand register.
 *
 * Editorial layout: oversized serif headline, generous whitespace, an
 * accent rule that scribes a horizontal line through the page (the only
 * saturated color above the fold).
 * Anti-references: gradient hero metric blocks, identical icon-card grids,
 * "Start free trial" SaaS energy.
 */
export default function Home() {
  return (
    <LayoutClient>
      <div className="bg-bg text-ink">
        {/* ---------- Hero ---------- */}
        <section className="relative px-5 sm:px-10 lg:px-16 pt-20 sm:pt-28 lg:pt-36 pb-24 lg:pb-36">
          <div className="max-w-6xl">
            <div className="numeral text-2xs uppercase tracking-[0.2em] text-ink-soft mb-8 flex items-center gap-3">
              <span className="inline-block w-8 h-px bg-accent" />
              StudyAI&nbsp;·&nbsp;v1
            </div>

            <h1 className="font-display text-[clamp(2.75rem,9vw,7rem)] leading-[0.92] tracking-[-0.035em] text-ink">
              Read deeper.
              <br />
              <span className="italic font-light text-ink-soft">Remember longer.</span>
            </h1>

            <p className="mt-10 max-w-xl text-lg sm:text-xl text-ink-soft leading-relaxed prose-cap">
              A study companion that turns your PDFs, slides, and lecture
              transcripts into a private library you can chat with, quiz
              yourself on, and revisit on a spaced-repetition schedule.
            </p>

            <div className="mt-12 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="ink" className="group">
                <Link href="/files">
                  Start studying
                  <ArrowUpRight className="h-4 w-4 -mr-1 transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/explore">Browse public decks</Link>
              </Button>
            </div>
          </div>

          <div
            aria-hidden
            className="absolute left-0 right-0 bottom-0 h-px bg-rule origin-left animate-rule-in"
          />
        </section>

        {/* ---------- Methodology — three columns, no card chrome ---------- */}
        <section className="px-5 sm:px-10 lg:px-16 py-20 lg:py-28">
          <div className="max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-14">
              <div className="lg:col-span-4">
                <p className="numeral text-2xs uppercase tracking-[0.2em] text-accent-deep">
                  How it works
                </p>
                <h2 className="font-display text-3xl sm:text-4xl mt-4 leading-[1.04]">
                  Three motions.
                  <br />
                  <span className="italic font-light text-ink-soft">No more, no fewer.</span>
                </h2>
              </div>

              <ol className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-10 lg:pt-3">
                <Step n="01" title="Bring it in">
                  Upload a PDF, paste a URL, or import a YouTube transcript.
                  Vision-LLM OCR catches the scanned ones.
                </Step>
                <Step n="02" title="Make it stick">
                  Auto-generate flashcards, cloze deletions, short-answer
                  prompts, and a concept map. Grade yourself; the schedule
                  takes care of the rest.
                </Step>
                <Step n="03" title="Ask hard questions">
                  Chat across one document or ten at once. Every answer
                  cites its source chunk.
                </Step>
              </ol>
            </div>
          </div>
        </section>

        <hr className="hairline" />

        {/* ---------- Capabilities — text-led, not icon-grid ---------- */}
        <section className="px-5 sm:px-10 lg:px-16 py-20 lg:py-28">
          <div className="max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-14 gap-x-10">
              <header className="lg:col-span-5">
                <p className="numeral text-2xs uppercase tracking-[0.2em] text-accent-deep">
                  Capabilities
                </p>
                <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl mt-4">
                  Built for the way
                  <br />
                  <span className="italic font-light text-ink-soft">studying actually goes.</span>
                </h2>
              </header>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-10">
                <Feature icon={<BookOpen className="h-4 w-4" />} title="Cited answers">
                  Every claim points back to a chunk on a page. No mystery,
                  no hallucinations dressed up as facts.
                </Feature>
                <Feature icon={<Brain className="h-4 w-4" />} title="Spaced repetition">
                  FSRS-4.5 scheduling. Cards you got wrong come back when
                  you&apos;re about to forget them.
                </Feature>
                <Feature icon={<Network className="h-4 w-4" />} title="Concept maps">
                  A graph of every idea in a document, with prerequisite
                  edges and weak-spot detection.
                </Feature>
                <Feature icon={<Sparkles className="h-4 w-4" />} title="Hybrid retrieval">
                  BM25 plus dense vectors, fused with reciprocal rank.
                  Finds your exact term and the related chunks too.
                </Feature>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Manifesto block ---------- */}
        <section className="px-5 sm:px-10 lg:px-16 py-24 lg:py-36 bg-surface border-y border-rule">
          <div className="max-w-3xl">
            <p className="font-display text-2xl sm:text-3xl lg:text-[2.5rem] leading-[1.18] text-ink">
              We don&apos;t believe in{' '}
              <span className="italic text-ink-soft">&ldquo;AI does it for you.&rdquo;</span>
              {' '}Studying still requires you. The tool&apos;s job is to clear
              the friction, not the work.
            </p>
            <p className="mt-10 text-sm uppercase tracking-[0.18em] numeral text-ink-soft">
              The StudyAI team
            </p>
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="px-5 sm:px-10 lg:px-16 py-24 lg:py-32">
          <div className="max-w-6xl flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl leading-[1.04]">
                Open a document.
                <br />
                <span className="italic font-light text-ink-soft">See where it takes you.</span>
              </h2>
            </div>
            <div className="flex gap-3">
              <Button asChild size="xl" variant="ink" className="group">
                <Link href="/files">
                  Get started
                  <ArrowUpRight className="h-4 w-4 -mr-1 transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </LayoutClient>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="group">
      <div className="numeral text-2xs tracking-[0.2em] text-accent-deep mb-3">{n}</div>
      <h3 className="font-display text-xl mb-2.5 leading-tight">{title}</h3>
      <p className="text-sm text-ink-soft leading-relaxed prose-cap">{children}</p>
    </li>
  );
}

function Feature({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-accent-soft text-accent-deep">
          {icon}
        </span>
        <h3 className="font-display text-lg leading-none">{title}</h3>
      </div>
      <p className="text-sm text-ink-soft leading-relaxed">{children}</p>
    </div>
  );
}
