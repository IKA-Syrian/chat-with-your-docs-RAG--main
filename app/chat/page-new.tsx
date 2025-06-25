'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/api/auth';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import LayoutClient from '../layout-client';
import MarkdownMessage from '@/components/ui/markdown-message';
import { useSessionTracking } from '@/lib/hooks/use-session-tracking';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

interface Source {
  document_id: string;
  document_name: string;
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  document_id: string;
  document_name: string;
  created_at: string;
  last_message_at: string;
}

interface AIProvider {
  id: string;
  name: string;
  enabled: boolean;
  models?: {
    primary: string;
    alternatives: string[];
  };
}

export default function ChatPageNew() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const documentId = searchParams.get('document_id');
  const conversationId = searchParams.get('conversation_id');
  const isNewChat = searchParams.get('new') === 'true';
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(conversationId);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSources, setCurrentSources] = useState<Source[]>([]);
  const [showSources, setShowSources] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [showProviderSettings, setShowProviderSettings] = useState(false);

  // Session tracking for analytics
  const { recordActivity } = useSessionTracking({
    activityType: 'chat',
    documentId: documentId || undefined,
    autoStart: true,
  });

  // Ref for auto-scrolling to the bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Update conversation ID when URL changes
  useEffect(() => {
    if (conversationId !== currentConversationId) {
      setCurrentConversationId(conversationId);
      setMessages([]); // Clear messages when switching conversations
      setCurrentSources([]);
    }
  }, [conversationId, currentConversationId]);

  // Fetch AI providers
  const { data: providersData, isLoading: areProvidersLoading } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: () => apiClient.getAIProviders(),
    enabled: isAuthenticated,
  });

  // Set default provider when data is loaded
  useEffect(() => {
    if (providersData?.providers && providersData.providers.length > 0 && !selectedProvider) {
      const firstProvider = providersData.providers[0];
      setSelectedProvider(firstProvider.id);
      // Set default model for the provider
      if (firstProvider.models?.primary) {
        setSelectedModel(firstProvider.models.primary);
      }
    }
  }, [providersData, selectedProvider]);

  // Update selected model when provider changes
  useEffect(() => {
    if (selectedProvider && providersData?.providers) {
      const provider = providersData.providers.find(p => p.id === selectedProvider);
      if (provider?.models?.primary) {
        setSelectedModel(provider.models.primary);
      }
    }
  }, [selectedProvider, providersData]);

  // Fetch document information - only if documentId is provided
  const { data: documentData, isLoading: isDocumentLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => documentId ? apiClient.getDocument(documentId) : null,
    enabled: !!documentId && isAuthenticated,
  });

  // Fetch conversation history - only if conversationId is provided
  const { data: conversationData, isLoading: isConversationLoading } = useQuery({
    queryKey: ['conversation', currentConversationId],
    queryFn: () => currentConversationId ? apiClient.getConversation(currentConversationId) : null,
    enabled: !!currentConversationId && isAuthenticated,
    refetchOnWindowFocus: false,
  });

  // Fetch conversations list for this document - only if documentId is provided
  const { data: conversationsData, isLoading: areConversationsLoading } = useQuery({
    queryKey: ['conversations', documentId],
    queryFn: async () => {
      if (!documentId) return { conversations: [] };
      try {
        // Use the apiClient to fetch conversations directly from the backend
        return await apiClient.getConversationsByDocument(documentId);
      } catch (error) {
        console.error('Error fetching conversations:', error);
        return { conversations: [] };
      }
    },
    enabled: !!documentId && isAuthenticated,
    refetchOnWindowFocus: false,
  });

  // Redirect if not authenticated
  useEffect(() => {
  if (!isAuthenticated) {
    router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Redirect if no document is selected and not a new chat
  useEffect(() => {
    if (isAuthenticated && !documentId && !isNewChat && !conversationId) {
      router.push('/files');
    }
  }, [documentId, isNewChat, conversationId, isAuthenticated, router]);

  // Load conversation messages when conversation data changes
  useEffect(() => {
    if (conversationData?.messages && conversationData.messages.length > 0) {
      setMessages(conversationData.messages.map(msg => ({
        id: msg.id || String(Date.now()),
        content: msg.content,
        role: msg.role,
        timestamp: msg.created_at
      })));
    } else if (conversationData?.messages) {
      // If conversation exists but has no messages, set empty array
      setMessages([]);
    }
  }, [conversationData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Record chat activity
    recordActivity('chat');

    try {
      // Include provider and model in the chat request
      const response = await apiClient.chat(
        input, 
        currentConversationId || undefined,
        documentId || undefined,
        selectedProvider || undefined,
        selectedModel || undefined
      );
      
      // Store the conversation ID if this is a new conversation
      if (!currentConversationId && response.conversation_id) {
        setCurrentConversationId(response.conversation_id);
        // Update URL with conversation_id
        const newUrl = `/chat?${documentId ? `document_id=${documentId}&` : ''}conversation_id=${response.conversation_id}`;
        window.history.pushState({}, '', newUrl);
        
        // Invalidate conversations list to refresh sidebar
        queryClient.invalidateQueries(['conversations', documentId]);
      }
      
      const assistantMessage: Message = {
        id: response.id,
        content: response.message,
        role: 'assistant',
        timestamp: response.timestamp,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Update sources if provided
      if (response.sources && response.sources.length > 0) {
        setCurrentSources(response.sources);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Chat error',
        description: error instanceof Error ? error.message : 'Failed to send message',
      });
      
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: 'Sorry, I encountered an error processing your message. Please check your AI provider configuration.',
        role: 'assistant',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setCurrentSources([]);
    
    // Update URL to remove conversation_id
    const newUrl = documentId ? `/chat?document_id=${documentId}` : '/chat?new=true';
    window.history.pushState({}, '', newUrl);
  };

  const switchConversation = (conversationId: string) => {
    // Clear current messages and sources immediately
    setMessages([]);
    setCurrentSources([]);
    setCurrentConversationId(conversationId);
    
    // Update URL and use replace to prevent unnecessary navigation
    const newUrl = `/chat?${documentId ? `document_id=${documentId}&` : ''}conversation_id=${conversationId}`;
    window.history.pushState({}, '', newUrl);
    
    // Invalidate and refetch the conversation data
    queryClient.invalidateQueries(['conversation', conversationId]);
  };

  // Don't render anything if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <LayoutClient>
      <div className="flex h-full overflow-hidden chat-container">
        {/* Sidebar with conversation history */}
        <div className="w-64 bg-gray-50 border-r overflow-y-auto flex-shrink-0 hidden md:flex md:flex-col chat-sidebar">
          <div className="p-4 border-b">
            <h3 className="font-medium text-sm">
              {documentData?.document?.name || 'Chat History'}
            </h3>
          </div>
          
          <div className="p-2 flex-1 flex flex-col">
            <Button 
              variant="outline" 
              className="w-full text-sm mb-4"
              onClick={startNewConversation}
            >
              + New Chat
            </Button>
            
            {/* AI Provider Selection */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 mb-1 block">AI Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full text-sm border rounded px-2 py-1 bg-white"
                disabled={areProvidersLoading || isLoading}
                title="Select AI Provider"
              >
                {providersData?.providers?.map((provider: AIProvider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Model Selection */}
            {selectedProvider && providersData?.providers && (
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1 bg-white"
                  disabled={isLoading}
                  title="Select Model"
                >
                  {(() => {
                    const provider = providersData.providers.find(p => p.id === selectedProvider);
                    if (!provider?.models) return null;
                    
                    const allModels = [provider.models.primary, ...(provider.models.alternatives || [])];
                    return allModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ));
                  })()}
                </select>
              </div>
            )}
            
            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto chat-messages">
              {areConversationsLoading ? (
                <div className="text-center p-4">Loading conversations...</div>
              ) : conversationsData?.conversations && conversationsData.conversations.length > 0 ? (
                <ul className="space-y-1">
                  {conversationsData.conversations.map((conv: Conversation) => (
                    <li 
                      key={conv.id} 
                      className={`p-2 text-sm cursor-pointer rounded hover:bg-gray-200 ${
                        currentConversationId === conv.id ? 'bg-gray-200' : ''
                      }`}
                      onClick={() => switchConversation(conv.id)}
                    >
                      <div className="truncate">{conv.title}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(conv.last_message_at).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center text-sm text-gray-500 p-4">
                  No conversations yet
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4 mt-auto border-t">
            <Link href="/files" className="text-blue-600 hover:underline text-sm">
              Back to Files
            </Link>
          </div>
        </div>
        
        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-h-0 chat-main">
          {/* Document info header */}
          {documentId && documentData?.document && (
            <div className="w-full p-3 bg-gray-100 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center min-w-0 flex-1">
                <svg className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm2 1h8v10H6V6z" clipRule="evenodd" />
                </svg>
                <span className="font-medium text-sm truncate">
                  {documentData?.document?.name || 'Document Chat'}
                </span>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/study/${documentId}`)}
                  className="text-xs flex items-center gap-1"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Study
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowProviderSettings(!showProviderSettings)}
                  className="text-xs"
                >
                  AI: {providersData?.providers?.find((p: AIProvider) => p.id === selectedProvider)?.name || 'Loading...'} 
                  {selectedModel && ` (${selectedModel.split('/').pop()})`}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowSources(!showSources)}
                  disabled={currentSources.length === 0}
                  className="text-xs"
                >
                  {showSources ? 'Hide Sources' : 'Show Sources'}
                </Button>
              </div>
            </div>
          )}
          
          {/* Messages container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-messages">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <div className="max-w-md p-6">
                  <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
                  <p className="text-gray-600 mb-4">
                    {documentId && documentData?.document 
                      ? `Ask questions about "${documentData.document.name}" to get AI-powered answers with source citations.`
                      : 'Start a new conversation with the AI assistant.'}
                  </p>
                  {providersData?.providers && (
                    <p className="text-sm text-gray-500">
                      Using {providersData.providers.find((p: AIProvider) => p.id === selectedProvider)?.name || 'AI Provider'}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[85%] sm:max-w-3xl rounded-lg px-4 py-2 ${
                        message.role === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <MarkdownMessage 
                          content={message.content}
                          className="text-gray-800"
                        />
                      ) : (
                        <div className="whitespace-pre-wrap break-words">{message.content}</div>
                      )}
                      <div className="text-xs mt-1 opacity-70">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-3xl rounded-lg px-4 py-2 bg-gray-100">
                      <div className="typing">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}
                {/* Invisible element for auto-scrolling */}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          
          {/* Sources panel - conditionally rendered */}
          {showSources && currentSources.length > 0 && (
            <div className="border-t bg-gray-50 p-4 max-h-64 overflow-y-auto chat-messages">
              <h3 className="font-medium text-sm mb-2">Sources</h3>
              <div className="space-y-3">
                {currentSources.map((source, index) => (
                  <div key={index} className="bg-white p-3 rounded border text-sm">
                    <div className="font-medium mb-1">{source.document_name}</div>
                    <div className="text-gray-700">{source.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Input form */}
          <div className="border-t p-4 bg-white">
            <form onSubmit={handleSubmit} className="flex gap-2">
                      <Input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Record typing activity (throttled by the hook)
              recordActivity('chat');
            }}
                placeholder={documentId && documentData?.document 
                  ? `Ask about "${documentData.document.name}"...` 
                  : "Type your message..."}
            disabled={isLoading}
                className="flex-1 min-w-0"
          />
              <Button type="submit" disabled={isLoading || !input.trim()} className="flex-shrink-0">
                Send
          </Button>
        </form>
      </div>
    </div>

        {/* Mobile sidebar toggle - for future mobile menu implementation */}
        <div className="md:hidden fixed top-4 left-4 z-10">
          {/* Placeholder for mobile menu button */}
        </div>
      </div>
    </LayoutClient>
  );
}
