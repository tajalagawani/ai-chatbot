// 'use client';

// import { EditorView } from '@codemirror/view';
// import { EditorState, Transaction } from '@codemirror/state';
// import { oneDark } from '@codemirror/theme-one-dark';
// import { basicSetup } from 'codemirror';
// import React, { memo, useEffect, useRef, useState, useCallback } from 'react';
// import { Network, Layout, PlayCircle, AlertCircle, RefreshCw, Loader2, Maximize2, Minimize2 } from 'lucide-react';
// import { toast } from 'sonner';
// import { PlayIcon, CopyIcon, UndoIcon, RedoIcon, LogsIcon, MessageIcon } from '@/components/icons';
// import { Console } from '@/components/console';
// import { generateUUID } from '@/lib/utils';
// import { dockerService } from '@/lib/services/docker';
// import { Button } from '@/components/ui/button';
// import { ActFlowVisualizer, isActContent } from '@/components/ActFlowVisualizer';
// import { useWindowSize } from 'usehooks-ts';

// // Basic Alert Components
// const Alert = ({
//   children,
//   variant = 'default',
//   className = ''
// }: {
//   children: React.ReactNode;
//   variant?: 'default' | 'destructive';
//   className?: string;
// }) => (
//   <div className={`p-4 rounded-lg border ${variant === 'destructive' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-gray-50 border-gray-200 text-gray-900'} ${className}`}>
//     {children}
//   </div>
// );

// const AlertTitle = ({ children }: { children: React.ReactNode }) => (
//   <div className="font-semibold mb-1">{children}</div>
// );

// const AlertDescription = ({ children }: { children: React.ReactNode }) => (
//   <div className="text-sm opacity-90">{children}</div>
// );

// // Docker Status Component
// const DockerStatus = ({ 
//   status,
//   containerId,
//   port
// }: { 
//   status: 'ready' | 'unavailable' | 'running' | 'stopped' | 'error',
//   containerId?: string | null,
//   port?: number | null
// }) => {
//   const statusIndicators = {
//     'ready': { color: 'bg-green-50 text-green-700', dot: 'bg-green-500', text: 'Docker Ready' },
//     'unavailable': { color: 'bg-red-50 text-red-700', dot: 'bg-red-500', text: 'Docker Unavailable' },
//     'running': { color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500', text: 'Container Running' },
//     'stopped': { color: 'bg-gray-50 text-gray-700', dot: 'bg-gray-500', text: 'Container Stopped' },
//     'error': { color: 'bg-red-50 text-red-700', dot: 'bg-red-500', text: 'Container Error' }
//   };

//   const indicator = statusIndicators[status];

//   return (
//     <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${indicator.color}`}>
//       <div className={`w-2 h-2 rounded-full animate-pulse ${indicator.dot}`} />
//       <span className="text-sm font-medium">{indicator.text}</span>
//       {containerId && status === 'running' && (
//         <>
//           <span className="text-xs opacity-75 ml-1">ID: {containerId.substring(0, 8)}</span>
//           {port && <span className="text-xs opacity-75 ml-1">Port: {port}</span>}
//         </>
//       )}
//     </div>
//   );
// };

// // Enhanced Code Editor Component
// const CodeEditor = memo(({ content, onSaveContent }: {
//   content: string;
//   onSaveContent: (content: string, debounce: boolean) => void;
// }) => {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const editorRef = useRef<EditorView | null>(null);
//   const [isEditorReady, setIsEditorReady] = useState(false);

//   // Initialize editor
//   useEffect(() => {
//     if (containerRef.current && !editorRef.current) {
//       try {
//         // Define a custom theme that provides a dark background and gutter styling
//         const customTheme = EditorView.theme({
//           "&": { 
//             backgroundColor: "#1e1e1e",
//             height: "100%"
//           },
//           ".cm-content": { 
//             padding: "10px 0"
//           },
//           ".cm-gutters": { 
//             backgroundColor: "#1e1e1e",
//             borderRight: "1px solid #3c3c3c"
//           },
//           ".cm-activeLineGutter": {
//             backgroundColor: "#252526"
//           }
//         });

