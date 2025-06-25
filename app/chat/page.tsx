'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the ChatPageNew component
const ChatPageNew = dynamic(() => import('./page-new'), {
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
    </div>
  ),
});

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get('document_id');
  const conversationId = searchParams.get('conversation_id');
  const isNewChat = searchParams.get('new') === 'true';
  
  // Directly render the ChatPageNew component (it already includes LayoutClient)
  return <ChatPageNew />;
}
