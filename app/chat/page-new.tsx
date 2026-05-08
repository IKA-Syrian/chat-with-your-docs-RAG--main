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
import { useKeyboardShortcuts, formatShortcut, type Shortcut } from '@/lib/hooks/use-keyboard-shortcuts';
import DocPicker from '@/components/ui/doc-picker';

interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number | null;
  estimated?: boolean;
}

interface Source {
  index?: number;
  document_id: string;
  document_name: string;
  page?: number | null;
  chunk_index?: number | null;
  snippet?: string;
  content?: string;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  sources?: Source[];
  usage?: Usage;
  model?: string;
  provider?: string;
}

type ExplainMode = 'default' | 'eli5' | 'student' | 'professor';
const EXPLAIN_MODE_LABELS: Record<ExplainMode, string> = {
  default: 'Default',
  eli5: 'ELI5',
  student: 'Student',
  professor: 'Professor'
};
const EXPLAIN_MODE_DESCRIPTIONS: Record<ExplainMode, string> = {
  default: 'Standard explanation',
  eli5: 'Explain like I\'m 5 — simple words & analogies',
  student: 'Undergraduate level — clear, with examples',
  professor: 'Expert level — precise terminology & depth'
};

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
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [explainMode, setExplainMode] = useState<ExplainMode>('default');
  const [expandedSourceMsg, setExpandedSourceMsg] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Phase 3 #17: extra docs in scope (initial doc from URL is always first)
  const [scopeDocIds, setScopeDocIds] = useState<string[]>(documentId ? [documentId] : []);
  useEffect(() => {
    if (documentId && !scopeDocIds.includes(documentId)) {
      setScopeDocIds([documentId, ...scopeDocIds].slice(0, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Persist explain-mode preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('chat_explain_mode') as ExplainMode | null;
    if (stored && ['default', 'eli5', 'student', 'professor'].includes(stored)) {
      setExplainMode(stored);
    }
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('chat_explain_mode', explainMode);
  }, [explainMode]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Helper functions for AI provider management (same as study page)
  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    // Set default model for the provider
    const provider = providers.find(p => p.id === providerId);
    if (provider?.models?.primary) {
      setSelectedModel(provider.models.primary);
    }
  };

  const getAvailableModels = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider?.models) return [];
    
    return [
      { value: provider.models.primary, label: provider.models.primary },
      ...(provider.models.alternatives || []).map(model => ({
        value: model,
        label: model
      }))
    ];
  };

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

  // Fetch AI providers when component mounts
  useEffect(() => {
    if (isAuthenticated) {
      fetchAIProviders()
    }
  }, [isAuthenticated]);

  // Update conversation ID when URL changes
  useEffect(() => {
    if (conversationId !== currentConversationId) {
      setCurrentConversationId(conversationId);
      setMessages([]); // Clear messages when switching conversations
      setCurrentSources([]);
    }
  }, [conversationId, currentConversationId]);

  const fetchAIProviders = async () => {
    try {
      setProvidersLoading(true)
      const response = await apiClient.getAIProviders()
      const enabledProviders = response.providers.filter(p => p.enabled)
      setProviders(enabledProviders)
      
      // Set default provider and model
      if (enabledProviders.length > 0) {
        const defaultProvider = enabledProviders[0]
        setSelectedProvider(defaultProvider.id)
        setSelectedModel(defaultProvider.models?.primary || '')
      }
    } catch (err: any) {
      console.error('Error fetching AI providers:', err)
      toast({
        title: "Warning",
        description: "Failed to load AI providers. Using fallback options.",
        variant: "destructive",
      })
      
      // Fallback to basic providers if fetch fails
      const fallbackProviders: AIProvider[] = [
        {
          id: 'gemini',
          name: 'Google Gemini',
          enabled: true,
          models: {
            primary: 'gemini-2.0-flash',
            alternatives: ['gemini-1.5-flash', 'gemini-pro']
          }
        }
      ]
      setProviders(fallbackProviders)
      setSelectedProvider('gemini')
      setSelectedModel('gemini-2.0-flash')
    } finally {
      setProvidersLoading(false)
    }
  }

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
      // Include provider, model, explain mode, and the multi-doc scope.
      const response = await apiClient.chat(
        input,
        currentConversationId || undefined,
        documentId || undefined,
        selectedProvider || undefined,
        selectedModel || undefined,
        explainMode,
        scopeDocIds
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
        sources: response.sources || [],
        usage: response.usage || undefined,
        model: response.model,
        provider: response.provider
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update sources panel if provided
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

  // Feature 3: Keyboard shortcuts
  const shortcuts: Shortcut[] = [
    {
      key: '/',
      description: 'Focus the message input',
      handler: () => inputRef.current?.focus()
    },
    {
      key: 'n',
      description: 'Start a new chat',
      handler: () => startNewConversation()
    },
    {
      key: 's',
      description: 'Toggle sources panel',
      handler: () => setShowSources(v => !v)
    },
    {
      key: 'a',
      description: 'Toggle AI settings',
      handler: () => setShowProviderSettings(v => !v)
    },
    {
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      handler: () => setShowShortcuts(v => !v)
    },
    {
      key: 'Escape',
      allowInInput: true,
      description: 'Close overlays / blur input',
      handler: () => {
        if (showShortcuts) setShowShortcuts(false);
        else if (showProviderSettings) setShowProviderSettings(false);
        else if (expandedSourceMsg) setExpandedSourceMsg(null);
        else (document.activeElement as HTMLElement | null)?.blur?.();
      }
    }
  ];
  useKeyboardShortcuts(shortcuts, isAuthenticated);

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
      {/* Feature 3: Keyboard shortcuts help overlay */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Keyboard shortcuts</h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <ul className="text-sm space-y-2">
              {shortcuts.map((sc, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="text-gray-700">{sc.description}</span>
                  <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-100 border border-gray-300 rounded">
                    {formatShortcut(sc)}
                  </kbd>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 mt-4">
              Tip: shortcuts are disabled while typing in the message box (except <kbd>Esc</kbd>).
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col h-full bg-gray-50">
        {/* Mobile-Optimized Header */}
        <header className="bg-white shadow-sm border-b flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Mobile Header */}
            <div className="flex items-center py-4 sm:py-6">
              <Button variant="ghost" size="sm" onClick={() => router.push("/files")} className="mr-2 sm:mr-4 p-2 sm:px-3">
                <svg className="h-4 w-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Back to Files</span>
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                  {documentData?.document ? `Chat: ${documentData.document.name}` : 'AI Chat'}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500">
                  {documentData?.document ? 'Document conversation' : 'General AI conversation'}
                </p>
              </div>
              
              {/* Desktop Action Buttons */}
              <div className="hidden md:flex items-center gap-4">
                {documentId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/study/${documentId}`)}
                    className="flex items-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Study
                  </Button>
                )}
                
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowProviderSettings(!showProviderSettings)}
                  className="flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  AI Settings
                  <svg className={`h-4 w-4 transition-transform ${showProviderSettings ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={startNewConversation}
                  className="flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  New Chat
                </Button>
              </div>

              {/* Mobile Action Buttons */}
              <div className="flex md:hidden items-center gap-2">
                {documentId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/study/${documentId}`)}
                    className="p-2"
                    title="Study"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </Button>
                )}

                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowProviderSettings(!showProviderSettings)}
                  className="p-2"
                  title="AI Settings"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Button>

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={startNewConversation}
                  className="p-2"
                  title="New Chat"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </Button>
              </div>
            </div>

            {/* Mobile Action Row */}
            <div className="md:hidden pb-4">
              <div className="flex gap-2 flex-wrap">
                {documentId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/study/${documentId}`)}
                    className="flex items-center gap-1 text-xs"
                  >
                    📚 Study
                  </Button>
                )}
                
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowProviderSettings(!showProviderSettings)}
                  className="flex items-center gap-1 text-xs"
                >
                  ⚙️ AI Settings
                </Button>

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={startNewConversation}
                  className="flex items-center gap-1 text-xs"
                >
                  ➕ New Chat
                </Button>

                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowSources(!showSources)}
                  disabled={currentSources.length === 0}
                  className="flex items-center gap-1 text-xs"
                >
                  {showSources ? '🔽 Hide Sources' : '🔼 Show Sources'}
                </Button>
              </div>
            </div>

            {/* AI Settings Panel */}
            {showProviderSettings && (
              <div className="pb-4 sm:pb-6 border-t border-gray-200 pt-4">
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">AI Configuration</h3>
                  
                  {providers && providers.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                            Provider
                          </label>
                          <select
                            value={selectedProvider}
                            onChange={(e) => handleProviderChange(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            aria-label="Select AI Provider"
                          >
                            {providers.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                            Model
                          </label>
                          <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            aria-label="Select AI Model"
                          >
                            {getAvailableModels(selectedProvider).map((model) => (
                              <option key={model.value} value={model.value}>
                                {model.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Selected: {providers.find(p => p.id === selectedProvider)?.name || 'Unknown'} - {selectedModel || 'No model selected'}
                      </p>

                      {/* Feature 5: Explain-like toggle */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                          Explain like…
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {(['default', 'eli5', 'student', 'professor'] as ExplainMode[]).map(mode => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setExplainMode(mode)}
                              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                explainMode === mode
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                              title={EXPLAIN_MODE_DESCRIPTIONS[mode]}
                            >
                              {EXPLAIN_MODE_LABELS[mode]}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {EXPLAIN_MODE_DESCRIPTIONS[explainMode]}
                        </p>
                      </div>
                    </>
                  ) : providersLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500">Loading AI providers...</p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-red-600 mb-2">No AI providers available</p>
                      <p className="text-xs text-gray-500">Check your backend configuration or try refreshing the page.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="flex h-full overflow-hidden chat-container">
          {/* Sidebar with conversation history - Desktop Only */}
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
            {/* Messages container */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 chat-messages">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center">
                  <div className="max-w-md p-4 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-semibold mb-2">Start a conversation</h2>
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      {documentId && documentData?.document 
                        ? `Ask questions about "${documentData.document.name}" to get AI-powered answers with source citations.`
                        : 'Start a new conversation with the AI assistant.'}
                    </p>
                    {providers && providers.length > 0 && (
                      <p className="text-xs sm:text-sm text-gray-500">
                        Using {providers.find((p: AIProvider) => p.id === selectedProvider)?.name || 'AI Provider'}
                        {selectedModel && ` (${selectedModel.split('/').pop()})`}
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
                        className={`max-w-[90%] sm:max-w-[85%] lg:max-w-3xl rounded-lg px-3 sm:px-4 py-2 ${
                          message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <MarkdownMessage
                            content={message.content}
                            className="text-gray-800 text-sm sm:text-base"
                          />
                        ) : (
                          <div className="whitespace-pre-wrap break-words text-sm sm:text-base">{message.content}</div>
                        )}

                        {/* Feature 1: Source citations footer (assistant only) */}
                        {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <button
                              onClick={() => setExpandedSourceMsg(expandedSourceMsg === message.id ? null : message.id)}
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              {message.sources.length} source{message.sources.length === 1 ? '' : 's'}
                              <span>{expandedSourceMsg === message.id ? '▾' : '▸'}</span>
                            </button>
                            {expandedSourceMsg === message.id && (
                              <ol className="mt-2 space-y-2 text-xs">
                                {message.sources.map((src, i) => (
                                  <li key={i} className="bg-white border rounded p-2">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="font-medium text-gray-800 truncate">
                                        [{src.index ?? i + 1}] {src.document_name || 'Document'}
                                        {src.page != null && <span className="text-gray-500"> · p.{src.page}</span>}
                                      </span>
                                      {src.document_id && (
                                        <Link
                                          href={`/study/${src.document_id}`}
                                          className="text-blue-600 hover:underline whitespace-nowrap"
                                        >
                                          Open →
                                        </Link>
                                      )}
                                    </div>
                                    <div className="text-gray-600 break-words">
                                      {src.snippet || src.content || ''}
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        )}

                        <div className="text-xs mt-1 opacity-70">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="max-w-3xl rounded-lg px-3 sm:px-4 py-2 bg-gray-100">
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
              <div className="border-t bg-gray-50 p-3 sm:p-4 max-h-48 sm:max-h-64 overflow-y-auto chat-messages">
                <h3 className="font-medium text-sm mb-2">Sources</h3>
                <div className="space-y-2 sm:space-y-3">
                  {currentSources.map((source, index) => (
                    <div key={index} className="bg-white p-2 sm:p-3 rounded border text-xs sm:text-sm">
                      <div className="font-medium mb-1">
                        [{source.index ?? index + 1}] {source.document_name}
                        {source.page != null && <span className="text-gray-500"> · p.{source.page}</span>}
                      </div>
                      <div className="text-gray-700">{source.snippet || source.content || ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Phase 3 #17: multi-document scope picker */}
            <div className="border-t bg-white px-3 sm:px-4 pt-3">
              <DocPicker
                selectedIds={scopeDocIds}
                onChange={setScopeDocIds}
                primaryId={documentId}
                maxDocs={10}
              />
            </div>

            {/* Mobile-Optimized Input form */}
            <div className="p-3 sm:p-4 bg-white">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  ref={inputRef}
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
                  className="flex-1 min-w-0 text-sm sm:text-base"
                />
                <Button type="submit" disabled={isLoading || !input.trim()} className="flex-shrink-0 px-3 sm:px-4">
                  <span className="hidden sm:inline">Send</span>
                  <span className="sm:hidden">➤</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </LayoutClient>
  );
}
