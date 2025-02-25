'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Network, Layout, Maximize2, Minimize2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useWindowSize } from 'usehooks-ts';
import { Button } from '@/components/ui/button';
import { Console } from '@/components/console';
import { ActFlowVisualizer, isActContent } from '@/components/ActFlowVisualizer';
import { generateUUID } from '@/lib/utils';
import { dockerService } from '@/lib/services/docker';

// Import our extracted components
import CodeEditor from './CodeEditor';
import DockerStatus from './DockerStatus';
import { Alert, AlertTitle, AlertDescription } from './BasicComponents';
import actions from './CodeArtifactActions';
import toolbar from './CodeArtifactToolbar';
import { styles, injectStyles } from './CodeArtifactStyles';

// Main artifact export
const codeArtifact = {
  kind: 'code',
  description: 'ACT Workflow Configuration',
  
  initialize: async ({ setMetadata }) => {
    console.log('Initializing code artifact...');
    const newArtifactId = generateUUID();
    console.log('Generated artifact ID:', newArtifactId);
  
    try {
      const isDockerHealthy = await dockerService.checkHealth();
      console.log('Docker health status:', isDockerHealthy);
      
      const metadata = {
        isValid: true,
        flowData: null,
        viewMode: 'code',
        artifactId: newArtifactId,
        containerId: null,
        port: null,
        containerStatus: 'stopped',
        executionId: null,
        executionStatus: null,
        executionResult: null,
        showFlowOption: true,
        isFlowFullscreen: false,
        isStreaming: false, // Add isStreaming flag to metadata
        outputs: [{
          id: generateUUID(),
          contents: [{
            type: 'text',
            value: `> Docker status: ${isDockerHealthy ? 'ready' : 'unavailable'}`
          }],
          status: isDockerHealthy ? 'completed' : 'failed'
        }],
        dockerStatus: isDockerHealthy ? 'ready' : 'unavailable',
        lastError: null
      };
  
      console.log('Setting initial metadata:', metadata);
      setMetadata(metadata);
  
      if (!isDockerHealthy) {
        throw new Error('Docker service is unavailable');
      }
    } catch (error) {
      console.error('Initialization error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      
      setMetadata({
        isValid: true,
        flowData: null,
        viewMode: 'code',
        artifactId: newArtifactId,
        containerId: null,
        port: null,
        containerStatus: 'stopped',
        executionId: null,
        executionStatus: null,
        executionResult: null,
        showFlowOption: true,
        isFlowFullscreen: false,
        isStreaming: false,
        outputs: [{
          id: generateUUID(),
          contents: [{
            type: 'text',
            value: `> Initialization error: ${errorMessage}`
          }],
          status: 'failed'
        }],
        dockerStatus: 'unavailable',
        lastError: errorMessage
      });
  
      toast.error(`Agent initialization failed: ${errorMessage}`);
    }
  },

  content: ({ content, onSaveContent, metadata, setMetadata }) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [initialViewSet, setInitialViewSet] = useState(false);
    const { width: windowWidth, height: windowHeight } = useWindowSize();
    const [flowContentUpdated, setFlowContentUpdated] = useState(false);
    const contentRef = useRef(content);
    const lastSavedContentRef = useRef(content);
    const isStreamingRef = useRef(false);

    // Use a separate controlled view mode that doesn't rely on metadata
    const [viewMode, setViewMode] = useState(metadata?.viewMode || 'code');
    
    // Use a ref to track the latest metadata viewMode
    const metadataViewModeRef = useRef(metadata?.viewMode || 'code');
    
    // Track streaming state for auto-save prevention
    useEffect(() => {
      isStreamingRef.current = metadata?.status === 'streaming';
      
      // When streaming starts, update metadata
      if (metadata?.status === 'streaming') {
        setMetadata(prev => ({
          ...prev,
          isStreaming: true
        }));
      } 
      // When streaming ends, process final content sync and update metadata
      else if (metadata?.status !== 'streaming' && metadata?.isStreaming) {
        console.log('Streaming ended, processing final sync');
        
        // Allow a short delay before re-enabling auto-save
        setTimeout(() => {
          setMetadata(prev => ({
            ...prev,
            isStreaming: false
          }));
        }, 500);
      }
    }, [metadata?.status, setMetadata]);
    
    // Update the ref whenever metadata.viewMode changes
    useEffect(() => {
      if (metadata?.viewMode) {
        metadataViewModeRef.current = metadata.viewMode;
        setViewMode(metadata.viewMode);
      }
    }, [metadata?.viewMode]);

    // Keep track of the latest content
    useEffect(() => {
      contentRef.current = content;
    }, [content]);

    // Add a debug message/toast when content changes
    useEffect(() => {
      if (content !== lastSavedContentRef.current) {
        console.log('Content changed from:', lastSavedContentRef.current?.substring(0, 50), 'to:', content?.substring(0, 50));
        lastSavedContentRef.current = content;
      }
    }, [content]);

    // Create a wrapped onSaveContent that checks streaming state
    const handleSaveContent = useCallback((updatedContent, debounce = true) => {
      // Skip auto-save during streaming
      if (isStreamingRef.current && debounce) {
        console.log('Auto-save skipped during streaming');
        return;
      }
      
      // Process save normally
      onSaveContent(updatedContent, debounce);
    }, [onSaveContent]);

    // Handle updates from flow to code with explicit debugging
    const handleFlowContentChange = useCallback((updatedContent) => {
      console.log('handleFlowContentChange called with content:', updatedContent?.substring(0, 50));
      
      if (!updatedContent) {
        console.warn('Flow provided empty content, ignoring update');
        return;
      }
      
      if (updatedContent === contentRef.current) {
        console.log('Content unchanged, skipping save');
        return;
      }
      
      // Skip flow updates during streaming
      if (isStreamingRef.current) {
        console.log('Flow update skipped during streaming');
        return;
      }
      
      console.log('FLOW CONTENT UPDATED, SAVING TO CODE CONTENT');
      toast.info('Flow changes saved to code');
      setFlowContentUpdated(true);
      
      // Force the content to update
      lastSavedContentRef.current = updatedContent;
      onSaveContent(updatedContent, false);
      
      // Log to confirm content was updated
      console.log('Content updated from flow:', updatedContent.substring(0, 100) + '...');
    }, [onSaveContent]);

    // Define a custom toggle handler that uses the ref for current state
    const handleToggleView = useCallback(() => {
      // Skip view toggle during streaming
      if (isStreamingRef.current) {
        toast.warning('Cannot change views during content streaming');
        return;
      }
      
      // Get the current view mode from our ref
      const currentViewMode = metadataViewModeRef.current;
      
      // If we're switching from flow to code and have pending changes, ensure they're saved
      if (currentViewMode === 'flow' && flowContentUpdated) {
        console.log('Ensuring flow changes are saved before switching to code view');
        toast.info('Flow changes saved before switching views');
        setFlowContentUpdated(false);
      }
      
      // Calculate the new view mode
      const newViewMode = currentViewMode === 'flow' ? 'code' : 'flow';
      
      console.log(`Toggle from ${currentViewMode} to ${newViewMode}`);
      
      // Update our local state immediately
      setViewMode(newViewMode);
      
      // Update the ref
      metadataViewModeRef.current = newViewMode;
      
      // Update the metadata
      setMetadata(prev => {
        console.log('Previous metadata:', prev);
        return {
          ...prev,
          viewMode: newViewMode
        };
      });
    }, [setMetadata, flowContentUpdated]);

    // Monitor execution status
    useEffect(() => {
      if (!metadata?.executionId || !metadata?.port) return;

      let isMounted = true;

      const checkExecutionStatus = async () => {
        try {
          const response = await fetch(
            `http://localhost:${metadata.port}/status/${metadata.executionId}`,
            { signal: AbortSignal.timeout(5000) }
          );
          
          if (!response.ok || !isMounted) return;
          
          const data = await response.json();
          
          setMetadata(prev => ({
            ...prev,
            outputs: [
              ...(prev.outputs || []),
              {
                id: generateUUID(),
                contents: [{
                  type: 'text',
                  value: `> Execution status: ${data.status}${data.message ? ` - ${data.message}` : ''}`
                }],
                status: 'in_progress'
              }
            ]
          }));
          
          if (data.status === 'completed' || data.status === 'failed') {
            setMetadata(prev => ({
              ...prev,
              executionId: null,
              executionStatus: data.status,
              containerStatus: 'running',
              outputs: [
                ...(prev.outputs || []),
                {
                  id: generateUUID(),
                  contents: [{
                    type: 'text',
                    value: data.status === 'completed' 
                      ? `> Execution completed: ${JSON.stringify(data.result, null, 2)}`
                      : `> Execution failed: ${data.message || data.error || 'Unknown error'}`
                  }],
                  status: data.status === 'completed' ? 'completed' : 'failed'
                }
              ]
            }));

            setIsExecuting(false);
            toast(data.status === 'completed' ? 'Execution completed' : 'Execution failed');
          }
        } catch (error) {
          if (!isMounted) return;
          
          console.error('Error checking execution status:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown status check error';
          
          setMetadata(prev => ({
            ...prev,
            outputs: [
              ...(prev.outputs || []),
              {
                id: generateUUID(),
                contents: [{
                  type: 'text',
                  value: `> Error checking status: ${errorMessage}`
                }],
                status: 'failed'
              }
            ]
          }));
        }
      };

      const interval = setInterval(checkExecutionStatus, 1000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }, [metadata?.executionId, metadata?.port, setMetadata]);

    // Handle fullscreen escape key
    useEffect(() => {
      const handleKeyDown = (event) => {
        if (event.key === 'Escape' && metadata?.isFlowFullscreen) {
          setMetadata(prev => ({
            ...prev,
            isFlowFullscreen: false
          }));
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [metadata?.isFlowFullscreen, setMetadata]);

    // Ensure flow changes are saved when switching views
    useEffect(() => {
      if (viewMode === 'code' && flowContentUpdated && !isStreamingRef.current) {
        console.log('Detected switch to code view with pending flow changes, ensuring they are saved');
        toast.info('Flow changes applied to code view');
        setFlowContentUpdated(false);
      }
    }, [viewMode, flowContentUpdated]);

    // Add direct console log to check metadata state at runtime
    useEffect(() => {
      console.log('Current metadata state:', metadata);
      console.log('Current view mode state:', viewMode);
      console.log('Ref view mode:', metadataViewModeRef.current);
      console.log('Is streaming:', isStreamingRef.current);
    }, [metadata, viewMode]);

    // Force the metadata to have showFlowOption set to true
    useEffect(() => {
      if (metadata && metadata.showFlowOption !== true) {
        console.log('Setting showFlowOption to true');
        setMetadata(prev => ({
          ...prev,
          showFlowOption: true
        }));
      }
    }, [metadata, setMetadata]);

    // Parse content and check if it's ACT content but preserve showFlowOption
    useEffect(() => {
      if (!content) return;
    
      try {
        const actContentDetected = isActContent(content);
        console.log("ACT content detected:", actContentDetected);
        
        // Skip view switching during streaming
        if (isStreamingRef.current) {
          console.log('Skipping view mode change during streaming');
          return;
        }
        
        setMetadata(prev => {
          // Calculate the new view mode, ensuring we don't override a manual setting
          let newViewMode = prev.viewMode;
          if (!initialViewSet && actContentDetected) {
            newViewMode = 'flow';
            // Update our local state and ref too
            setViewMode('flow');
            metadataViewModeRef.current = 'flow';
          }
          
          return {
            ...prev,
            // Keep showFlowOption true even if not ACT content
            showFlowOption: true,
            viewMode: newViewMode
          };
        });
        
        if (!initialViewSet && actContentDetected) {
          setInitialViewSet(true);
        }
      } catch (error) {
        console.error('Failed to parse ACT file:', error);
        setMetadata(prev => ({
          ...prev,
          flowData: null,
          // Keep isValid true and showFlowOption true even with errors
          isValid: true,
          showFlowOption: true
        }));
      }
    }, [content, setMetadata, initialViewSet]);

    // Add direct toggle support for custom actions
    useEffect(() => {
      // Find the toggle action and make it use our custom handler
      const toggleAction = actions.find(
        action => action.label === 'Toggle View' || 
                 (action.description && action.description.includes('Switch between'))
      );
      
      if (toggleAction) {
        const originalOnClick = toggleAction.onClick;
        
        // Replace with our custom handler
        toggleAction.onClick = () => {
          handleToggleView();
        };
      }
    }, [handleToggleView]);

    return (
      <div className="relative w-full h-full">
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          {/* Status indicator for streaming */}
          {isStreamingRef.current && (
            <div className="bg-blue-100 border border-blue-200 text-blue-700 px-3 py-1 rounded-md text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Streaming content...</span>
            </div>
          )}
        </div>

        {viewMode === 'flow' ? (
          <div style={{ 
            width: '100%', 
            height: metadata?.isFlowFullscreen ? '100vh' : 'calc(100vh - 80px)',
            position: metadata?.isFlowFullscreen ? 'fixed' : 'relative',
            top: metadata?.isFlowFullscreen ? '0' : 'auto',
            left: metadata?.isFlowFullscreen ? '0' : 'auto',
            zIndex: metadata?.isFlowFullscreen ? 50 : 'auto'
          }}>
            <ActFlowVisualizer 
              content={content}
              isStreaming={metadata?.status === 'streaming'}
              metadata={metadata}
              setMetadata={setMetadata}
              onContentChange={handleFlowContentChange}
              status={metadata?.status}
            />
          </div>
        ) : (
          <div className="w-full h-[calc(100vh-80px)]">
            <CodeEditor 
              content={content} 
              onSaveContent={handleSaveContent}
              status={metadata?.status}
            />
            {metadata?.isValid === false && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Invalid ACT Configuration</AlertTitle>
                <AlertDescription>
                  Please check your workflow configuration for errors.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {!metadata?.isFlowFullscreen && metadata?.outputs && metadata.outputs.length > 0 && (
          <Console
            consoleOutputs={metadata.outputs}
            setConsoleOutputs={() => {
              setMetadata({
                ...metadata,
                outputs: [],
              });
            }}
          />
        )}
      </div>
    );
  },

  actions: actions,
  toolbar: toolbar,

  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === 'code-delta') {
      console.log('Stream part received:', streamPart.content?.substring(0, 50) + '...');
      
      setArtifact((draftArtifact) => {
        // Update all content-related properties to ensure consistency
        const updatedArtifact = {
          ...draftArtifact,
          content: streamPart.content,
          currentContent: streamPart.content,
          lastContent: streamPart.content,
          lastUpdateTime: Date.now(),
          isVisible:
            draftArtifact.status === 'streaming' &&
            streamPart.content.length > 300 &&
            streamPart.content.length < 310
              ? true
              : draftArtifact.isVisible,
          status: 'streaming',
        };
        
        return updatedArtifact;
      });
    }
  },

  styles: styles
};

// Inject custom styles when in browser environment
if (typeof document !== 'undefined') {
  injectStyles();
}

export default codeArtifact;