//         // Order extensions so that oneDark’s syntax highlighting is applied last.
//         const startState = EditorState.create({
//           doc: content,
//           extensions: [basicSetup, customTheme, oneDark],
//         });

//         editorRef.current = new EditorView({
//           state: startState,
//           parent: containerRef.current,
//         });

//         setIsEditorReady(true);
//       } catch (error) {
//         console.error('Error initializing editor:', error);
//         toast.error('Failed to initialize code editor');
//       }
//     }

//     return () => {
//       if (editorRef.current) {
//         try {
//           editorRef.current.destroy();
//           editorRef.current = null;
//           setIsEditorReady(false);
//         } catch (error) {
//           console.error('Error destroying editor:', error);
//         }
//       }
//     };
//   }, []);

//   // Handle content updates
//   useEffect(() => {
//     if (!editorRef.current || !isEditorReady) return;

//     try {
//       const updateListener = EditorView.updateListener.of((update) => {
//         if (update.docChanged) {
//           const transaction = update.transactions.find(
//             (tr) => !tr.annotation(Transaction.remote),
//           );

//           if (transaction) {
//             const newContent = update.state.doc.toString();
//             onSaveContent(newContent, true);
//           }
//         }
//       });

//       // Reuse the same custom theme and apply updateListener before oneDark so that oneDark remains the last extension.
//       const customTheme = EditorView.theme({
//         ".cm-gutters": { backgroundColor: "#1e1e1e" },
//       });

//       const newState = EditorState.create({
//         doc: editorRef.current.state.doc,
//         extensions: [basicSetup, customTheme, updateListener, oneDark],
//       });

//       editorRef.current.setState(newState);
//     } catch (error) {
//       console.error('Error setting up editor updates:', error);
//       toast.error('Failed to initialize editor updates');
//     }
//   }, [onSaveContent, isEditorReady]);

//   // Sync external content changes
//   useEffect(() => {
//     if (!editorRef.current || !content || !isEditorReady) return;

//     try {
//       const currentContent = editorRef.current.state.doc.toString();
//       if (currentContent !== content) {
//         const transaction = editorRef.current.state.update({
//           changes: {
//             from: 0,
//             to: currentContent.length,
//             insert: content,
//           },
//           annotations: [Transaction.remote.of(true)],
//         });
//         editorRef.current.dispatch(transaction);
//       }
//     } catch (error) {
//       console.error('Error syncing editor content:', error);
//       toast.error('Failed to update editor content');
//     }
//   }, [content, isEditorReady]);

//   return (
//     <div className="w-full h-full relative">
//       <div ref={containerRef} className="w-full h-full" />
//       {!isEditorReady && (
//         <div className="absolute inset-0 flex items-center justify-center bg-background/50">
//           <Loader2 className="w-6 h-6 animate-spin" />
//         </div>
//       )}
//     </div>
//   );
// });

// CodeEditor.displayName = 'CodeEditor';

// // Main artifact export
// export const codeArtifact = {
//   kind: 'code' as const,
//   description: 'ACT Workflow Configuration',
  
//   initialize: async ({ setMetadata }) => {
//     console.log('Initializing code artifact...');
//     const newArtifactId = generateUUID();
//     console.log('Generated artifact ID:', newArtifactId);
  
//     try {
//       const isDockerHealthy = await dockerService.checkHealth();
//       console.log('Docker health status:', isDockerHealthy);
      
