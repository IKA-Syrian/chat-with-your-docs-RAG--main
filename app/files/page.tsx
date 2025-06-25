'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/api/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Upload, BookOpen, Brain, Target, TrendingUp, Loader2, MessageSquare, GraduationCap, FileText, Calendar, Trash2 } from 'lucide-react';
import LayoutClient from '../layout-client';
import { useSessionTracking } from '@/lib/hooks/use-session-tracking';

export default function FilesPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  // Session tracking for analytics
  const { recordActivity } = useSessionTracking({
    activityType: 'browse',
    autoStart: true,
  });

  // Fetch documents
  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => apiClient.getDocuments(),
    enabled: isAuthenticated,
  });

  // Extract documents from the response
  const documents = data?.documents || [];

  // Process document mutation
  const processMutation = useMutation({
    mutationFn: (documentId: string) => apiClient.processDocument(documentId),
    onSuccess: (data, documentId) => {
      toast({
        title: 'Document processing started',
        description: 'Your document is being processed.',
      });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      
      // Redirect to chat with this document
      router.push(`/chat?document_id=${documentId}`);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Failed to process document',
      });
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => apiClient.deleteDocument(documentId),
    onSuccess: () => {
      toast({
        title: 'Document deleted',
        description: 'Document has been successfully deleted.',
      });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete document',
      });
    },
  });

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    recordActivity('browse'); // Track file upload activity

    try {
      const response = await apiClient.uploadDocument(file);
      
      toast({
        title: 'Upload successful',
        description: 'Your document has been uploaded.',
      });
      
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      
      // Automatically process the document after upload
      if (response && response.document && response.document.id) {
        processMutation.mutate(response.document.id);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload document',
      });
    } finally {
      setUploading(false);
    }
  };

  // Handle document processing
  const handleProcess = (documentId: string) => {
    recordActivity('browse'); // Track document processing
    processMutation.mutate(documentId);
  };

  // Handle document deletion
  const handleDelete = (documentId: string) => {
    recordActivity('browse'); // Track document deletion
    deleteMutation.mutate(documentId);
  };
  
  // Handle document click to navigate to chat
  const handleDocumentClick = (documentId: string) => {
    recordActivity('browse'); // Track document selection
    router.push(`/chat?document_id=${documentId}`);
  };

  // Remove duplicate documents (if any)
  const uniqueDocuments = documents.length > 0 
    ? Array.from(new Map(documents.map(doc => [doc.id, doc])).values())
    : [];

  // Calculate statistics
  const totalDocuments = uniqueDocuments.length;
  const documentsWithEducationalContent = uniqueDocuments.filter(doc => doc.educational_content_generated).length;

  // Get file extension to show appropriate icon
  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return <FileText className="h-6 w-6 text-red-600" />;
      case 'ppt':
      case 'pptx':
        return <GraduationCap className="h-6 w-6 text-orange-600" />;
      case 'md':
        return <BookOpen className="h-6 w-6 text-blue-600" />;
      default:
        return <FileText className="h-6 w-6 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <LayoutClient>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-32 w-32 animate-spin text-blue-600" />
        </div>
      </LayoutClient>
    );
  }

  return (
    <LayoutClient>
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <Brain className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
                  <p className="text-sm text-gray-500">Upload and manage your study materials</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline" 
                  onClick={() => router.push('/analytics')}
                  className="flex items-center gap-2"
                >
                  <TrendingUp className="h-4 w-4" /> Analytics
                </Button>
                <Button
                  variant="outline" 
                  onClick={() => router.push('/chat')}
                  className="flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" /> Chat
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Upload Section */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Document
                </CardTitle>
                <CardDescription>
                  Upload PDF, PowerPoint, Markdown, or Text files to create study materials
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                  <Upload className="h-12 w-12 text-gray-400 mb-4" />
                  <Input
                    type="file"
                    name="file"
                    accept=".md,.txt,.pdf,.ppt,.pptx,text/markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
                    className="cursor-pointer w-full max-w-xs"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  {uploading && (
                    <div className="flex items-center gap-2 mt-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p className="text-sm text-gray-500">Uploading and processing...</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalDocuments}</div>
                  <p className="text-xs text-muted-foreground">Files uploaded</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Study Ready</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{documentsWithEducationalContent}</div>
                  <p className="text-xs text-muted-foreground">With study materials</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {totalDocuments > 0 ? Math.round((documentsWithEducationalContent / totalDocuments) * 100) : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">Documents processed</p>
                </CardContent>
              </Card>
            </div>

            {/* Documents Grid */}
            <Card>
              <CardHeader>
                <CardTitle>Your Documents</CardTitle>
                <CardDescription>
                  {totalDocuments > 0 
                    ? `${totalDocuments} document${totalDocuments === 1 ? '' : 's'} available for study`
                    : 'No documents uploaded yet'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {uniqueDocuments.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
                    <p className="text-gray-500 mb-4">Upload your first document to get started with AI-powered study materials</p>
                    <p className="text-sm text-gray-400">Supported formats: PDF, PowerPoint, Markdown, Text</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {uniqueDocuments.map((document: any) => (
                      <div
                        key={document.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleDocumentClick(document.id)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            {getFileIcon(document.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate">{document.name}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(document.created_at).toLocaleDateString()}
                              </div>
                              {document.educational_content_generated && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Study Ready
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProcess(document.id);
                            }}
                            disabled={processMutation.isPending}
                            className="flex items-center gap-1"
                          >
                            {processMutation.isPending ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Processing
                              </>
                            ) : (
                              <>
                                <Brain className="h-3 w-3" />
                                Process
                              </>
                            )}
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              recordActivity('browse'); // Track study navigation
                              router.push(`/study/${document.id}`);
                            }}
                            className="flex items-center gap-1"
                          >
                            <GraduationCap className="h-3 w-3" />
                            Study
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              recordActivity('browse'); // Track chat navigation
                              router.push(`/chat?document_id=${document.id}`);
                            }}
                            className="flex items-center gap-1"
                          >
                            <MessageSquare className="h-3 w-3" />
                            Chat
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(document.id);
                            }}
                            disabled={deleteMutation.isPending}
                            className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </LayoutClient>
  );
}