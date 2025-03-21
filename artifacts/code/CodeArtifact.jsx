'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Network, Layout, Maximize2, Minimize2, Loader2, AlertCircle, PlusSquare, MinusSquare, ChevronDown, ChevronUp, Copy, Check, Terminal } from 'lucide-react';
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
        consoleExpanded: false
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
        consoleExpanded: false
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
    const [isDarkTheme, setIsDarkTheme] = useState(true);
    
    const [viewMode, setViewMode] = useState(metadata?.viewMode || 'flow');
    const metadataViewModeRef = useRef(metadata?.viewMode || 'flow');
    const [consoleExpanded, setConsoleExpanded] = useState(metadata?.consoleExpanded || false);
    const [consoleHeight, setConsoleHeight] = useState(300);
    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef(null);
    const containerRef = useRef(null);
    
    // Constants for console dimensions
    const CONSOLE_MIN_HEIGHT = 100;
    const CONSOLE_MAX_HEIGHT = 800;
    const CONSOLE_COLLAPSED_HEIGHT = 36;
    
    // Detect theme changes
    useEffect(() => {
      const checkTheme = () => {
        const isDark = document.documentElement.classList.contains('dark') || 
                       document.documentElement.getAttribute('data-theme') === 'dark';
        setIsDarkTheme(isDark);
      };
      
      // Check on first render
      checkTheme();
      
      // Set up observer for theme changes
      const observer = new MutationObserver(checkTheme);
      observer.observe(document.documentElement, { 
        attributes: true, 
        attributeFilter: ['class', 'data-theme'] 
      });
      
      return () => observer.disconnect();
    }, []);
    
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
      if (metadata?.consoleExpanded !== undefined) {
        setConsoleExpanded(metadata.consoleExpanded);
      }
    }, [metadata?.consoleExpanded]);

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
      if (consoleExpanded) {
        // Store current height before collapsing
        localStorage.setItem('consoleHeight', consoleHeight.toString());
      } else {
        // Restore previous height when expanding
        const storedHeight = localStorage.getItem('consoleHeight');
        if (storedHeight) {
          const parsedHeight = Number(storedHeight);
          if (parsedHeight >= CONSOLE_MIN_HEIGHT && parsedHeight <= CONSOLE_MAX_HEIGHT) {
            setConsoleHeight(parsedHeight);
          }
        }
      }
      
      setConsoleExpanded(prev => !prev);
      setMetadata(prev => ({
        ...prev,
        consoleExpanded: !prev.consoleExpanded
      }));
    }, [setMetadata, consoleExpanded, consoleHeight]);

    // Console resizing functions
    const startResizing = useCallback((e) => {
      e.preventDefault();
      setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
      setIsResizing(false);
    }, []);

    const resize = useCallback((e) => {
      if (!isResizing) return;
      
      // Calculate height from the bottom of the window
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight >= CONSOLE_MIN_HEIGHT && newHeight <= CONSOLE_MAX_HEIGHT) {
        setConsoleHeight(newHeight);
        localStorage.setItem('consoleHeight', newHeight.toString());
      }
    }, [isResizing]);

    useEffect(() => {
      // Handle mouse events for resizing
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      
      return () => {
        window.removeEventListener('mousemove', resize);
        window.removeEventListener('mouseup', stopResizing);
      };
    }, [resize, stopResizing]);

    // Restore height from localStorage on initial render
    useEffect(() => {
      const storedHeight = localStorage.getItem('consoleHeight');
      if (storedHeight) {
        const parsedHeight = Number(storedHeight);
        if (parsedHeight >= CONSOLE_MIN_HEIGHT && parsedHeight <= CONSOLE_MAX_HEIGHT) {
          setConsoleHeight(parsedHeight);
        }
      }
    }, []);

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
      if (metadata?.executionStatus === 'running' && !consoleExpanded) {
        setConsoleExpanded(true);
        setMetadata(prev => ({
          ...prev,
          consoleExpanded: true
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
            consoleExpanded: true
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
              consoleExpanded: true
            }));

            if (data.result && data.result.node_status) {
              setMetadata(prev => ({
                ...prev,
                nodeStatus: data.result.node_status
              }));
            }

            setIsExecuting(false);
            toast(data.status === 'completed' ? 'Execution completed' : 'Execution failed');
            setConsoleExpanded(true);
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
            consoleExpanded: true
          }));
          setConsoleExpanded(true);
        }
      };

      const interval = setInterval(checkExecutionStatus, 1000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }, [metadata?.executionId, metadata?.executionStatus, metadata?.port, setMetadata, consoleExpanded]);

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
                 action.description.includes('Hide the console') ||
                 action.description.includes('Expand console') ||
                 action.description.includes('Collapse console'))
      );
      
      if (!consoleToggleExists && toggleViewIndex !== -1) {
        const consoleToggleAction = {
          icon: React.createElement(consoleExpanded ? ChevronDown : ChevronUp, { size: 16 }),
          description: consoleExpanded ? 'Collapse console' : 'Expand console',
          onClick: () => toggleConsole()
        };
        
        actions.splice(toggleViewIndex + 1, 0, consoleToggleAction);
      }
      
      const existingConsoleAction = actions.find(
        action => action.description && 
                (action.description.includes('console output') || 
                 action.description.includes('Toggle console') ||
                 action.description.includes('Expand console') ||
                 action.description.includes('Collapse console'))
      );
      
      if (existingConsoleAction) {
        existingConsoleAction.icon = consoleExpanded ? 
          React.createElement(ChevronDown, { size: 16 }) : 
          React.createElement(ChevronUp, { size: 16 });
        existingConsoleAction.description = consoleExpanded ? 
          'Collapse console' : 
          'Expand console';
        existingConsoleAction.onClick = () => toggleConsole();
      }
      
      const toggleViewAction = actions.find(
        action => action.description && action.description.includes('Switch between')
      );
      
      if (toggleViewAction) {
        toggleViewAction.onClick = () => handleToggleView();
      }
      
    }, [handleToggleView, toggleConsole, consoleExpanded]);

    useEffect(() => {
      const runAgentAction = actions.find(
        action => action.label === 'Run Agent' || 
                 (action.description && action.description.includes('Run workflow'))
      );
      
      if (runAgentAction && runAgentAction.onClick) {
        const originalOnClick = runAgentAction.onClick;
        
        runAgentAction.onClick = async (args) => {
          if (!consoleExpanded) {
            setConsoleExpanded(true);
            setMetadata(prev => ({
              ...prev,
              consoleExpanded: true
            }));
          }
          
          return originalOnClick(args);
        };
      }
    }, [setMetadata, consoleExpanded]);

    // Calculate total container height (for proper padding calculations)
    const calculateTotalHeight = useCallback(() => {
      if (!containerRef.current) return '100%';
      return containerRef.current.offsetHeight;
    }, []);

    // Calculate the main content height based on console state
    // This is the key change - we're making the flow container have a fixed position relative to the bottom
    // and ensuring it doesn't overlap with the console
    const getMainContentHeight = useCallback(() => {
      if (metadata?.isFlowFullscreen) return '100vh';
      
      // Calculate height relative to the bottom console position
      const consoleFooterHeight = consoleExpanded ? consoleHeight : CONSOLE_COLLAPSED_HEIGHT;
      return `calc(100vh - ${consoleFooterHeight}px)`;
    }, [consoleExpanded, consoleHeight, metadata?.isFlowFullscreen]);

    // Get theme-specific colors
    const getThemeColors = () => {
      if (isDarkTheme) {
        return {
          bg: '#050505',
          hoverBg: '#0a0a0a',
          border: '#1a1a1a',
          text: '#e2e8f0',
          subText: '#94a3b8',
          contentBg: '#030303',
          buttonHoverBg: '#121212'
        };
      }
      return {
        bg: '#f0f0f0',
        hoverBg: '#e6e6e6',
        border: '#ddd',
        text: '#333',
        subText: '#666',
        contentBg: '#fff',
        buttonHoverBg: '#e0e0e0'
      };
    };

    const colors = getThemeColors();

    // Function to clear console outputs
    const clearConsole = useCallback(() => {
      setMetadata(prev => ({
        ...prev,
        outputs: []
      }));
    }, [setMetadata]);

    return (
      <div ref={containerRef} className="relative w-full h-full flex flex-col">
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          {isStreamingRef.current && (
            <div className="bg-blue-100 border border-blue-200 text-blue-700 px-3 py-1 rounded-md text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Streaming content...</span>
            </div>
          )}
        </div>

        {/* Main Content Area - Fixed to viewport size minus console height */}
        <div 
          style={{
            width: '100%',
            height: getMainContentHeight(),
            overflow: 'hidden',
            position: metadata?.isFlowFullscreen ? 'fixed' : 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: consoleExpanded ? `${consoleHeight}px` : `${CONSOLE_COLLAPSED_HEIGHT}px`,
            zIndex: metadata?.isFlowFullscreen ? 50 : 1,
            transition: 'bottom 0.3s ease-in-out'
          }}
        >
          {viewMode === 'flow' ? (
            <ActFlowVisualizer 
              content={content}
              isStreaming={metadata?.status === 'streaming'}
              metadata={metadata}
              setMetadata={setMetadata}
              onContentChange={handleFlowContentChange}
              status={metadata?.status}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <div className="flex flex-col w-full h-full">
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
        </div>

        {!metadata?.isFlowFullscreen && (
          <>
            {/* Resize handle - only show when console is expanded */}
            {consoleExpanded && (
              <div
                ref={resizeRef}
                className="h-2 w-full cursor-ns-resize z-50 hover:bg-primary/10 transition-colors"
                style={{ 
                  position: 'fixed',
                  bottom: consoleHeight,
                }}
                onMouseDown={startResizing}
                role="slider"
                aria-valuenow={consoleHeight}
                aria-valuemin={CONSOLE_MIN_HEIGHT}
                aria-valuemax={CONSOLE_MAX_HEIGHT}
              />
            )}
            
            {/* Console footer - Fixed to bottom of window */}
            <div
              className={`fixed flex flex-col bottom-0 left-0 right-0 w-full border-t z-40 overflow-hidden transition-height duration-150 ${isResizing ? 'select-none' : ''}`}
              style={{ 
                height: consoleExpanded ? consoleHeight : CONSOLE_COLLAPSED_HEIGHT,
                backgroundColor: colors.contentBg,
                borderColor: colors.border
              }}
            >
              <div
                className="flex justify-between items-center w-full h-9 px-2 py-1 border-b sticky top-0 z-50"
                style={{ 
                  backgroundColor: colors.bg,
                  borderColor: colors.border
                }}
              >
                <div className="text-sm pl-2 flex items-center gap-3">
                  <div style={{ color: colors.subText }}>
                    <Terminal size={16} />
                  </div>
                  <div className="font-medium" style={{ color: colors.text }}>Console</div>
                  {metadata?.outputs && (
                    <div className="text-xs" style={{ color: colors.subText }}>
                      {metadata.outputs.length} output{metadata.outputs.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="size-7 p-1"
                    size="icon"
                    onClick={clearConsole}
                    style={{ 
                      color: colors.text,
                      backgroundColor: 'transparent'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.buttonHoverBg}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span aria-hidden="true" className="h-4 w-4 flex items-center justify-center">×</span>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    className="size-7 p-1"
                    size="icon"
                    onClick={toggleConsole}
                    style={{ 
                      color: colors.text,
                      backgroundColor: 'transparent'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = colors.buttonHoverBg}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {consoleExpanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                  </Button>
                </div>
              </div>

              {consoleExpanded && metadata?.outputs && metadata.outputs.length > 0 && (
                <div
                  className="overflow-y-auto overflow-x-hidden p-2 space-y-1 scrollbar-custom flex-1"
                  style={{ backgroundColor: colors.contentBg }}
                >
                  <Console
                    consoleOutputs={metadata.outputs}
                    setConsoleOutputs={(outputs) => {
                      setMetadata({
                        ...metadata,
                        outputs: outputs,
                      });
                    }}
                    maxHeight={CONSOLE_MAX_HEIGHT}
                    minHeight={CONSOLE_MIN_HEIGHT}
                    initialHeight={consoleHeight}
                  />
                </div>
              )}
            </div>
            
            {/* Custom scrollbar styles */}
            <style jsx global>{`
              .scrollbar-custom::-webkit-scrollbar {
                width: 6px;
                height: 6px;
              }
              .scrollbar-custom::-webkit-scrollbar-track {
                background: ${isDarkTheme ? '#000000' : '#f0f0f0'};
              }
              .scrollbar-custom::-webkit-scrollbar-thumb {
                background-color: ${isDarkTheme ? '#1a1a1a' : '#c0c0c0'};
                border-radius: 3px;
              }
              .scrollbar-custom::-webkit-scrollbar-thumb:hover {
                background-color: ${isDarkTheme ? '#262626' : '#a0a0a0'};
              }
              .scrollbar-custom {
                scrollbar-width: thin;
                scrollbar-color: ${isDarkTheme ? '#1a1a1a #000000' : '#c0c0c0 #f0f0f0'};
              }
              
              /* Enhanced transitions for better UX */
              .transition-height {
                transition-property: height;
                transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
              }
            `}</style>
          </>
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