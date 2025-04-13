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
import { Maximize2, Minimize2, Eye, Code, Monitor, Laptop, Smartphone, Rocket, Terminal, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 
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
 const [activeTab, setActiveTab] = useState("preview");
 const [consoleEvents, setConsoleEvents] = useState<string[]>([]);
 const [logLevel, setLogLevel] = useState("default");
 const [toolbarVisible, setToolbarVisible] = useState(false);

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

 // Show toolbar after artifact animation is complete
 useEffect(() => {
   if (artifact.isVisible) {
     const timer = setTimeout(() => {
       setToolbarVisible(true);
     }, 500); // Delay to match artifact animation
     return () => clearTimeout(timer);
   } else {
     setToolbarVisible(false);
   }
 }, [artifact.isVisible]);

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

 // Clear console events
 const clearConsoleEvents = useCallback(() => {
   setConsoleEvents([]);
 }, []);
 
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

 // Format last update time
 const getLastUpdateText = () => {
   if (isContentDirty) {
     return "Saving changes...";
   } else if (document?.createdAt) {
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
   } else {
     return 'Loading...';
   }
 };

 // Render content based on active tab
 const renderContent = () => {
   if (activeTab === "console") {
     return (
       <div className="flex flex-col h-full bg-zinc-900 text-zinc-100 font-mono text-sm">
         <div className="flex justify-between items-center p-3 border-b border-zinc-800">
           <div className="flex items-center gap-2">
             <span>Console</span>
             <span className="text-zinc-500 text-xs">{consoleEvents.length} events</span>
           </div>
           <div className="flex items-center gap-2">
             <Button
               variant="ghost"
               size="icon"
               onClick={clearConsoleEvents}
               className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
             >
               <Trash className="h-4 w-4" />
             </Button>
             <Select value={logLevel} onValueChange={setLogLevel}>
               <SelectTrigger className="h-7 w-32 bg-zinc-800 border-zinc-700 text-xs">
                 <SelectValue placeholder="Log level" />
               </SelectTrigger>
               <SelectContent className="bg-zinc-800 border-zinc-700">
                 <SelectItem value="default">Default level</SelectItem>
                 <SelectItem value="verbose">Verbose</SelectItem>
                 <SelectItem value="info">Info</SelectItem>
                 <SelectItem value="warnings">Warnings</SelectItem>
                 <SelectItem value="errors">Errors</SelectItem>
               </SelectContent>
             </Select>
           </div>
         </div>
         
         <div className="flex-1 p-3 overflow-auto">
           {consoleEvents.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-zinc-500">
               <p>No events</p>
             </div>
           ) : (
             <div className="space-y-1">
               {consoleEvents.map((event, index) => (
                 <div key={index} className="break-all">
                   {event}
                 </div>
               ))}
             </div>
           )}
         </div>
       </div>
     );
   }
   
   // Default content (preview or others)
   return (
     <>
       <div className="flex flex-row justify-between items-start dark:bg-[#18181b]">
         <div className="flex flex-row gap-2 items-start m-1">
           <ArtifactCloseButton />
         </div>

         <div className="flex items-center gap-1 bg-background dark:bg-[#18181b] m-1">
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
     </>
   );
 };

 return (
   <AnimatePresence>
     {artifact.isVisible && (
       <motion.div
         className="flex flex-col h-dvh w-dvw fixed top-0 left-0 z-50"
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         exit={{ opacity: 0, transition: { delay: 0.3, duration: 0.5 } }}
       >
         {/* Left panel with messages - hide in full-screen mode */}
         {!isMobile && !isFullScreen && (
           <motion.div
             className="fixed bg-background h-dvh"
             initial={{
               width: isSidebarOpen ? windowWidth - 256 : windowWidth,
               right: 0,
               opacity: 0,
             }}
             animate={{ 
               width: windowWidth, 
               right: 0,
               opacity: 1,
               transition: { 
                 type: 'spring', 
                 stiffness: 100, 
                 damping: 20,
                 duration: 0.6 
               },
             }}
             exit={{
               width: isSidebarOpen ? windowWidth - 256 : windowWidth,
               right: 0,
               opacity: 0,
               transition: { duration: 0.5 },
             }}
           />
         )}

         {/* Chat messages panel - hide in full-screen mode */}
         {!isMobile && !isFullScreen && (
           <motion.div
             className="relative w-[500px] bg-muted dark:bg-background h-dvh"
             initial={{ opacity: 0, x: -windowWidth }} // Start from LEFT edge of screen
             animate={{
               opacity: 1,
               x: 0, // Slide in from left
               transition: { 
                 type: 'spring', 
                 stiffness: 100, 
                 damping: 20,
                 delay: 0.1,
                 duration: 0.6 
               },
             }}
             exit={{ 
               opacity: 0, 
               x: -windowWidth, // Exit to LEFT edge
               transition: { 
                 type: 'spring',
                 stiffness: 100,
                 damping: 20,
                 duration: 0.5
               }
             }}
           >
             {/* Chat Toolbar */}
             <div className="sticky top-0 z-10 px-4">
               <div className="flex items-center justify-between rounded-lg shadow-md mt-2 p-0.5">
                 <div className="flex items-center">
                   <Button
                     variant="ghost"
                     className="text-zinc-400 hover:text-zinc-100 px-2 py-1 h-7"
                     size="sm"
                   >
                     <Smartphone className="h-3 w-3" />
                   </Button>
                   
                   <Button
                     variant="ghost"
                     className="text-zinc-400 hover:text-zinc-100 px-2 py-1 h-7"
                     size="sm"
                   >
                     <Laptop className="h-3 w-3" />
                   </Button>
                   
                   <Button
                     variant="ghost"
                     className="text-zinc-400 hover:text-zinc-100 px-2 py-1 h-7"
                     size="sm"
                   >
                     <Monitor className="h-3 w-3" />
                   </Button>
                 </div>

                 <div>
                   {/* Center area */}
                 </div>

                 <Button 
                   variant="default"
                   size="sm"
                   className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 py-1 rounded-lg font-medium flex items-center gap-1 text-xs h-7"
                 >
                   <Rocket className="h-3 w-3" />
                 </Button>
               </div>
             </div>

             <AnimatePresence>
               {!isCurrentVersion && (
                 <motion.div
                   className="left-0 absolute h-dvh w-[500px] top-0 bg-zinc-700/50 z-50"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                 />
               )}
             </AnimatePresence>

             <div className="flex flex-col h-full justify-between items-center gap-1">
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

               <form className="flex flex-row gap-2 relative items-end w-full px-2 pb-9 mb-1">
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

         {/* New toolbar with centered last update text - now comes from top after artifact slides in */}
         <AnimatePresence>
           {toolbarVisible && (
             <motion.div 
               className={`fixed z-[60] flex flex-row items-center justify-between ${isMobile || isFullScreen ? 'left-12 right-3 top-4' : 'left-[500px] right-1 top-1'}`}
               initial={{ opacity: 0, y: -50 }}  // Start from above the screen
               animate={{ 
                 opacity: 1, 
                 y: 0,
                 transition: { 
                   type: 'spring', 
                   stiffness: 100, 
                   damping: 20,
                   delay: 0.4,  // Delay until after artifact slides in
                   duration: 0.5 
                 }
               }}
               exit={{ 
                 opacity: 0, 
                 y: -50,  // Exit to top of screen
                 transition: { duration: 0.3 }
               }}
             >
               <div className="flex items-center bg-zinc-900 dark:bg-zinc-900 rounded-lg shadow-md mt-1">
                 <Button
                   variant={activeTab === "preview" ? "secondary" : "ghost"}
                   className={`flex items-center gap-1 px-2 py-1 text-xs h-8 ${activeTab === "preview" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
                   onClick={() => setActiveTab("preview")}
                 >
                   <Monitor className="h-3 w-3" />
                 </Button>

                 <Button
                   variant={activeTab === "code" ? "secondary" : "ghost"}
                   className={`flex items-center gap-1 text-xs h-8 ${activeTab === "code" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
                   onClick={() => setActiveTab("code")}
                 >
                   <Code className="h-3 w-3" />
                 </Button>

                 <Button
                   variant={activeTab === "console" ? "secondary" : "ghost"}
                   className={`flex items-center gap-1 px-2 py-2 text-xs h-8 ${activeTab === "console" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
                   onClick={() => setActiveTab("console")}
                 >
                   <Terminal className="h-3 w-3" />
                   <span>Console</span>
                 </Button>
               </div>

               {/* Centered last update info */}
               <div className="absolute left-1/2 transform -translate-x-1/2 text-xs text-zinc-400 border border-zinc-700 bg-zinc-800 rounded-lg px-2 py-1">
                 {isContentDirty ? (
                   <div className="animate-pulse">Saving changes...</div>
                 ) : document?.createdAt ? (
                   <div>{getLastUpdateText()}</div>
                 ) : (
                   <div className="w-32 h-3 bg-zinc-700 rounded-md animate-pulse" />
                 )}
               </div>

               <div className="flex items-center gap-2">
                 <div className="flex items-center bg-zinc-900 dark:bg-zinc-900 rounded-lg mr-2 shadow-md p-0.5">
                   <Button
                     variant="ghost"
                     className="text-zinc-400 hover:text-zinc-100 px-2 py-1 h-7"
                     size="sm"
                   >
                     <Smartphone className="h-3 w-3" />
                   </Button>
                   
                   <Button
                     variant="ghost"
                     className="text-zinc-400 hover:text-zinc-100 px-2 py-1 h-7"
                     size="sm"
                   >
                     <Laptop className="h-3 w-3" />
                   </Button>
                   
                   <Button
                     variant="ghost"
                     className="text-zinc-400 hover:text-zinc-100 px-2 py-1 h-7"
                     size="sm"
                   >
                     <Monitor className="h-3 w-3" />
                   </Button>
                 </div>

                 <Button 
                   variant="default"
                   size="sm"
                   className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 py-1 rounded-lg font-medium flex items-center gap-1 text-xs h-7"
                 >
                   <Rocket className="h-3 w-3" />
                   Deploy
                 </Button>
               </div>
             </motion.div>
           )}
         </AnimatePresence>

         {/* Artifact content panel - adjust for full-screen mode */}
         <motion.div
           className="fixed h-[80vh] flex flex-col overflow-y-scroll bg-background dark:bg-background mt-1 mt-4 pb-2 rounded-lg border border-zinc-200 dark:border-zinc-700"
           initial={{
            opacity: 0,
            x: windowWidth, // Start from right edge
            y: 36,
            height: isMobile ? '90vh' : isFullScreen ? '85vh' : '93vh',
            width: isMobile ? windowWidth - 40 : isFullScreen ? windowWidth - 50 : windowWidth - 485 - 20,
            borderRadius: 8,
          }}
          animate={{
            opacity: 1,
            x: isMobile ? 0 : isFullScreen ? 0 : 500,
            y: 36, // Position below toolbar
            height: isMobile ? '90vh' : isFullScreen ? '85vh' : '93vh',
            width: isMobile ? windowWidth - 40 : isFullScreen ? windowWidth - 50 : windowWidth - 485 - 20,
            borderRadius: 8,
            marginTop: isMobile ? 2 : isFullScreen ? 4 : 6,
            marginRight: isMobile ? 0 : isFullScreen ? 0 : 1,
            marginBottom: isMobile ? 4 : isFullScreen ? 20 : 14,
            transition: { 
              type: 'spring', 
              stiffness: 100, 
              damping: 20,
              mass: 1.2,
              duration: 0.6 
            },
          }}
          exit={{
            opacity: 0,
            x: windowWidth, // Exit to right edge
            transition: { 
              type: 'spring', 
              stiffness: 100, 
              damping: 20,
              mass: 1.2,
              duration: 0.7 
            },
          }}
        >
          {renderContent()}
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