//       const metadata = {
//         isValid: true,
//         flowData: null,
//         viewMode: 'code',
//         artifactId: newArtifactId,
//         containerId: null,
//         port: null,
//         containerStatus: 'stopped',
//         executionId: null,
//         executionStatus: null,
//         executionResult: null,
//         outputs: [{
//           id: generateUUID(),
//           contents: [{
//             type: 'text',
//             value: `> Docker status: ${isDockerHealthy ? 'ready' : 'unavailable'}`
//           }],
//           status: isDockerHealthy ? 'completed' : 'failed'
//         }],
//         dockerStatus: isDockerHealthy ? 'ready' : 'unavailable',
//         lastError: null
//       };
  
//       console.log('Setting initial metadata:', metadata);
//       setMetadata(metadata);
  
//       if (!isDockerHealthy) {
//         throw new Error('Docker service is unavailable');
//       }
//     } catch (error) {
//       console.error('Initialization error:', error);
//       const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      
//       setMetadata({
//         isValid: true,
//         flowData: null,
//         viewMode: 'code',
//         artifactId: newArtifactId,
//         containerId: null,
//         port: null,
//         containerStatus: 'stopped',
//         executionId: null,
//         executionStatus: null,
//         executionResult: null,
//         outputs: [{
//           id: generateUUID(),
//           contents: [{
//             type: 'text',
//             value: `> Initialization error: ${errorMessage}`
//           }],
//           status: 'failed'
//         }],
//         dockerStatus: 'unavailable',
//         lastError: errorMessage
//       });
  
//       toast.error(`Docker initialization failed: ${errorMessage}`);
//     }
//   },

//   content: ({ content, onSaveContent, metadata, setMetadata }) => {
//     const [viewMode, setViewMode] = useState('code');
//     const [isExecuting, setIsExecuting] = useState(false);
//     const [isFlowView, setIsFlowView] = useState(false);
//     const [showFlowOption, setShowFlowOption] = useState(false);
//     const [isFlowFullscreen, setIsFlowFullscreen] = useState(false);
//     const { width: windowWidth, height: windowHeight } = useWindowSize();
//     const [initialViewSet, setInitialViewSet] = useState(false);

//     // Handle updates from flow to code
//     const handleFlowContentChange = useCallback((updatedContent: string) => {
//       if (!updatedContent) return;
//       onSaveContent(updatedContent, false);
//     }, [onSaveContent]);

//     // Monitor execution status
//     useEffect(() => {
//       if (!metadata?.executionId || !metadata?.port) return;

//       let isMounted = true;

//       const checkExecutionStatus = async () => {
//         try {
//           const response = await fetch(
//             `http://localhost:${metadata.port}/status/${metadata.executionId}`,
//             { signal: AbortSignal.timeout(5000) }
//           );
          
//           if (!response.ok || !isMounted) return;
          
//           const data = await response.json();
          
//           setMetadata(prev => ({
//             ...prev,
//             outputs: [
//               ...(prev.outputs || []),
//               {
//                 id: generateUUID(),
//                 contents: [{
//                   type: 'text',
//                   value: `> Execution status: ${data.status}${data.message ? ` - ${data.message}` : ''}`
//                 }],
//                 status: 'in_progress'
//               }
//             ]
//           }));
          
//           if (data.status === 'completed' || data.status === 'failed') {
//             setMetadata(prev => ({
//               ...prev,
//               executionId: null,
//               executionStatus: data.status,
//               containerStatus: 'running',
//               outputs: [
//                 ...(prev.outputs || []),
//                 {
//                   id: generateUUID(),
//                   contents: [{
//                     type: 'text',
//                     value: data.status === 'completed' 
//                       ? `> Execution completed: ${JSON.stringify(data.result, null, 2)}`
//                       : `> Execution failed: ${data.message || data.error || 'Unknown error'}`
//                   }],
//                   status: data.status === 'completed' ? 'completed' : 'failed'
//                 }
//               ]
//             }));

//             setIsExecuting(false);
//             toast(data.status === 'completed' ? 'Execution completed' : 'Execution failed');
//           }
//         } catch (error) {
//           if (!isMounted) return;
          
