'use client';

import type {
  Attachment,
  ChatRequestOptions,
  CreateMessage,
  Message,
} from 'ai';
import { formatDistance } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useDebounceCallback, useWindowSize } from 'usehooks-ts';
import type { Document, Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Toolbar } from './toolbar';
import { VersionFooter } from './version-footer';
import { ArtifactActions } from './artifact-actions';
import { ArtifactCloseButton } from './artifact-close-button';
import { ArtifactMessages } from './artifact-messages';
import { useSidebar } from './ui/sidebar';
import { useArtifact } from '@/hooks/use-artifact';
import { imageArtifact } from '@/artifacts/image/client';
import { codeArtifact } from '@/artifacts/code/index';
import { sheetArtifact } from '@/artifacts/sheet/client';
import { textArtifact } from '@/artifacts/text/client';
import equal from 'fast-deep-equal';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const artifactDefinitions = [
  textArtifact,
  codeArtifact,
  imageArtifact,
  sheetArtifact,
];

export type ArtifactKind = (typeof artifactDefinitions)[number]['kind'];

export interface UIArtifact {
  id: string;
  title: string;
  documentId: string;
  kind: ArtifactKind;
  content: string;
  isVisible: boolean;
  status: 'streaming' | 'idle' | 'updating' | 'error';
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  lastContent?: string;
  currentContent?: string;
  lastUpdateTime?: number;
  isFullScreen?: boolean; // New property for full-screen mode
}

