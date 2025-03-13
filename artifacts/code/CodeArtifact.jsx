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
      // Check if dockerService is properly imported and has the expected methods
      console.log('Docker service:', dockerService);
      
      // Instead of calling checkHealth directly, check if it exists first
      // and provide a fallback if it doesn't
      let isDockerHealthy = false;
      
      if (dockerService && typeof dockerService.checkHealth === 'function') {
        isDockerHealthy = await dockerService.checkHealth();
      } else if (dockerService && typeof dockerService.isHealthy === 'function') {
        // Try an alternative method name that might exist
        isDockerHealthy = await dockerService.isHealthy();
      } else {
        // If no health check method exists, default to false
        console.warn('Docker service health check method not found. Assuming Docker is unavailable.');
      }
      
      console.log('Docker health status:', isDockerHealthy);
      
      const metadata = {
        isValid: true,
        flowData: null,
        viewMode: 'flow', // Set flow as default view
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
        nodeStatus: {},
        outputs: [{
          id: generateUUID(),
          timestamp: new Date().toISOString(),
          contents: [{
            type: 'text',
            value: `> Docker status: ${isDockerHealthy ? 'ready' : 'unavailable'}`
          }],
          status: isDockerHealthy ? 'completed' : 'failed'
        }],
        dockerStatus: isDockerHealthy ? 'ready' : 'unavailable',
        lastError: null,
        consoleVisible: false // Set console closed by default
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
        viewMode: 'flow', // Set flow as default view
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
        nodeStatus: {},
        outputs: [{
          id: generateUUID(),
          timestamp: new Date().toISOString(),
          contents: [{
            type: 'text',
            value: `> Initialization error: ${errorMessage}`
          }],
          status: 'failed'
        }],
        dockerStatus: 'unavailable',
        lastError: errorMessage,
        consoleVisible: false // Set console closed by default
      });
  
      toast.error(`Agent initialization failed: ${errorMessage}`);
    }
  },

  content: ({ content, onSaveContent, metadata, setMetadata }) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [initialViewSet, setInitialViewSet] = useState(true); // Set to true to prevent auto view switching
    const { width: windowWidth, height: windowHeight } = useWindowSize();
    const [flowContentUpdated, setFlowContentUpdated] = useState(false);
    const contentRef = useRef(content);
    const lastSavedContentRef = useRef(content);
    const isStreamingRef = useRef(false);

    // Use a separate controlled view mode that defaults to flow
    const [viewMode, setViewMode] = useState(metadata?.viewMode || 'flow');
    
    // Use a ref to track the latest metadata viewMode
    const metadataViewModeRef = useRef(metadata?.viewMode || 'flow');
    
    // Track console visibility
    const [consoleVisible, setConsoleVisible] = useState(metadata?.consoleVisible || false);
    
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

    // Sync console visibility state with metadata
    useEffect(() => {
      if (metadata?.consoleVisible !== undefined) {
        setConsoleVisible(metadata.consoleVisible);
      }
    }, [metadata?.consoleVisible]);

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

    // Toggle console visibility
    const toggleConsole = useCallback(() => {
      setConsoleVisible(prev => !prev);
      setMetadata(prev => ({
        ...prev,
        consoleVisible: !prev.consoleVisible
      }));
    }, [setMetadata]);

    // Extract node status from execution results
    useEffect(() => {
      if (metadata?.outputs && metadata.outputs.length > 0) {
        // Look through outputs for execution results with node status information
        const executionOutputs = metadata.outputs.filter(output => 
          output.contents.some(content => 
            content.value.includes('Execution completed:') || 
            content.value.includes('Execution failed:')
          )
        );
        
        if (executionOutputs.length > 0) {
          const latestOutput = executionOutputs[executionOutputs.length - 1];
          
          try {
            // Find content with execution result
            const resultContent = latestOutput.contents.find(content => 
              content.value.includes('Execution completed:') || 
              content.value.includes('Execution failed:')
            );
            
            if (resultContent) {
              // Extract JSON from the content
              const jsonStart = resultContent.value.indexOf('{');
              if (jsonStart !== -1) {
                const jsonString = resultContent.value.substring(jsonStart);
                const executionResult = JSON.parse(jsonString);
                
                if (executionResult.result && executionResult.result.node_status) {
                  // Update metadata with node status
                  setMetadata(prev => ({
                    ...prev,
                    nodeStatus: executionResult.result.node_status
                  }));
                  
                  console.log('Updated node status in metadata:', executionResult.result.node_status);
                }
              }
            }
          } catch (error) {
            console.error('Error extracting node status:', error);
          }
        }
      }
    }, [metadata?.outputs, setMetadata]);

    // Monitor execution status and auto-show console during execution
    useEffect(() => {
      // Auto-open console when starting execution
      if (metadata?.executionStatus === 'running' && !consoleVisible) {
        setConsoleVisible(true);
        setMetadata(prev => ({
          ...prev,
          consoleVisible: true
        }));
      }
      
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
                timestamp: new Date().toISOString(),
                contents: [{
                  type: 'text',
                  value: `> Execution status: ${data.status}${data.message ? ` - ${data.message}` : ''}`
                }],
                status: 'in_progress'
              }
            ],
            consoleVisible: true // Keep console visible during execution
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
                  timestamp: new Date().toISOString(),
                  contents: [{
                    type: 'text',
                    value: data.status === 'completed' 
                      ? `> Execution completed: ${JSON.stringify(data.result, null, 2)}`
                      : `> Execution failed: ${data.message || data.error || 'Unknown error'}`
                  }],
                  status: data.status === 'completed' ? 'completed' : 'failed'
                }
              ],
              consoleVisible: true // Auto-show console on execution complete/fail
            }));

            // If execution returned node status information, update metadata
            if (data.result && data.result.node_status) {
              setMetadata(prev => ({
                ...prev,
                nodeStatus: data.result.node_status
              }));
              console.log('Updated node status from execution:', data.result.node_status);
            }

            setIsExecuting(false);
            toast(data.status === 'completed' ? 'Execution completed' : 'Execution failed');
            setConsoleVisible(true); // Also update local state
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
                timestamp: new Date().toISOString(),
                contents: [{
                  type: 'text',
                  value: `> Error checking status: ${errorMessage}`
                }],
                status: 'failed'
              }
            ],
            consoleVisible: true // Show console on error
          }));
          setConsoleVisible(true); // Also update local state
        }
      };

      const interval = setInterval(checkExecutionStatus, 1000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }, [metadata?.executionId, metadata?.executionStatus, metadata?.port, setMetadata, consoleVisible]);

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

    // Create and inject our own actions
    useEffect(() => {
      if (!Array.isArray(actions)) {
        console.error('actions is not an array');
        return;
      }
      
      // Find the toggle view action to determine insertion position
      const toggleViewIndex = actions.findIndex(
        action => action.description && action.description.includes('Switch between')
      );
      
      // Check if we already added our console toggle action
      const consoleToggleExists = actions.some(
        action => action.description && 
                (action.description.includes('console output') || 
                 action.description.includes('Show the console') || 
                 action.description.includes('Hide the console'))
      );
      
      // Only add if it doesn't exist
      if (!consoleToggleExists && toggleViewIndex !== -1) {
        // Create console toggle action
        const consoleToggleAction = {
          icon: consoleVisible ? 
                React.createElement('div', { className: 'text-primary' }, 
                  React.createElement('svg', { 
                    width: 16, 
                    height: 16, 
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    strokeWidth: 2,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                    'data-lucide': 'terminal'
                  }, [
                    React.createElement('polyline', { key: 'p1', points: '4 17 10 11 4 5' }),
                    React.createElement('line', { key: 'l1', x1: '12', y1: '19', x2: '20', y2: '19' })
                  ])
                ) :
                React.createElement('svg', { 
                  width: 16, 
                  height: 16, 
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: 2,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  'data-lucide': 'terminal'
                }, [
                  React.createElement('polyline', { key: 'p1', points: '4 17 10 11 4 5' }),
                  React.createElement('line', { key: 'l1', x1: '12', y1: '19', x2: '20', y2: '19' })
                ]),
          description: 'Toggle console output',
          onClick: () => toggleConsole()
        };
        
        // Insert after the toggle view action
        actions.splice(toggleViewIndex + 1, 0, consoleToggleAction);
        console.log('Console toggle action added to actions array');
      }
      
      // Update existing console toggle action if it exists
      const existingConsoleAction = actions.find(
        action => action.description && 
                (action.description.includes('console output') || 
                 action.description.includes('Toggle console'))
      );
      
      if (existingConsoleAction) {
        existingConsoleAction.icon = consoleVisible ? 
          React.createElement('div', { className: 'text-primary' }, 
            React.createElement('svg', { 
              width: 16, 
              height: 16, 
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 2,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              'data-lucide': 'terminal'
            }, [
              React.createElement('polyline', { key: 'p1', points: '4 17 10 11 4 5' }),
              React.createElement('line', { key: 'l1', x1: '12', y1: '19', x2: '20', y2: '19' })
            ])
          ) :
          React.createElement('svg', { 
            width: 16, 
            height: 16, 
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'data-lucide': 'terminal'
          }, [
            React.createElement('polyline', { key: 'p1', points: '4 17 10 11 4 5' }),
            React.createElement('line', { key: 'l1', x1: '12', y1: '19', x2: '20', y2: '19' })
          ]);
        existingConsoleAction.description = consoleVisible ? 
          'Hide console output' : 
          'Show console output';
        existingConsoleAction.onClick = () => toggleConsole();
      }
      
      // Update existing toggle view action
      const toggleViewAction = actions.find(
        action => action.description && action.description.includes('Switch between')
      );
      
      if (toggleViewAction) {
        toggleViewAction.onClick = () => handleToggleView();
      }
      
    }, [handleToggleView, toggleConsole, consoleVisible]);

    // Modify Run Agent action to auto-show console
    useEffect(() => {
      // Find the Run Agent action
      const runAgentAction = actions.find(
        action => action.label === 'Run Agent' || 
                 (action.description && action.description.includes('Run workflow'))
      );
      
      if (runAgentAction && runAgentAction.onClick) {
        // Save the original onClick handler
        const originalOnClick = runAgentAction.onClick;
        
        // Replace with our own that also shows the console
        runAgentAction.onClick = async (args) => {
          // Show console before running
          if (!consoleVisible) {
            setConsoleVisible(true);
            setMetadata(prev => ({
              ...prev,
              consoleVisible: true
            }));
          }
          
          // Call the original handler
          return originalOnClick(args);
        };
      }
    }, [setMetadata, consoleVisible]);

    return (
      <div className="relative w-full h-full flex flex-col">
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
            height: metadata?.isFlowFullscreen ? '100vh' : '100%',
            position: metadata?.isFlowFullscreen ? 'fixed' : 'relative',
            top: metadata?.isFlowFullscreen ? '0' : 'auto',
            left: metadata?.isFlowFullscreen ? '0' : 'auto',
            zIndex: metadata?.isFlowFullscreen ? 50 : 'auto',
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <ActFlowVisualizer 
              content={content}
              isStreaming={metadata?.status === 'streaming'}
              metadata={metadata}
              setMetadata={setMetadata}
              onContentChange={handleFlowContentChange}
              status={metadata?.status}
              style={{ width: '100%', height: '100%', flex: '1 1 auto' }}
            />
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col">
            <CodeEditor 
              content={content} 
              onSaveContent={handleSaveContent}
              status={metadata?.status}
              style={{ width: '100%', height: '100%', flex: '1 1 auto' }}
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

        {!metadata?.isFlowFullscreen && consoleVisible && metadata?.outputs && metadata.outputs.length > 0 && (
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