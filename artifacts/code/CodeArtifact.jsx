'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Network, Layout, Maximize2, Minimize2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useWindowSize } from 'usehooks-ts';
import { Button } from '@/components/ui/button';
import { Console } from '@/components/console';
// import { ActFlowVisualizer, isActContent } from '@/components/ActFlowVisualizer';
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
        showFlowOption: true,  // Set this to true by default
        isFlowFullscreen: false,
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
        showFlowOption: true,  // Set this to true by default
        isFlowFullscreen: false,
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
  
      toast.error(`Docker initialization failed: ${errorMessage}`);
    }
  },

  content: ({ content, onSaveContent, metadata, setMetadata }) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [initialViewSet, setInitialViewSet] = useState(false);
    const { width: windowWidth, height: windowHeight } = useWindowSize();

    // Use a separate controlled view mode that doesn't rely on metadata
    const [viewMode, setViewMode] = useState(metadata?.viewMode || 'code');
    
    // Use a ref to track the latest metadata viewMode
    const metadataViewModeRef = useRef(metadata?.viewMode || 'code');
    
    // Update the ref whenever metadata.viewMode changes
    useEffect(() => {
      if (metadata?.viewMode) {
        metadataViewModeRef.current = metadata.viewMode;
        setViewMode(metadata.viewMode);
      }
    }, [metadata?.viewMode]);

    // Handle updates from flow to code
    const handleFlowContentChange = useCallback((updatedContent) => {
      if (!updatedContent) return;
      onSaveContent(updatedContent, false);
    }, [onSaveContent]);

    // Define a custom toggle handler that uses the ref for current state
    const handleToggleView = useCallback(() => {
      // Get the current view mode from our ref
      const currentViewMode = metadataViewModeRef.current;
      
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
    }, [setMetadata]);

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

    // Add direct console log to check metadata state at runtime
    useEffect(() => {
      console.log('Current metadata state:', metadata);
      console.log('Current view mode state:', viewMode);
      console.log('Ref view mode:', metadataViewModeRef.current);
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

    // DEBUG ELEMENT - render view mode info
    const debugInfo = (
      <div className="absolute top-2 left-2 z-50 bg-black text-white p-2 text-xs rounded">
   
        <Button 
          onClick={handleToggleView} 
          size="sm" 
          className="mt-1 bg-blue-600 hover:bg-blue-700"
        >
          Toggle View
        </Button>
      </div>
    );

    return (
      <div className="relative w-full h-full">
        {/* Debug state display - uncomment if needed */}
        {debugInfo}
        
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <DockerStatus 
            status={metadata?.dockerStatus === 'unavailable' 
              ? 'unavailable' 
              : metadata?.containerStatus || 'stopped'
            } 
            containerId={metadata?.containerId}
            port={metadata?.port}
          />
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
          </div>
        ) : (
          <div className="w-full h-[calc(100vh-80px)]">
            <CodeEditor content={content} onSaveContent={onSaveContent} />
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

  // Keep original actions, our custom content component will handle the toggle
  actions: actions,
  toolbar: toolbar,

  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === 'code-delta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.content,
        isVisible:
          draftArtifact.status === 'streaming' &&
          draftArtifact.content.length > 300 &&
          draftArtifact.content.length < 310
            ? true
            : draftArtifact.isVisible,
        status: 'streaming',
      }));
    }
  },

  styles: styles
};

// Inject custom styles when in browser environment
if (typeof document !== 'undefined') {
  injectStyles();
}

export default codeArtifact;