function PureArtifact({
  chatId,
  input,
  setInput,
  handleSubmit,
  isLoading,
  stop,
  attachments,
  setAttachments,
  append,
  messages,
  setMessages,
  reload,
  votes,
  isReadonly,
}: {
  chatId: string;
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  votes: Array<Vote> | undefined;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  reload: (chatRequestOptions?: ChatRequestOptions) => Promise<string | null | undefined>;
  isReadonly: boolean;
}) {
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact();

  // State for full-screen mode
  const [isFullScreen, setIsFullScreen] = useState(false);

  const {
    data: documents,
    isLoading: isDocumentsFetching,
    mutate: mutateDocuments,
  } = useSWR<Array<Document>>(
    artifact.documentId !== 'init'
      ? `/api/document?id=${artifact.documentId}`
      : null,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: isLoading ? 500 : 1000, // More frequent refreshes during loading
      refreshWhenHidden: false,
      dedupingInterval: isLoading ? 200 : 1000, // Shorter deduping during loading
    }
  );

  const [mode, setMode] = useState<'edit' | 'diff'>('edit');
  const [document, setDocument] = useState<Document | null>(null);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const { open: isSidebarOpen } = useSidebar();
  const [isContentDirty, setIsContentDirty] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = windowWidth ? windowWidth < 768 : false;

  // Toggle full-screen mode
  const toggleFullScreen = useCallback(() => {
    const newFullScreenState = !isFullScreen;
    setIsFullScreen(newFullScreenState);
    
    // If exiting full-screen mode and we have the metadata with flowInstance
    if (!newFullScreenState && metadata?.flowInstance) {
      // Wait for the animation to complete
      setTimeout(() => {
        console.log('Exiting fullscreen, triggering flow fit view');
        
        try {
          // If metadata has the flowInstance with a fitView method, call it
          if (metadata.flowInstance.fitView && typeof metadata.flowInstance.fitView === 'function') {
            metadata.flowInstance.fitView({
              padding: 0.4,
              minZoom: 0.1,
              maxZoom: 2,
              duration: 300
            });
            console.log('Successfully called fitView on flow instance');
          }
        } catch (e) {
          console.error('Error calling fitView:', e);
        }
        
        // Also dispatch a window resize event which often helps components recalculate dimensions
        window.dispatchEvent(new Event('resize'));
      }, 500); // Wait for the animation to complete
    }
  }, [isFullScreen, metadata]);

  // Enhanced reload function to ensure latest document is fetched and included in the request
  const enhancedReload = useCallback(
    async (chatRequestOptions?: ChatRequestOptions) => {
      // First, explicitly fetch the latest document
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

  // Enhanced submit function to ensure latest document is fetched and included in the request
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

  // Handle setting initial document and version
  useEffect(() => {
    if (documents && documents.length > 0) {
      const mostRecentDocument = documents.at(-1);
      if (mostRecentDocument) {
        setDocument(mostRecentDocument);
        setCurrentVersionIndex(documents.length - 1);
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          content: mostRecentDocument.content ?? '',
          currentContent: mostRecentDocument.content ?? '',
          lastUpdateTime: new Date(mostRecentDocument.createdAt).getTime()
        }));
      }
    }
  }, [documents, setArtifact]);

  // Sync content changes between views
  useEffect(() => {
    if (artifact.lastContent && artifact.lastContent !== artifact.content) {
      setArtifact(current => ({
        ...current,
        content: artifact.lastContent ?? '',
        currentContent: artifact.lastContent ?? ''
      }));
    }
  }, [artifact.lastContent, artifact.content, setArtifact]);

  // Trigger document refresh when artifact status changes
  useEffect(() => {
    mutateDocuments();
  }, [artifact.status, mutateDocuments]);

  // Add document synchronization effect that runs when messages change
  useEffect(() => {
    // Whenever messages change, ensure we have latest document
    if (artifact.documentId !== 'init' && messages.length > 0) {
      mutateDocuments();
    }
  }, [messages, artifact.documentId, mutateDocuments]);

  const { mutate } = useSWRConfig();

  const handleContentChange = useCallback(
    (updatedContent: string) => {
      if (!artifact) return;

      mutate<Array<Document>>(
        `/api/document?id=${artifact.documentId}`,
        async (currentDocuments) => {
          if (!currentDocuments) return undefined;
          const currentDocument = currentDocuments.at(-1);
          if (!currentDocument || !currentDocument.content) {
            setIsContentDirty(false);
            return currentDocuments;
          }

          if (currentDocument.content !== updatedContent) {
            try {
              setArtifact(current => ({
                ...current,
                status: 'updating'
              }));

              await fetch(`/api/document?id=${artifact.documentId}`, {
                method: 'POST',
                body: JSON.stringify({
                  title: artifact.title,
                  content: updatedContent,
                  kind: artifact.kind,
                }),
              });

              setIsContentDirty(false);
              
              const newDocument = {
                ...currentDocument,
                content: updatedContent,
                createdAt: new Date().toISOString()
              };

              setArtifact(current => ({
                ...current,
                content: updatedContent,
                currentContent: updatedContent,
                lastContent: updatedContent,
                lastUpdateTime: Date.now(),
                status: 'idle'
              }));

              return [...currentDocuments, newDocument];
            } catch (error) {
              console.error('Error saving content:', error);
              setArtifact(current => ({
                ...current,
                status: 'error'
              }));
              return currentDocuments;
            }
          }
          return currentDocuments;
        },
        { revalidate: false },
      );
    },
    [artifact, mutate, setArtifact],
  );

  const debouncedHandleContentChange = useDebounceCallback(handleContentChange, 2000);

  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      if (document && updatedContent !== document.content) {
        setIsContentDirty(true);
        if (debounce) {
          debouncedHandleContentChange(updatedContent);
        } else {
          handleContentChange(updatedContent);
        }
      }
    },
    [document, debouncedHandleContentChange, handleContentChange],
  );

  function getDocumentContentById(index: number) {
    if (!documents) return '';
    if (!documents[index]) return '';
    return documents[index].content ?? '';
  }

  const handleVersionChange = (type: 'next' | 'prev' | 'toggle' | 'latest') => {
    if (!documents) return;
    if (type === 'latest') {
      setCurrentVersionIndex(documents.length - 1);
      setMode('edit');
    }
    if (type === 'toggle') {
      setMode((mode) => (mode === 'edit' ? 'diff' : 'edit'));
    }
    if (type === 'prev') {
      if (currentVersionIndex > 0) {
        setCurrentVersionIndex((index) => index - 1);
      }
    } else if (type === 'next') {
      if (currentVersionIndex < documents.length - 1) {
        setCurrentVersionIndex((index) => index + 1);
      }
    }
  };

  const isCurrentVersion =
    documents && documents.length > 0
      ? currentVersionIndex === documents.length - 1
      : true;

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );

  if (!artifactDefinition) {
    throw new Error('Artifact definition not found!');
  }

  useEffect(() => {
    if (artifact.documentId !== 'init') {
      if (artifactDefinition.initialize) {
        artifactDefinition.initialize({
          documentId: artifact.documentId,
          setMetadata,
          setArtifact,
        });
      }
    }
  }, [artifact.documentId, artifactDefinition, setMetadata, setArtifact]);

  return (
    <AnimatePresence>
      {artifact.isVisible && (
        <motion.div
          className="flex flex-row h-dvh w-dvw fixed top-0 left-0 z-50"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { delay: 0.4 } }}
        >
          {/* Left panel with messages - hide in full-screen mode */}
          {!isMobile && !isFullScreen && (
            <motion.div
              className="fixed bg-background h-dvh"
              initial={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
              animate={{ width: windowWidth, right: 0 }}
              exit={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
            />
          )}

          {/* Chat messages panel - hide in full-screen mode */}
          {!isMobile && !isFullScreen && (
            <motion.div
              className="relative w-[400px] bg-muted dark:bg-background h-dvh shrink-0 border-r border-zinc-800"
              initial={{ opacity: 0, x: 10, scale: 1 }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
                transition: { delay: 0.2, type: 'spring', stiffness: 200, damping: 30 },
              }}
              exit={{ opacity: 0, x: 0, scale: 1, transition: { duration: 0 } }}
            >
              <AnimatePresence>
                {!isCurrentVersion && (
                  <motion.div
                    className="left-0 absolute h-dvh w-[400px] top-0 bg-zinc-700/50 z-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              <div className="flex flex-col h-full justify-between items-center gap-4">
                <ArtifactMessages
                  chatId={chatId}
                  isLoading={isLoading}
                  votes={votes}
                  messages={messages}
                  setMessages={setMessages}
                  reload={enhancedReload}
                  isReadonly={isReadonly}
                  artifactStatus={artifact.status}
                />

                <form className="flex flex-row gap-2 relative items-end w-full px-2 pb-4">
                  <MultimodalInput
                    chatId={chatId}
                    input={input}
                    setInput={setInput}
                    handleSubmit={enhancedHandleSubmit}
                    isLoading={isLoading}
                    stop={stop}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    messages={messages}
                    append={append}
                    className="bg-background dark:bg-muted"
                    setMessages={setMessages}
                  />
                </form>
              </div>
            </motion.div>
          )}

          {/* Artifact content panel - adjust for full-screen mode */}
          <motion.div
            className="fixed h-dvh flex flex-col overflow-y-scroll border-zinc-200 bg-background dark:bg-background"
            initial={
              isMobile
                ? {
                  opacity: 1,
                  x: artifact.boundingBox.left,
                  y: artifact.boundingBox.top,
                  height: artifact.boundingBox.height,
                  width: artifact.boundingBox.width,
                  borderRadius: 50,
                }
                : {
                  opacity: 1,
                  x: artifact.boundingBox.left,
                  y: artifact.boundingBox.top,
                  height: artifact.boundingBox.height,
                  width: artifact.boundingBox.width,
                  borderRadius: 50,
                }
            }
            animate={
              isMobile
                ? {
                  opacity: 1,
                  x: 0,
                  y: 0,
                  height: windowHeight,
                  width: windowWidth,
                  borderRadius: 0,
                  transition: { delay: 0, type: 'spring', stiffness: 200, damping: 30 },
                }
                : isFullScreen
                  ? {
                    opacity: 1,
                    x: 0,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth,
                    borderRadius: 0,
                    transition: { delay: 0, type: 'spring', stiffness: 200, damping: 30 },
                  }
                  : {
                    opacity: 1,
                    x: 400,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth - 400,
                    borderRadius: 0,
                    transition: { delay: 0, type: 'spring', stiffness: 200, damping: 30 },
                  }
            }
            exit={{
              opacity: 0,
              scale: 0.5,
              transition: { delay: 0.1, type: 'spring', stiffness: 600, damping: 30 },
            }}
          >
            <div className="p-1 flex flex-row justify-between items-start bg-background dark:bg-background">
              <div className="flex flex-row gap-2 items-start">
                <ArtifactCloseButton />
                <div className="flex flex-col">
                  {isContentDirty ? (
                    <div className="text-sm text-muted-foreground">Saving changes...</div>
                  ) : document?.createdAt ? (
                    <div className="text-sm text-muted-foreground">
                      {(() => {
                        try {
                          const updateDate = new Date(document.createdAt);
                          if (isNaN(updateDate.getTime())) {
                            return 'Recently updated';
                          }
                          return `Updated ${formatDistance(updateDate, new Date(), {
                            addSuffix: true,
                          })}`;
                        } catch (error) {
                          return 'Recently updated';
                        }
                      })()}
                    </div>
                  ) : (
                    <div className="w-32 h-3 mt-2 bg-muted-foreground/20 rounded-md animate-pulse" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 bg-background dark:bg-background">
                {/* Full-screen toggle button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullScreen}
                  title={isFullScreen ? "Exit full screen" : "Full screen"}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isFullScreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>

                <ArtifactActions
                  artifact={artifact}
                  currentVersionIndex={currentVersionIndex}
                  handleVersionChange={handleVersionChange}
                  isCurrentVersion={isCurrentVersion}
                  mode={mode}
                  metadata={metadata}
                  setMetadata={setMetadata}
                />
              </div>
            </div>

            <div className="h-full overflow-y-scroll items-center bg-background dark:bg-background">
              <artifactDefinition.content
                title={artifact.title}
                content={
                  isCurrentVersion
                    ? artifact.currentContent || artifact.content
                    : getDocumentContentById(currentVersionIndex)
                }
                mode={mode}
                status={artifact.status}
                currentVersionIndex={currentVersionIndex}
                suggestions={[]}
                onSaveContent={saveContent}
                isInline={false}
                isCurrentVersion={isCurrentVersion}
                getDocumentContentById={getDocumentContentById}
                isLoading={isDocumentsFetching && !artifact.content}
                metadata={metadata}
                setMetadata={setMetadata}
                document={document}
              />

              <AnimatePresence>
                {isCurrentVersion && (
                  <Toolbar
                    isToolbarVisible={isToolbarVisible}
                    setIsToolbarVisible={setIsToolbarVisible}
                    append={append}
                    isLoading={isLoading}
                    stop={stop}
                    setMessages={setMessages}
                    artifactKind={artifact.kind}
                  />
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {!isCurrentVersion && (
                <VersionFooter
                  currentVersionIndex={currentVersionIndex}
                  documents={documents}
                  handleVersionChange={handleVersionChange}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Artifact = memo(PureArtifact, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (prevProps.input !== nextProps.input) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  return true;
});

Artifact.displayName = 'Artifact';
export default Artifact;