'use client';

/**
 * Phase 4 #22 — share-and-invite dialog for a single document.
 * Owner-only: opens via a "Share" button on /study/[id].
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Copy, X, Loader2, Mail, Link2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

type Permission = 'read' | 'study' | 'edit';

interface Props {
  documentId: string;
  documentName: string;
  open: boolean;
  onClose: () => void;
}

const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  read: 'View only — can read content but not study or edit',
  study: 'Read + study (track their own progress separately)',
  edit: 'Full access — can regenerate flashcards, quizzes, and summaries'
};

export default function ShareDialog({ documentId, documentName, open, onClose }: Props) {
  const [permission, setPermission] = useState<Permission>('study');
  const [emailHint, setEmailHint] = useState('');
  const [creating, setCreating] = useState(false);
  const [shares, setShares] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await apiClient.listShares(documentId);
      setShares(data.shares || []);
      setInvites(data.invites || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/HTTP 503|migration/i.test(msg)) setUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId]);

  if (!open) return null;

  const create = async () => {
    setCreating(true);
    try {
      const inv = await apiClient.createInvite(documentId, permission, emailHint || undefined);
      setEmailHint('');
      try {
        await navigator.clipboard.writeText(inv.url);
        toast({ title: 'Invite link created', description: 'Copied to clipboard. Share it with anyone.' });
      } catch {
        toast({ title: 'Invite link created', description: inv.url });
      }
      reload();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to create invite',
        description: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setCreating(false);
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Copied' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy', description: url });
    }
  };

  const cancel = async (token: string) => {
    try {
      await apiClient.cancelInvite(documentId, token);
      reload();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Cancel failed', description: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const revoke = async (userId: string) => {
    try {
      await apiClient.revokeShare(documentId, userId);
      reload();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Revoke failed', description: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Share document</h3>
              <p className="text-xs text-gray-500 truncate max-w-sm">{documentName}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {unavailable ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Sharing isn't available yet — apply migration 011.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">Permission</label>
                <div className="flex gap-1">
                  {(['read', 'study', 'edit'] as Permission[]).map(p => (
                    <button
                      key={p}
                      onClick={() => setPermission(p)}
                      className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                        permission === p
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500">{PERMISSION_DESCRIPTIONS[permission]}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Recipient hint (optional)
                </label>
                <Input
                  type="text"
                  placeholder="alice@example.com (just a label)"
                  value={emailHint}
                  onChange={(e) => setEmailHint(e.target.value)}
                  disabled={creating}
                  className="text-sm"
                />
                <Button onClick={create} disabled={creating} className="w-full">
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                  Generate invite link
                </Button>
              </div>

              {/* Outstanding invites */}
              {invites.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <h4 className="text-xs font-medium text-gray-700">Outstanding invites</h4>
                  {invites.map(inv => (
                    <div key={inv.token} className="flex items-center gap-2 bg-gray-50 rounded p-2 text-xs">
                      <span className="font-mono text-gray-700 flex-1 truncate" title={inv.url}>
                        {inv.url}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{inv.permission}</span>
                      <button onClick={() => copyUrl(inv.url)} className="text-gray-500 hover:text-blue-600" title="Copy">
                        <Copy className="h-3 w-3" />
                      </button>
                      <button onClick={() => cancel(inv.token)} className="text-gray-500 hover:text-red-600" title="Cancel">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Active grants */}
              {shares.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <h4 className="text-xs font-medium text-gray-700">People with access ({shares.length})</h4>
                  {shares.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded p-2 text-xs">
                      <span className="font-mono text-gray-700 flex-1 truncate">{s.shared_with_user_id}</span>
                      <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">{s.permission}</span>
                      <button onClick={() => revoke(s.shared_with_user_id)} className="text-gray-500 hover:text-red-600" title="Revoke">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!loading && shares.length === 0 && invites.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No active shares or invites yet.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
