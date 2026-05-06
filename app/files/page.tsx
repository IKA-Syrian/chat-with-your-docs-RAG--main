'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/api/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Upload, BookOpen, Loader2, MessageSquare, GraduationCap,
  FileText, Trash2, Link2, ArrowUpRight, Plus, FilePlus2, Sparkles
} from 'lucide-react';
import LayoutClient from '../layout-client';
import { useSessionTracking } from '@/lib/hooks/use-session-tracking';

/**
 * Library — product register.
 *
 * Layout intent: an editorial table of contents, not a SaaS dashboard.
 * - Upload + URL import sit side-by-side as TWO simple inputs (no card chrome).
 * - Documents render as a hairline-separated list, not a card grid. The
 *   filename is the typographic anchor; metadata sits to the right in mono.
 * - Stats are footer-line text, not the standard "big number" cliche.
 */
export default function FilesPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  const { recordActivity } = useSessionTracking({ activityType: 'browse', autoStart: true });

  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => apiClient.getDocuments(),
    enabled: isAuthenticated,
  });

  const documents = data?.documents || [];
  const uniqueDocuments = documents.length > 0
    ? Array.from(new Map(documents.map((d: any) => [d.id, d])).values())
    : [];

  const totalDocuments = uniqueDocuments.length;
  const documentsWithEducationalContent = uniqueDocuments.filter((d: any) => d.educational_content_generated).length;

  // ----- Mutations -----
  const processMutation = useMutation({
    mutationFn: (id: string) => apiClient.processDocument(id),
    onSuccess: (_d, id) => {
      toast({ title: 'Processing started', description: 'Your document is being analyzed.' });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      router.push(`/chat?document_id=${id}`);
    },
    onError: (e) => toast({ variant: 'destructive', title: 'Processing failed', description: e instanceof Error ? e.message : 'Unknown error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteDocument(id),
    onSuccess: () => {
      toast({ title: 'Deleted', description: 'Document removed from your library.' });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => toast({ variant: 'destructive', title: 'Delete failed', description: e instanceof Error ? e.message : 'Unknown error' }),
  });

  // ----- Handlers -----
  const handleImportUrl = async (event: React.FormEvent) => {
    event.preventDefault();
    const url = importUrl.trim();
    if (!url || importing) return;
    setImporting(true);
    try {
      const r = await apiClient.ingestFromUrl(url);
      toast({ title: 'Imported', description: `${r.source === 'youtube' ? 'YouTube transcript' : 'Web page'} added: ${r.name}` });
      setImportUrl('');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Import failed', description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    recordActivity('browse');
    try {
      const r = await apiClient.uploadDocument(file);
      toast({ title: 'Uploaded', description: `${file.name} added to your library.` });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      if (r?.document?.id) processMutation.mutate(r.document.id);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Upload failed', description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setUploading(false);
    }
  };

  const fileTypeLabel = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext) return 'doc';
    if (['pdf', 'pptx', 'ppt', 'docx', 'md', 'txt', 'html'].includes(ext)) return ext;
    if (ext === 'youtube') return 'yt';
    return ext.slice(0, 4);
  };

  if (isLoading) {
    return (
      <LayoutClient>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
        </div>
      </LayoutClient>
    );
  }

  return (
    <LayoutClient>
      <div className="bg-bg text-ink min-h-full">
        {/* ---------- Page header ---------- */}
        <header className="px-5 sm:px-10 lg:px-16 pt-12 sm:pt-16 pb-8 max-w-6xl">
          <div className="numeral text-2xs uppercase tracking-[0.2em] text-ink-soft mb-4 flex items-center gap-3">
            <span className="inline-block w-6 h-px bg-accent" />
            Your library
          </div>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
            {totalDocuments === 0 ? (
              <>
                Begin with one document.
                <br />
                <span className="italic font-light text-ink-soft">The rest follows.</span>
              </>
            ) : (
              <>
                <span className="numeral">{totalDocuments}</span>{' '}
                document{totalDocuments === 1 ? '' : 's'}.
                <br />
                <span className="italic font-light text-ink-soft">
                  {documentsWithEducationalContent} ready to study.
                </span>
              </>
            )}
          </h1>
        </header>

        {/* ---------- Add new — two clear inputs, no card stacking ---------- */}
        <section className="px-5 sm:px-10 lg:px-16 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-rule rounded-xl overflow-hidden border border-rule">
            {/* Upload */}
            <div className="bg-surface p-6 sm:p-8 group">
              <div className="flex items-start gap-3 mb-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-accent-deep">
                  <FilePlus2 className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-lg leading-none">Upload a file</h2>
                  <p className="text-xs text-ink-soft mt-1">PDF, PPT, DOCX, MD, or plain text</p>
                </div>
              </div>
              <label className="block">
                <div className="border border-dashed border-rule rounded-md px-4 py-6 text-center bg-bg hover:border-accent hover:bg-accent-soft/40 transition-colors duration-300 ease-out-expo cursor-pointer">
                  <Upload className="h-5 w-5 mx-auto text-ink-faint group-hover:text-accent-deep transition-colors mb-2" />
                  <p className="text-sm text-ink-soft">
                    {uploading
                      ? 'Uploading and processing…'
                      : 'Click to choose a file'}
                  </p>
                </div>
                <input
                  type="file"
                  className="sr-only"
                  accept=".md,.txt,.pdf,.ppt,.pptx,text/markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>

            {/* URL */}
            <div className="bg-surface p-6 sm:p-8">
              <div className="flex items-start gap-3 mb-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-accent-deep">
                  <Link2 className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-lg leading-none">Import from URL</h2>
                  <p className="text-xs text-ink-soft mt-1">Web pages or YouTube with captions</p>
                </div>
              </div>
              <form onSubmit={handleImportUrl} className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="url"
                  placeholder="https://… or youtube.com/watch?v=…"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  disabled={importing}
                  className="flex-1"
                />
                <Button type="submit" disabled={importing || !importUrl.trim()}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                  {importing ? 'Importing' : 'Import'}
                </Button>
              </form>
            </div>
          </div>
        </section>

        {/* ---------- Documents list ---------- */}
        <section className="px-5 sm:px-10 lg:px-16 max-w-6xl mt-16 sm:mt-20 pb-24">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-display text-2xl">Documents</h2>
            <p className="numeral text-2xs uppercase tracking-[0.18em] text-ink-faint">
              {totalDocuments} total · {documentsWithEducationalContent} ready
            </p>
          </div>

          {uniqueDocuments.length === 0 ? (
            <div className="border border-rule rounded-lg bg-surface px-6 py-16 text-center">
              <BookOpen className="h-6 w-6 mx-auto text-ink-faint mb-3" />
              <p className="font-display text-xl mb-1">A blank shelf.</p>
              <p className="text-sm text-ink-soft">
                Upload a file or import a URL to start your library.
              </p>
            </div>
          ) : (
            <ul className="border-t border-rule">
              {uniqueDocuments.map((doc: any) => (
                <li
                  key={doc.id}
                  className="group border-b border-rule grid grid-cols-[auto_1fr_auto] gap-4 sm:gap-6 items-center py-4 sm:py-5 hover:bg-surface-2/50 transition-colors duration-200 ease-out-expo px-2 -mx-2 rounded"
                >
                  {/* File-type token */}
                  <div className="numeral text-2xs uppercase tracking-[0.16em] text-ink-faint w-12 text-center sm:text-left">
                    {fileTypeLabel(doc.name)}
                  </div>

                  {/* Title + meta */}
                  <button
                    onClick={() => router.push(`/chat?document_id=${doc.id}`)}
                    className="text-left min-w-0 group/title"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg leading-tight truncate group-hover/title:text-accent-deep transition-colors">
                        {doc.name}
                      </span>
                      {doc.educational_content_generated ? (
                        <span className="pill pill-good shrink-0">Ready</span>
                      ) : doc.processed ? (
                        <span className="pill pill-mute shrink-0">Indexed</span>
                      ) : (
                        <span className="pill pill-warn shrink-0">Pending</span>
                      )}
                    </div>
                    <div className="text-xs text-ink-faint mt-0.5 numeral tracking-tight">
                      {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </button>

                  {/* Actions — visible on hover desktop, always visible on mobile */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 sm:opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 ease-out-expo">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/study/${doc.id}`)}
                      className="hidden sm:inline-flex"
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Study</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/chat?document_id=${doc.id}`)}
                      className="hidden sm:inline-flex"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Chat</span>
                    </Button>
                    {!doc.educational_content_generated && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => processMutation.mutate(doc.id)}
                        disabled={processMutation.isPending}
                        title="Generate study materials"
                      >
                        {processMutation.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Sparkles className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(doc.id)}
                      disabled={deleteMutation.isPending}
                      className="text-ink-faint hover:text-bad hover:bg-bad-soft"
                      title="Delete"
                    >
                      {deleteMutation.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </LayoutClient>
  );
}