//           console.error('Error checking execution status:', error);
//           const errorMessage = error instanceof Error ? error.message : 'Unknown status check error';
          
//           setMetadata(prev => ({
//             ...prev,
//             outputs: [
//               ...(prev.outputs || []),
//               {
//                 id: generateUUID(),
//                 contents: [{
//                   type: 'text',
//                   value: `> Error checking status: ${errorMessage}`
//                 }],
//                 status: 'failed'
//               }
//             ]
//           }));
//         }
//       };

//       const interval = setInterval(checkExecutionStatus, 1000);
//       return () => {
//         isMounted = false;
//         clearInterval(interval);
//       };
//     }, [metadata?.executionId, metadata?.port, setMetadata]);

//     // Handle fullscreen escape key
//     useEffect(() => {
//       const handleKeyDown = (event: KeyboardEvent) => {
//         if (event.key === 'Escape' && isFlowFullscreen) {
//           setIsFlowFullscreen(false);
//         }
//       };

//       window.addEventListener('keydown', handleKeyDown);
//       return () => window.removeEventListener('keydown', handleKeyDown);
//     }, [isFlowFullscreen]);

//     // Parse content and check if it's ACT content
//     useEffect(() => {
//       if (!content) return;

//       try {
//         const actContentDetected = isActContent(content);
//         setShowFlowOption(actContentDetected);
        
//         if (!initialViewSet && actContentDetected) {
//           setIsFlowView(true);
//           setViewMode('flow');
//           setInitialViewSet(true);
//         }
//       } catch (error) {
//         console.error('Failed to parse ACT file:', error);
//         setMetadata(prev => ({
//           ...prev,
//           flowData: null,
//           isValid: false
//         }));
//       }
//     }, [content, setMetadata, initialViewSet]);

//     return (
//       <div className="relative w-full h-full">
//         <div className="absolute top-2 right-2 z-10 flex gap-2">
//           <DockerStatus 
//             status={metadata?.dockerStatus === 'unavailable' 
//               ? 'unavailable' 
//               : metadata?.containerStatus || 'stopped'
//             } 
//             containerId={metadata?.containerId}
//             port={metadata?.port}
//           />
//         </div>

//         <div className="absolute top-2 left-2 z-10 flex gap-2">
//           {showFlowOption && (
//             <button
//               onClick={() => {
//                 const newIsFlowView = !isFlowView;
//                 setIsFlowView(newIsFlowView);
//                 setViewMode(newIsFlowView ? 'flow' : 'code');
//               }}
//               className="p-2 rounded-lg hover:bg-muted transition-colors flex items-center gap-1"
//               title={isFlowView ? 'Switch to Code View' : 'Switch to Flow View'}
//             >
//               {isFlowView ? (
//                 <>
//                   <Layout size={18} />
//                   <span className="text-sm">Code</span>
//                 </>
//               ) : (
//                 <>
//                   <Network size={18} />
//                   <span className="text-sm">Flow</span>
//                 </>
//               )}
//             </button>
//           )}
          
//           {isFlowView && showFlowOption && (
//             <Button
//               variant="secondary"
//               onClick={() => setIsFlowFullscreen(!isFlowFullscreen)}
//               className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${
//                 isFlowFullscreen ? 'fixed top-4 right-4 z-50 bg-secondary/80 hover:bg-secondary' : ''
//               }`}
//               title={isFlowFullscreen ? 'Press Esc or click to exit fullscreen' : 'Enter Fullscreen'}
//             >
//               {isFlowFullscreen ? (
//                 <>
//                   <Minimize2 size={18} />
//                   <span> (Esc)</span>
//                 </>
//               ) : (
//                 <>
//                   <Maximize2 size={14} />
//                 </>
//               )}
//             </Button>
//           )}
//         </div>

