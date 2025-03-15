'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Network, Layout, Maximize2, Minimize2, Loader2, AlertCircle, PlusSquare, MinusSquare } from 'lucide-react';
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
    const newArtifactId = generateUUID();
  
    try {
      let isDockerHealthy = false;
      
      if (dockerService && typeof dockerService.checkHealth === 'function') {
        isDockerHealthy = await dockerService.checkHealth();
      } else if (dockerService && typeof dockerService.isHealthy === 'function') {
        isDockerHealthy = await dockerService.isHealthy();
      }
      
      const metadata = {
        isValid: true,
        flowData: null,
        viewMode: 'flow',
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
        consoleVisible: false
      };
  
      setMetadata(metadata);
  
      if (!isDockerHealthy) {
        throw new Error('Docker service is unavailable');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      
      setMetadata({
        isValid: true,
        flowData: null,
        viewMode: 'flow',
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
        consoleVisible: false
      });
  
      toast.error(`Agent initialization failed: ${errorMessage}`);
    }
  },

  content: ({ content, onSaveContent, metadata, setMetadata }) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [initialViewSet, setInitialViewSet] = useState(true);
    const { width: windowWidth, height: windowHeight } = useWindowSize();
    const [flowContentUpdated, setFlowContentUpdated] = useState(false);
    const contentRef = useRef(content);
    const lastSavedContentRef = useRef(content);
    const isStreamingRef = useRef(false);
    
    const [viewMode, setViewMode] = useState(metadata?.viewMode || 'flow');
    const metadataViewModeRef = useRef(metadata?.viewMode || 'flow');
    const [consoleVisible, setConsoleVisible] = useState(metadata?.consoleVisible || false);
    
    useEffect(() => {
      isStreamingRef.current = metadata?.status === 'streaming';
      
      if (metadata?.status === 'streaming') {
        setMetadata(prev => ({
          ...prev,
          isStreaming: true
        }));
      } 
      else if (metadata?.status !== 'streaming' && metadata?.isStreaming) {
        setTimeout(() => {
          setMetadata(prev => ({
            ...prev,
            isStreaming: false
          }));
        }, 500);
      }
    }, [metadata?.status, setMetadata]);
    
    useEffect(() => {
      if (metadata?.viewMode) {
        metadataViewModeRef.current = metadata.viewMode;
        setViewMode(metadata.viewMode);
      }
    }, [metadata?.viewMode]);

    useEffect(() => {
      if (metadata?.consoleVisible !== undefined) {
        setConsoleVisible(metadata.consoleVisible);
      }
    }, [metadata?.consoleVisible]);

    useEffect(() => {
      contentRef.current = content;
    }, [content]);

    useEffect(() => {
      if (content !== lastSavedContentRef.current) {
        lastSavedContentRef.current = content;
      }
    }, [content]);

    const handleSaveContent = useCallback((updatedContent, debounce = true) => {
      if (isStreamingRef.current && debounce) {
        return;
      }
      
      onSaveContent(updatedContent, debounce);
    }, [onSaveContent]);

    const handleFlowContentChange = useCallback((updatedContent) => {
      if (!updatedContent) {
        return;
      }
      
      if (updatedContent === contentRef.current) {
        return;
      }
      
      if (isStreamingRef.current) {
        return;
      }
      
      setFlowContentUpdated(true);
      lastSavedContentRef.current = updatedContent;
      onSaveContent(updatedContent, false);
    }, [onSaveContent]);

    const handleToggleView = useCallback(() => {
      if (isStreamingRef.current) {
        toast.warning('Cannot change views during content streaming');
        return;
      }
      
      const currentViewMode = metadataViewModeRef.current;
      
      if (currentViewMode === 'flow' && flowContentUpdated) {
        toast.info('Flow changes saved before switching views');
        setFlowContentUpdated(false);
      }
      
      const newViewMode = currentViewMode === 'flow' ? 'code' : 'flow';
      
      setViewMode(newViewMode);
      metadataViewModeRef.current = newViewMode;
      
      setMetadata(prev => ({
        ...prev,
        viewMode: newViewMode
      }));
    }, [setMetadata, flowContentUpdated]);

    const toggleConsole = useCallback(() => {
      setConsoleVisible(prev => !prev);
      setMetadata(prev => ({
        ...prev,
        consoleVisible: !prev.consoleVisible
      }));
    }, [setMetadata]);

    useEffect(() => {
      if (metadata?.outputs && metadata.outputs.length > 0) {
        const executionOutputs = metadata.outputs.filter(output => 
          output.contents.some(content => 
            content.value.includes('Execution completed:') || 
            content.value.includes('Execution failed:')
          )
        );
        
        if (executionOutputs.length > 0) {
          const latestOutput = executionOutputs[executionOutputs.length - 1];
          
          try {
            const resultContent = latestOutput.contents.find(content => 
              content.value.includes('Execution completed:') || 
              content.value.includes('Execution failed:')
            );
            
            if (resultContent) {
              const jsonStart = resultContent.value.indexOf('{');
              if (jsonStart !== -1) {
                const jsonString = resultContent.value.substring(jsonStart);
                const executionResult = JSON.parse(jsonString);
                
                if (executionResult.result && executionResult.result.node_status) {
                  setMetadata(prev => ({
                    ...prev,
                    nodeStatus: executionResult.result.node_status
                  }));
                }
              }
            }
          } catch (error) {
            // Silently handle error
          }
        }
      }
    }, [metadata?.outputs, setMetadata]);

    useEffect(() => {
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
            consoleVisible: true
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
              consoleVisible: true
            }));

            if (data.result && data.result.node_status) {
              setMetadata(prev => ({
                ...prev,
                nodeStatus: data.result.node_status
              }));
            }

            setIsExecuting(false);
            toast(data.status === 'completed' ? 'Execution completed' : 'Execution failed');
            setConsoleVisible(true);
          }
        } catch (error) {
          if (!isMounted) return;
          
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
            consoleVisible: true
          }));
          setConsoleVisible(true);
        }
      };

      const interval = setInterval(checkExecutionStatus, 1000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }, [metadata?.executionId, metadata?.executionStatus, metadata?.port, setMetadata, consoleVisible]);

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

    useEffect(() => {
      if (viewMode === 'code' && flowContentUpdated && !isStreamingRef.current) {
        toast.info('Flow changes applied to code view');
        setFlowContentUpdated(false);
      }
    }, [viewMode, flowContentUpdated]);

    useEffect(() => {
      if (metadata && metadata.showFlowOption !== true) {
        setMetadata(prev => ({
          ...prev,
          showFlowOption: true
        }));
      }
    }, [metadata, setMetadata]);

    useEffect(() => {
      if (!Array.isArray(actions)) {
        return;
      }
      
      const toggleViewIndex = actions.findIndex(
        action => action.description && action.description.includes('Switch between')
      );
      
      const consoleToggleExists = actions.some(
        action => action.description && 
                (action.description.includes('console output') || 
                 action.description.includes('Show the console') || 
                 action.description.includes('Hide the console'))
      );
      
      if (!consoleToggleExists && toggleViewIndex !== -1) {
        const consoleToggleAction = {
          icon: React.createElement(PlusSquare, { size: 16 }),
          description: 'Toggle console output',
          onClick: () => toggleConsole()
        };
        
        actions.splice(toggleViewIndex + 1, 0, consoleToggleAction);
      }
      
      const existingConsoleAction = actions.find(
        action => action.description && 
                (action.description.includes('console output') || 
                 action.description.includes('Toggle console'))
      );
      
      if (existingConsoleAction) {
        existingConsoleAction.icon = consoleVisible ? 
          React.createElement(MinusSquare, { size: 16 }) : 
          React.createElement(PlusSquare, { size: 16 });
        existingConsoleAction.description = consoleVisible ? 
          'Hide console output' : 
          'Show console output';
        existingConsoleAction.onClick = () => toggleConsole();
      }
      
      const toggleViewAction = actions.find(
        action => action.description && action.description.includes('Switch between')
      );
      
      if (toggleViewAction) {
        toggleViewAction.onClick = () => handleToggleView();
      }
      
    }, [handleToggleView, toggleConsole, consoleVisible]);

    useEffect(() => {
      const runAgentAction = actions.find(
        action => action.label === 'Run Agent' || 
                 (action.description && action.description.includes('Run workflow'))
      );
      
      if (runAgentAction && runAgentAction.onClick) {
        const originalOnClick = runAgentAction.onClick;
        
        runAgentAction.onClick = async (args) => {
          if (!consoleVisible) {
            setConsoleVisible(true);
            setMetadata(prev => ({
              ...prev,
              consoleVisible: true
            }));
          }
          
          return originalOnClick(args);
        };
      }
    }, [setMetadata, consoleVisible]);

    return (
      <div className="relative w-full h-full flex flex-col">
        <div className="absolute top-2 right-2 z-10 flex gap-2">
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
      setArtifact((draftArtifact) => {
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