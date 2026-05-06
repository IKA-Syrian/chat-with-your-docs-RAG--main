'use client';

/**
 * Phase 4 #23 — publish-to-public-library dialog.
 *
 * Two-stage flow: shows current state (published / not), lets owner edit
 * title / description / tags, and explicitly opts in. NEVER auto-publishes.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Globe, X, Loader2, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface Props {
  documentId: string;
  documentName: string;
  open: boolean;
  onClose: () => void;
}

export default function PublishDialog({ documentId, documentName, open, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  // Mirror the server-side normalization so the pills shown match what gets stored.
  const tags = tagsInput
    .split(',')
    .map(t =>
      t.toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 30)
    )
    .filter(Boolean)
    .slice(0, 8);

  const publish = async () => {
    setBusy(true);
    try {
      await apiClient.publishDocument(documentId, {
        title: title || documentName,
        description: description || undefined,
        tags
      });
      toast({ title: 'Deck published', description: 'It now appears on /explore.' });
      onClose();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Publish failed',
        description: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">Publish to public library</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 flex gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              Anyone can browse, upvote, and <strong>fork</strong> a published deck. Don't publish
              decks made from copyrighted material you don't own. You can unpublish anytime.
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={documentName}
              maxLength={200}
              className="text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this deck good for? Course, level, key topics…"
              maxLength={1000}
              rows={3}
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="text-xs text-gray-400 text-right">{description.length}/1000</div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Tags (comma-separated, max 8)</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="biology, ap-bio, mcat"
              className="text-sm"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">{t}</span>
                ))}
              </div>
            )}
          </div>

          {!confirming ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
              <Button onClick={() => setConfirming(true)} className="flex-1">Continue</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                Confirm: publish <strong>"{title || documentName}"</strong> to the public library?
                This makes the document, its sections, and its flashcards readable by anyone (including
                signed-out visitors) until you unpublish.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy} className="flex-1">
                  Back
                </Button>
                <Button onClick={publish} disabled={busy} className="flex-1">
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
                  Publish
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