//         {isFlowView && showFlowOption ? (
//           <div style={{ 
//             width: '100%', 
//             height: isFlowFullscreen ? '100vh' : 'calc(100vh - 80px)',
//             position: isFlowFullscreen ? 'fixed' : 'relative',
//             top: isFlowFullscreen ? '0' : 'auto',
//             left: isFlowFullscreen ? '0' : 'auto'
//           }}>
//             <ActFlowVisualizer 
//               content={content}
//               isStreaming={metadata?.status === 'streaming'}
//               metadata={metadata}
//               setMetadata={setMetadata}
//               onContentChange={handleFlowContentChange}
//             />
//           </div>
//         ) : (
//           <div className="w-full h-[calc(100vh-80px)]">
//             <CodeEditor content={content} onSaveContent={onSaveContent} />
//             {metadata?.isValid === false && (
//               <Alert variant="destructive" className="mt-4">
//                 <AlertCircle className="h-4 w-4" />
//                 <AlertTitle>Invalid ACT Configuration</AlertTitle>
//                 <AlertDescription>
//                   Please check your workflow configuration for errors.
//                 </AlertDescription>
//               </Alert>
//             )}
//           </div>
//         )}

//         {!isFlowFullscreen && metadata?.outputs && metadata.outputs.length > 0 && (
//           <Console
//             consoleOutputs={metadata.outputs}
//             setConsoleOutputs={() => {
//               setMetadata({
//                 ...metadata,
//                 outputs: [],
//               });
//             }}
//           />
//         )}
//       </div>
//     );
//   },

//   actions: [
//     {
//       icon: <PlayCircle size={18} />,
//       label: 'Start',
//       description: 'Prepare workflow for execution',
//       onClick: async ({ setMetadata, metadata }) => {
//         try {
//           if (!metadata?.artifactId) {
//             throw new Error('No artifact ID found in metadata');
//           }
      
//           const isHealthy = await dockerService.checkHealth();
//           if (!isHealthy) {
//             throw new Error('Docker service is not available');
//           }
      
//           const containerInfo = dockerService.getContainerStatus(metadata.artifactId);
//           if (containerInfo.status === 'running' && containerInfo.containerId) {
//             toast.info('Container is already running');
//             return;
//           }
      
//           setMetadata(prev => ({
//             ...prev,
//             containerStatus: 'pending',
//             outputs: [
//               ...(prev.outputs || []),
//               {
//                 id: generateUUID(),
//                 contents: [{
//                   type: 'text',
//                   value: '> Starting Docker container...'
//                 }],
//                 status: 'in_progress'
//               }
//             ]
//           }));
      
//           const success = await dockerService.startContainer(metadata.artifactId);
          
//           if (success) {
//             const containerInfo = dockerService.getContainerStatus(metadata.artifactId);
            
//             setMetadata(prev => ({
//               ...prev,
//               containerStatus: containerInfo.status,
//               containerId: containerInfo.containerId,
//               port: containerInfo.port,
//               lastError: containerInfo.lastError,
//               outputs: [
//                 ...(prev.outputs || []),
//                 {
//                   id: generateUUID(),
//                   contents: [{
//                     type: 'text',
//                     value: `> Container started successfully
// > ID: ${containerInfo.containerId?.substring(0, 12) || 'unknown'}
// > Port: ${containerInfo.port || 'unknown'}
// > Status: ${containerInfo.status}`
//                   }],
//                   status: 'completed',
//                 }
//               ]
//             }));
            
//             toast.success('Container is ready for execution');
//           } else {
//             throw new Error('Container failed to start');
//           }
//         } catch (error) {
//           const errorMessage = error instanceof Error ? error.message : 'Failed to start container';
//           console.error(`Container start error: ${errorMessage}`);
          
//           setMetadata(prev => ({
//             ...prev,
//             containerStatus: 'error',
//             lastError: errorMessage,
//             outputs: [
//               ...(prev.outputs || []),
//               {
//                 id: generateUUID(),
//                 contents: [{
//                   type: 'text',
//                   value: `> Error starting container: ${errorMessage}`
//                 }],
//                 status: 'failed'
//               }
//             ]
//           }));
          
