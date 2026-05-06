'use client';

/**
 * Phase 4 #22 — invite redemption page.
 *
 * The recipient lands here from a shared invite link. We never auto-redeem
 * on GET (that would let referrer-leaked URLs auto-grant access); the user
 * must click "Accept" so redemption is an explicit POST.
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import LayoutClient from '../../layout-client';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/api/auth';

export default function InviteRedeemPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const token = (params?.token as string) || '';
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [permission, setPermission] = useState<string | null>(null);

  const accept = async () => {
    if (!isAuthenticated) {
      // Bounce through login — preserve return path.
      router.push(`/login?redirect=/invites/${encodeURIComponent(token)}`);
      return;
    }
    setStatus('pending');
    try {
      const res = await apiClient.redeemInvite(token);
      setDocId(res.document_id);
      setPermission(res.permission);
      setStatus('success');
      toast({ title: 'Access granted', description: `You now have ${res.permission} access.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessage(msg);
      setStatus('error');
    }
  };

  return (
    <LayoutClient>
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <h1 className="text-xl font-semibold">Accept document invite</h1>
              <p className="text-sm text-gray-500 mt-1">
                You've been invited to a document on StudyAI.
              </p>
            </div>

            {status === 'idle' && (
              <>
                <div className="bg-blue-50 border border-blue-100 rounded p-3 text-sm text-gray-700">
                  Clicking <strong>Accept</strong> grants you access on your StudyAI account.
                  {!isAuthenticated && (
                    <p className="mt-2 text-xs text-blue-700">You'll be asked to sign in first.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={accept} className="flex-1">
                    Accept invite
                  </Button>
                  <Button variant="outline" onClick={() => router.push('/files')}>
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {status === 'pending' && (
              <div className="text-center py-6">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
                <p className="text-sm text-gray-600 mt-2">Granting access…</p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center space-y-3 py-2">
                <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
                <p className="text-sm text-gray-700">
                  Access granted (<strong>{permission}</strong>).
                </p>
                <Button
                  onClick={() => {
                    // Belt-and-braces: only navigate to a UUID-shaped path.
                    if (docId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(docId)) {
                      router.push(`/study/${docId}`);
                    } else {
                      router.push('/files');
                    }
                  }}
                  className="w-full"
                >
                  Open document
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center space-y-3 py-2">
                <AlertCircle className="h-10 w-10 text-red-600 mx-auto" />
                <p className="text-sm text-red-700">{message || 'Failed to redeem invite.'}</p>
                <Button variant="outline" onClick={() => router.push('/files')} className="w-full">
                  Back to my files
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LayoutClient>
  );
}
