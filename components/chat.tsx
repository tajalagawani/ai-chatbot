'use client';

import type { Attachment, Message, ChatRequestOptions } from 'ai';
import { useChat } from 'ai/react';
import { useState, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { ChatHeader } from '@/components/chat-header';
import type { Vote, Document } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';

import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';

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

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    isLoading,
    stop,
    reload,
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

  // Enhanced reload function that ensures latest document state and includes document content
  const enhancedReload = useCallback(
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
        return reload(updatedOptions);
      }
      
      // If no document, just reload normally
      return reload(chatRequestOptions);
    },
    [artifact, documents, mutateDocuments, reload]
  );

  // Enhanced submit function to ensure latest document state and includes document content
  const enhancedHandleSubmit = useCallback(
    async (event?: { preventDefault?: () => void }, chatRequestOptions?: ChatRequestOptions) => {
      if (event?.preventDefault) {
        event.preventDefault();
      }
      
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
        return handleSubmit(event, updatedOptions);
      }
      
      // If no document, just submit normally
      return handleSubmit(event, chatRequestOptions);
    },
    [artifact, documents, mutateDocuments, handleSubmit]
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
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
          reload={enhancedReload} // Use enhanced reload
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={enhancedHandleSubmit} // Use enhanced handleSubmit
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
        handleSubmit={enhancedHandleSubmit} // Use enhanced handleSubmit
        isLoading={isLoading}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={enhancedReload} // Use enhanced reload
        votes={votes}
        isReadonly={isReadonly}
      />
    </>
  );
}