//           toast.error(errorMessage);
//         }
//       },
//       isDisabled: ({ metadata }) => metadata?.dockerStatus === 'unavailable'
//     },
//     {
//       icon: <PlayCircle size={18} />,
//       label: 'Run Agent',
//       description: 'Run workflow in container',
//       onClick: async ({ setMetadata, content, metadata }) => {
//         try {
//           if (!metadata?.artifactId) {
//             throw new Error('Missing artifact ID');
//           }
    
//           const containerInfo = dockerService.getContainerStatus(metadata.artifactId);
//           if (containerInfo.status !== 'running' || !containerInfo.containerId) {
//             throw new Error('Container is not running. Please start it first.');
//           }
    
//           setMetadata(prev => ({
//             ...prev,
//             executionStatus: 'running',
//             outputs: [
//               ...(prev.outputs || []),
//               {
//                 id: generateUUID(),
//                 contents: [{
//                   type: 'text',
//                   value: '> Starting workflow execution...'
//                 }],
//                 status: 'in_progress',
//               }
//             ]
//           }));
    
//           const response = await fetch(
//             `http://localhost:${containerInfo.port}/execute`,
//             {
//               method: 'POST',
//               headers: { 'Content-Type': 'application/json' },
//               body: JSON.stringify({ content })
//             }
//           );
    
//           if (!response.ok) {
//             throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
//           }
    
//           const result = await response.json();
    
//           if (result.status === 'accepted') {
//             setMetadata(prev => ({
//               ...prev,
//               executionId: result.execution_id,
//               executionStatus: 'running',
//               containerStatus: 'running',
//               outputs: [
//                 ...(prev.outputs || []),
//                 {
//                   id: generateUUID(),
//                   contents: [{
//                     type: 'text',
//                     value: `> Workflow queued for execution
// > Execution ID: ${result.execution_id}`
//                   }],
//                   status: 'in_progress'
//                 }
//               ]
//             }));
//           }
//         } catch (error) {
//           const errorMessage = error instanceof Error ? error.message : 'Failed to execute workflow';
//           console.error('Execution error:', errorMessage);
          
//           setMetadata(prev => ({
//             ...prev,
//             executionStatus: 'failed',
//             outputs: [
//               ...(prev.outputs || []),
//               {
//                 id: generateUUID(),
//                 contents: [{
//                   type: 'text',
//                   value: `> Error executing workflow: ${errorMessage}`
//                 }],
//                 status: 'failed'
//               }
//             ]
//           }));
    
//           toast.error(errorMessage);
//         }
//       },
//       isDisabled: ({ metadata }) => 
//         !metadata?.containerStatus || 
//         metadata.containerStatus !== 'running' || 
//         metadata.executionStatus === 'running'
//     },
//     {
//       icon: <PlayCircle size={18} className="text-red-500" />,
//       label: 'Stop',
//       description: 'Stop the agent',
//       onClick: async ({ setMetadata, metadata }) => {
//         try {
//           if (!metadata?.artifactId) {
//             throw new Error('Missing artifact ID');
//           }

//           const containerInfo = dockerService.getContainerStatus(metadata.artifactId);
//           if (containerInfo.status !== 'running' || !containerInfo.containerId) {
//             toast.info('No running container to stop');
//             return;
//           }

//           setMetadata(prev => ({
//             ...prev,
//             outputs: [
//               ...(prev.outputs || []),
//               {
//                 id: generateUUID(),
//                 contents: [{
//                   type: 'text',
//                   value: '> Stopping container...'
//                 }],
//                 status: 'in_progress'
//               }
//             ]
//           }));

