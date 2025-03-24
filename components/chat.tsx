'use client';

import type { Attachment, Message, ChatRequestOptions } from 'ai';
import { useChat } from 'ai/react';
import { useState, useCallback, useEffect, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { ChatHeader } from '@/components/chat-header';
import type { Vote, Document } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';

import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { useArtifact } from '@/hooks/use-artifact';
import { toast } from 'sonner';

// Function to detect ACT references in user messages
const detectActReference = (message: string): boolean => {
  const actPatterns = [
    /act\s+workflow/i,
    /act\s+document/i,
    /act\s+file/i,
    /act\s+configuration/i,
    /workflow\s+configuration/i,
    /workflow\s+file/i,
    /autonomous\s+agent/i,
    /agent\s+system/i,
    /workflow\s+system/i,
    /node\s+in\s+the\s+flow/i,
    /nodes\s+in\s+the\s+flow/i,
    /workflow\s+nodes/i,
    /diagram\s+nodes/i,
    /list.*nodes/i
  ];
  
  return actPatterns.some(pattern => pattern.test(message));
};

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();
  const artifact = useArtifactSelector((state) => state);
  const { setArtifact } = useArtifact();
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const isArtifactFullScreen = useArtifactSelector((state) => state.isFullScreen);

  // Track recent documents for context enrichment
  const [recentDocumentId, setRecentDocumentId] = useState<string | null>(null);
  
  // Add refs to track user interactions and message processing
  const lastProcessedMessageIdRef = useRef<string | null>(null);
  const userClosedArtifactRef = useRef(false);
  
  // Create a handler for closing the artifact
  const handleArtifactClose = useCallback(() => {
    // Mark that user explicitly closed the artifact
    userClosedArtifactRef.current = true;
    setArtifact(prev => ({
      ...prev,
      isVisible: false
    }));
  }, [setArtifact]);

  // Fetch recent ACT documents when needed
  const { data: recentActDocuments } = useSWR<Array<Document>>(
    recentDocumentId === null ? '/api/document/recent?kind=code&limit=1' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnMount: true,
      dedupingInterval: 30000, // 30 seconds
    }
  );

  // Update recent document ID when data is fetched
  useEffect(() => {
    if (recentActDocuments && recentActDocuments.length > 0) {
      setRecentDocumentId(recentActDocuments[0].id);
    }
  }, [recentActDocuments]);

  // Reset tracking refs when chat ID changes
  useEffect(() => {
    userClosedArtifactRef.current = false;
    lastProcessedMessageIdRef.current = null;
  }, [id]);

  const {
    messages,
    setMessages,
    handleSubmit: originalHandleSubmit,
    input,
    setInput,
    append,
    isLoading,
    stop,
    reload: originalReload,
  } = useChat({
    id,
    body: { id, selectedChatModel: selectedChatModel },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: () => {
      mutate('/api/history');
    },
    onError: (error) => {
      toast.error('An error occurred, please try again!');
    },
  });

  const { data: votes } = useSWR<Array<Vote>>(
    `/api/vote?chatId=${id}`,
    fetcher,
  );

  // If we have an active artifact, ensure we fetch the latest document before reloading
  const { data: documents, mutate: mutateDocuments } = useSWR<Array<Document>>(
    artifact.documentId !== 'init' 
      ? `/api/document?id=${artifact.documentId}` 
      : null,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: isLoading ? 500 : 1000,
    }
  );

  // Auto-open document in artifact when a message references ACT and a document exists
  useEffect(() => {
    // Skip if no messages, no recent document, or user manually closed artifact
    if (!messages.length || !recentDocumentId || userClosedArtifactRef.current) return;
    
    // Get the most recent user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) return;
    
    // Skip if we've already processed this message
    if (lastUserMessage.id === lastProcessedMessageIdRef.current) return;
    
    // Check if message has ACT reference and artifact isn't already visible
    if (!isArtifactVisible && detectActReference(lastUserMessage.content.toString())) {
      // Update the last processed message ID
      lastProcessedMessageIdRef.current = lastUserMessage.id;
      
      // Fetch the document to display
      fetch(`/api/document?id=${recentDocumentId}`)
        .then(response => response.json())
        .then(fetchedDocuments => {
          if (fetchedDocuments && fetchedDocuments.length > 0) {
            const doc = fetchedDocuments[fetchedDocuments.length - 1];
            setArtifact({
              id: generateUUID(),
              documentId: doc.id,
              kind: doc.kind,
              title: doc.title,
              content: doc.content || '',
              currentContent: doc.content || '',
              isVisible: true,
              status: 'idle',
              boundingBox: { top: 100, left: 100, width: 600, height: 400 }
            });
          }
        })
        .catch(error => console.error('Error fetching document:', error));
    }
  }, [messages, isArtifactVisible, recentDocumentId, setArtifact]);

  // Detect document references in the current input
  const getDocumentIdForContext = useCallback(async (inputText: string) => {
    // Priority order:
    // 1. Currently open artifact document
    // 2. Explicitly referenced document in input
    // 3. Most recent document if ACT reference is detected
    
    // If artifact is already open, use that document
    if (artifact.documentId !== 'init') {
      return artifact.documentId;
    }
    
    // If input contains ACT references, use the most recent document
    if (detectActReference(inputText)) {
      // Check if we already have a recent document ID
      if (recentDocumentId) {
        return recentDocumentId;
      }
      
      // If not, fetch the most recent document
      try {
        const response = await fetch('/api/document/recent?kind=code&limit=1');
        if (response.ok) {
          const docs = await response.json();
          if (docs && docs.length > 0) {
            setRecentDocumentId(docs[0].id);
            return docs[0].id;
          }
        }
      } catch (error) {
        console.error('Error fetching recent documents:', error);
      }
    }
    
    return null;
  }, [artifact.documentId, recentDocumentId]);

  // Enhanced reload function that ensures latest document state and includes document content
  const reload = useCallback(
    async (chatRequestOptions?: ChatRequestOptions) => {
      // First, explicitly fetch the latest document if we have an active artifact
      if (artifact.documentId !== 'init') {
        await mutateDocuments();
        
        // Get the most recent document content from the freshly updated documents
        let latestContent = '';
        if (documents && documents.length > 0) {
          latestContent = documents[documents.length - 1].content || '';
        } else {
          latestContent = artifact.currentContent || artifact.content;
        }
        
        // Include document content in the request body
        const updatedOptions: ChatRequestOptions = {
          ...chatRequestOptions,
          data: {
            ...(chatRequestOptions?.data || {}),
            documentContent: latestContent,
            documentId: artifact.documentId,
            documentKind: artifact.kind,
            documentTitle: artifact.title
          }
        };
        
        // Then proceed with the reload with document content
        return originalReload(updatedOptions);
      } else {
        // Check if there's a document reference in the last user message
        if (messages.length > 0) {
          const lastUserMessage = messages.filter(m => m.role === 'user').pop();
          if (lastUserMessage) {
            const docId = await getDocumentIdForContext(lastUserMessage.content.toString());
            if (docId) {
              const updatedOptions: ChatRequestOptions = {
                ...chatRequestOptions,
                data: {
                  ...(chatRequestOptions?.data || {}),
                  documentId: docId
                }
              };
              return originalReload(updatedOptions);
            }
          }
        }
      }
      
      // If no document, just reload normally
      return originalReload(chatRequestOptions);
    },
    [artifact, documents, mutateDocuments, originalReload, messages, getDocumentIdForContext]
  );

  // Enhanced submit function to ensure latest document state and includes document content
  const handleSubmit = useCallback(
    async (event?: { preventDefault?: () => void }, chatRequestOptions?: ChatRequestOptions) => {
      if (event?.preventDefault) {
        event.preventDefault();
      }
      
      // Reset the user closed flag when submitting a new message
      userClosedArtifactRef.current = false;
      
      // Ensure we have the latest document before submitting
      if (artifact.documentId !== 'init') {
        await mutateDocuments();
        
        // Get the most recent document content from the freshly updated documents
        let latestContent = '';
        if (documents && documents.length > 0) {
          latestContent = documents[documents.length - 1].content || '';
        } else {
          latestContent = artifact.currentContent || artifact.content;
        }
        
        // Include document content in the request body
        const updatedOptions: ChatRequestOptions = {
          ...chatRequestOptions,
          data: {
            ...(chatRequestOptions?.data || {}),
            documentContent: latestContent,
            documentId: artifact.documentId,
            documentKind: artifact.kind,
            documentTitle: artifact.title
          }
        };
        
        // Then submit with document content
        return originalHandleSubmit(event, updatedOptions);
      } else {
        // Check if input contains ACT reference
        const docId = await getDocumentIdForContext(input);
        
        if (docId) {
          // Fetch the document content
          try {
            const response = await fetch(`/api/document?id=${docId}`);
            if (response.ok) {
              const docs = await response.json();
              if (docs && docs.length > 0) {
                const doc = docs[docs.length - 1];
                const updatedOptions: ChatRequestOptions = {
                  ...chatRequestOptions,
                  data: {
                    ...(chatRequestOptions?.data || {}),
                    documentId: docId,
                    documentContent: doc.content,
                    documentKind: doc.kind,
                    documentTitle: doc.title
                  }
                };
                return originalHandleSubmit(event, updatedOptions);
              }
            }
          } catch (error) {
            console.error('Error fetching document content:', error);
          }
          
          // If fetching content failed, still send the document ID
          const updatedOptions: ChatRequestOptions = {
            ...chatRequestOptions,
            data: {
              ...(chatRequestOptions?.data || {}),
              documentId: docId
            }
          };
          return originalHandleSubmit(event, updatedOptions);
        }
      }
      
      // If no document, just submit normally
      return originalHandleSubmit(event, chatRequestOptions);
    },
    [artifact, documents, mutateDocuments, originalHandleSubmit, input, getDocumentIdForContext]
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  return (
    <>
      {/* Hide the chat interface when artifact is in full screen mode */}
      <div className={`flex flex-col min-w-0 h-dvh bg-background ${isArtifactFullScreen ? 'hidden' : ''}`}>
        <ChatHeader
          chatId={id}
          selectedModelId={selectedChatModel}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
        />

        <Messages
          chatId={id}
          isLoading={isLoading}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
            />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
        onClose={handleArtifactClose} // Pass the close handler to the Artifact component
      />
    </>
  );
}