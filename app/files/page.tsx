'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/api/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import LayoutClient from '../layout-client';

export default function FilesPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

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
    processMutation.mutate(documentId);
  };

  // Handle document deletion
  const handleDelete = (documentId: string) => {
      deleteMutation.mutate(documentId);
  };
  
  // Handle document click to navigate to chat
  const handleDocumentClick = (documentId: string) => {
    router.push(`/chat?document_id=${documentId}`);
  };

  // Remove duplicate documents (if any)
  const uniqueDocuments = documents.length > 0 
    ? Array.from(new Map(documents.map(doc => [doc.id, doc])).values())
    : [];

    return (
    <LayoutClient>
      <div className="max-w-6xl m-4 sm:m-10 flex flex-col gap-8 grow items-stretch">
      <div className="h-40 flex flex-col justify-center items-center border-b pb-8">
        <Input
          type="file"
          name="file"
            accept=".md,.txt,.pdf,.ppt,.pptx,text/markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
          className="cursor-pointer w-full max-w-xs"
          onChange={handleFileUpload}
          disabled={uploading}
        />
        {uploading && (
          <p className="text-sm text-gray-500 mt-2">Uploading...</p>
        )}
      </div>
      
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        ) : uniqueDocuments.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {uniqueDocuments.map((document: any) => (
            <div
              key={document.id}
                className="flex flex-col gap-2 justify-center items-center border rounded-md p-4 sm:p-6 text-center overflow-hidden hover:bg-slate-100 cursor-pointer"
                onClick={() => handleDocumentClick(document.id)}
            >
              <svg
                width="50px"
                height="50px"
                version="1.1"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="m82 31.199c0.10156-0.60156-0.10156-1.1992-0.60156-1.6992l-24-24c-0.39844-0.39844-1-0.5-1.5977-0.5h-0.19922-31c-3.6016 0-6.6016 3-6.6016 6.6992v76.5c0 3.6992 3 6.6992 6.6016 6.6992h50.801c3.6992 0 6.6016-3 6.6016-6.6992l-0.003906-56.699v-0.30078zm-48-7.1992h10c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2h-10c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2zm32 52h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm0-16h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm0-16h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm-8-15v-17.199l17.199 17.199z" />
              </svg>

              <span className="text-sm font-medium truncate w-full" title={document.name}>
                {document.name}
              </span>
              
                <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProcess(document.id);
                    }}
                  disabled={processMutation.isPending}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {processMutation.isPending ? 'Processing...' : 'Process'}
                </button>
                
                <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(document.id);
                    }}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <svg
            width="80px"
            height="80px"
            viewBox="0 0 100 100"
            className="text-gray-400 mb-4"
          >
            <path fill="currentColor" d="m82 31.199c0.10156-0.60156-0.10156-1.1992-0.60156-1.6992l-24-24c-0.39844-0.39844-1-0.5-1.5977-0.5h-0.19922-31c-3.6016 0-6.6016 3-6.6016 6.6992v76.5c0 3.6992 3 6.6992 6.6016 6.6992h50.801c3.6992 0 6.6016-3 6.6016-6.6992l-0.003906-56.699v-0.30078zm-48-7.1992h10c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2h-10c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2zm32 52h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm0-16h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm0-16h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm-8-15v-17.199l17.199 17.199z" />
          </svg>
          <p className="text-gray-500 text-lg">No documents uploaded yet</p>
          <p className="text-gray-400 text-sm">Upload a markdown or text file to get started</p>
        </div>
      )}
    </div>
    </LayoutClient>
  );
}