//           const success = await dockerService.stopContainer(metadata.artifactId);
//           if (success) {
//             setMetadata(prev => ({
//               ...prev,
//               containerStatus: 'stopped',
//               containerId: null,
//               port: null,
//               outputs: [
//                 ...(prev.outputs || []),
//                 {
//                   id: generateUUID(),
//                   contents: [{
//                     type: 'text',
//                     value: '> Container stopped successfully'
//                   }],
//                   status: 'completed'
//                 }
//               ]
//             }));
            
//             toast.success('Container stopped successfully');
//           } else {
//             throw new Error('Failed to stop container');
//           }
//         } catch (error) {
//           const errorMessage = error instanceof Error ? error.message : 'Failed to stop container';
          
//           setMetadata(prev => ({
//             ...prev,
//             lastError: errorMessage,
//             outputs: [
//               ...(prev.outputs || []),
//               {
//                 id: generateUUID(),
//                 contents: [{
//                   type: 'text',
//                   value: `> Error stopping container: ${errorMessage}`
//                 }],
//                 status: 'failed'
//               }
//             ]
//           }));
          
//           toast.error(errorMessage);
//         }
//       },
//       isDisabled: ({ metadata }) => metadata?.containerStatus !== 'running'
//     },
//     {
//       icon: <RefreshCw size={18} />,
//       label: 'Reset',
//       description: 'Reset execution state and stop container',
//       onClick: async ({ setMetadata, metadata }) => {
//         try {
//           setMetadata(prev => ({
//             ...prev,
//             outputs: [
//               ...(prev.outputs || []),
//               {
//                 id: generateUUID(),
//                 contents: [{
//                   type: 'text',
//                   value: '> Resetting environment...'
//                 }],
//                 status: 'in_progress'
//               }
//             ]
//           }));

//           if (metadata?.containerStatus === 'running' && metadata?.artifactId) {
//             try {
//               await dockerService.stopContainer(metadata.artifactId);
              
//               setMetadata(prev => ({
//                 ...prev,
//                 outputs: [
//                   ...(prev.outputs || []),
//                   {
//                     id: generateUUID(),
//                     contents: [{
//                       type: 'text',
//                       value: '> Successfully stopped container'
//                     }],
//                     status: 'completed'
//                   }
//                 ]
//               }));
//             } catch (error) {
//               console.warn('Failed to stop container during reset:', error);
//               const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              
//               setMetadata(prev => ({
//                 ...prev,
//                 outputs: [
//                   ...(prev.outputs || []),
//                   {
//                     id: generateUUID(),
//                     contents: [{
//                       type: 'text',
//                       value: `> Warning: Failed to stop container: ${errorMsg}`
//                     }],
//                     status: 'failed'
//                   }
//                 ]
//               }));
//             }
//           }
          
//           const isDockerHealthy = await dockerService.checkHealth();
//           const artifactId = metadata?.artifactId || generateUUID();
          
//           setMetadata({
//             isValid: true,
//             flowData: null,
//             viewMode: 'code',
//             artifactId: artifactId,
//             containerId: null,
//             port: null,
//             containerStatus: 'stopped',
//             executionId: null,
//             executionStatus: null,
//             executionResult: null,
//             outputs: [{
//               id: generateUUID(),
//               contents: [{
//                 type: 'text',
//                 value: `> Environment reset complete
// > Docker status: ${isDockerHealthy ? 'ready' : 'unavailable'}`
//               }],
//               status: 'completed'
//             }],
//             dockerStatus: isDockerHealthy ? 'ready' : 'unavailable',
//             lastError: null
//           });
          
//           toast.success('Environment reset successfully');
//         } catch (error) {
//           const errorMessage = error instanceof Error ? error.message : 'Reset failed';
          
//           setMetadata(prev => ({
//             ...prev,
//             outputs: [
//               ...(prev.outputs || []),
//               {
//                 id: generateUUID(),
//                 contents: [{
//                   type: 'text',
//                   value: `> Reset failed: ${errorMessage}`
//                 }],
//                 status: 'failed'
//               }
//             ],
//             lastError: errorMessage
//           }));
          
//           toast.error(errorMessage);
//         }
//       },
//       isDisabled: ({ metadata }) => metadata?.executionStatus === 'running'
//     },
//     {
//       icon: <UndoIcon size={18} />,
//       label: 'Previous Version',
//       description: 'View Previous version',
//       onClick: ({ handleVersionChange }) => {
//         handleVersionChange('prev');
//       },
//       isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0
//     },
//     {
//       icon: <RedoIcon size={18} />,
//       label: 'Next Version',
//       description: 'View Next version',
//       onClick: ({ handleVersionChange }) => {
//         handleVersionChange('next');
//       },
//       isDisabled: ({ isCurrentVersion }) => isCurrentVersion
//     },
//     {
//       icon: <CopyIcon size={18} />,
//       label: 'Copy',
//       description: 'Copy configuration to clipboard',
//       onClick: ({ content }) => {
//         if (!content) {
//           toast.error('No content to copy');
//           return;
//         }
//         navigator.clipboard.writeText(content);
//         toast.success('Copied to clipboard!');
//       }
//     }
//   ],

//   toolbar: [
//     {
//       icon: <MessageIcon />,
//       label: 'Add Comments',
//       description: 'Add comments to the ACT configuration',
//       onClick: ({ appendMessage }) => {
//         appendMessage({
//           role: 'user',
//           content: 'Add comments to the ACT configuration for better understanding',
//         });
//       },
//     },
//     {
//       icon: <LogsIcon />,
//       label: 'Add Documentation',
//       description: 'Add node documentation',
//       onClick: ({ appendMessage }) => {
//         appendMessage({
//           role: 'user',
//           content: 'Add detailed documentation for each node in the workflow',
//         });
//       },
//     }
//   ],

//   onStreamPart: ({ streamPart, setArtifact }) => {
//     if (streamPart.type === 'code-delta') {
//       setArtifact((draftArtifact) => ({
//         ...draftArtifact,
//         content: streamPart.content as string,
//         isVisible:
//           draftArtifact.status === 'streaming' &&
//           draftArtifact.content.length > 300 &&
//           draftArtifact.content.length < 310
//             ? true
//             : draftArtifact.isVisible,
//         status: 'streaming',
//       }));
//     }
//   },

//   styles: `
//     .cm-section-header {
//       color: #569cd6;
//       font-weight: bold;
//     }

//     .cm-key {
//       color: #9cdcfe;
//     }

//     .cm-value {
//       color: #ce9178;
//     }

//     .cm-node-type {
//       color: #4ec9b0;
//     }

//     .cm-comment {
//       color: #6a9955;
//       font-style: italic;
//     }

//     .react-flow__node {
//       padding: 10px;
//       border-radius: 5px;
//       font-size: 12px;
//       color: #333;
//       text-align: center;
//       border-width: 2px;
//       width: 150px;
//     }

//     .react-flow__node.running {
//       border-color: #3b82f6;
//       background-color: #eff6ff;
//     }

//     .react-flow__node.completed {
//       border-color: #22c55e;
//       background-color: #f0fdf4;
//     }

//     .react-flow__node.failed {
//       border-color: #ef4444;
//       background-color: #fef2f2;
//     }

//     .react-flow__edge-path {
//       stroke-width: 2;
//     }

//     .react-flow__edge.animated path {
//       stroke-dasharray: 5;
//       animation: dashdraw 0.5s linear infinite;
//     }

//     @keyframes dashdraw {
//       from {
//         stroke-dashoffset: 10;
//       }
//     }
//   `
// };

// // Inject custom styles when in browser environment
// if (typeof document !== 'undefined') {
//   const styleSheet = document.createElement('style');
//   styleSheet.textContent = codeArtifact.styles;
//   document.head.appendChild(styleSheet);
// }

// export default codeArtifact;
