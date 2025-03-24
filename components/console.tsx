// Console.tsx
import { Button } from './ui/button';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { cn } from '@/lib/utils';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ChevronDownIcon, ChevronUpIcon, CheckIcon, CopyIcon, LoaderIcon, Workflow, Info, AlertTriangle, Terminal, Clock } from 'lucide-react';
import { TerminalWindowIcon, CrossSmallIcon } from './icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { 
  ConsoleProps, 
  ConsoleOutput
} from './ConsoleTypes';
import {
  formatTimestamp,
  formatJson,
  formatPossibleJson,
  extractWorkflowStatus,
  getStatusStyles
} from './ConsoleHelpers';

export function Console({ 
  consoleOutputs, 
  setConsoleOutputs, 
  maxHeight = 800, 
  minHeight = 100, 
  initialHeight = 300,
  forceShow = true // Add a new prop to force showing the console
}: ConsoleProps) {
  const [height, setHeight] = useState<number>(initialHeight);
  const [isResizing, setIsResizing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [copiedOutputId, setCopiedOutputId] = useState<string | null>(null);
  // State to track which node results are expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  
  // Track which node results are expanded
  const [expandedNodeResults, setExpandedNodeResults] = useState<Record<string, boolean>>({});
  
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // Create default output if none exists
  const effectiveOutputs = useMemo(() => {
    if (consoleOutputs.length === 0 && forceShow) {
      return [{
        id: 'default-output',
        contents: [{
          type: 'text',
          value: '> Console ready'
        }],
        status: 'completed'
      }];
    }
    return consoleOutputs;
  }, [consoleOutputs, forceShow]);

  // Find outputs with node status
  const outputsWithNodeStatus = useMemo(() => {
    return effectiveOutputs.filter(output => {
      const workflowStatus = extractWorkflowStatus(output);
      return workflowStatus && workflowStatus.result && workflowStatus.result.node_status;
    });
  }, [effectiveOutputs]);

  // Filter outputs based on active tab
  const filteredOutputs = useMemo(() => {
    if (activeTab === 'all') return effectiveOutputs;
    if (activeTab === 'error') return effectiveOutputs.filter(output => output.status === 'failed');
    if (activeTab === 'success') return effectiveOutputs.filter(output => output.status === 'completed');
    if (activeTab === 'nodes') return outputsWithNodeStatus;
    return effectiveOutputs;
  }, [effectiveOutputs, activeTab, outputsWithNodeStatus]);

  // Count errors, completions, and node executions for badge display
  const errorCount = useMemo(() => 
    effectiveOutputs.filter(output => output.status === 'failed').length, 
    [effectiveOutputs]
  );
  
  const successCount = useMemo(() => 
    effectiveOutputs.filter(output => output.status === 'completed').length, 
    [effectiveOutputs]
  );
  
  const nodeExecutionCount = useMemo(() => outputsWithNodeStatus.length, [outputsWithNodeStatus]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        const newHeight = window.innerHeight - e.clientY;
        if (newHeight >= minHeight && newHeight <= maxHeight) {
          setHeight(newHeight);
        }
      }
    },
    [isResizing, minHeight, maxHeight],
  );

  const toggleExpanded = useCallback(() => {
    if (isExpanded) {
      // Collapse: Store current height and set to minHeight
      setHeight(prev => {
        localStorage.setItem('consoleHeight', prev.toString());
        return minHeight;
      });
    } else {
      // Expand: Restore previous height or use default
      const storedHeight = localStorage.getItem('consoleHeight');
      setHeight(storedHeight ? Math.min(Number(storedHeight), maxHeight) : initialHeight);
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded, minHeight, maxHeight, initialHeight]);

  const clearConsole = useCallback(() => {
    if (forceShow) {
      // If we're forcing the console to show, replace with default message
      setConsoleOutputs([{
        id: 'default-output',
        contents: [{
          type: 'text',
          value: '> Console ready'
        }],
        status: 'completed'
      }]);
    } else {
      setConsoleOutputs([]);
    }
  }, [setConsoleOutputs, forceShow]);

  const copyOutput = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedOutputId(id);
      setTimeout(() => setCopiedOutputId(null), 2000);
    });
  }, []);

  // Toggle section expansion state
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  }, []);

  // Toggle node result expansion state - FIXED
  const toggleNodeResult = useCallback((nodeId: string, consoleOutputId: string) => {
    // Create the node result ID
    const nodeResultId = `${consoleOutputId}-${nodeId}`;
    
    // Toggle the expanded state
    setExpandedNodeResults(prev => ({
      ...prev,
      [nodeResultId]: !prev[nodeResultId]
    }));
    
    // Make sure the "Node Results" section is expanded
    setExpandedSections(prev => ({
      ...prev,
      [`section-${consoleOutputId}-Node Results`]: true
    }));
  }, []);

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (isExpanded) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredOutputs, isExpanded]);

  // Handle mouse events for resizing
  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  // Clear console when artifact is hidden, but maintain default message if forcing show
  useEffect(() => {
    if (!isArtifactVisible) {
      if (forceShow) {
        setConsoleOutputs([{
          id: 'default-output',
          contents: [{
            type: 'text',
            value: '> Console ready'
          }],
          status: 'completed'
        }]);
      } else {
        setConsoleOutputs([]);
      }
    }
  }, [isArtifactVisible, setConsoleOutputs, forceShow]);

  // Restore height from localStorage on initial render
  useEffect(() => {
    const storedHeight = localStorage.getItem('consoleHeight');
    if (storedHeight) {
      const parsedHeight = Number(storedHeight);
      if (parsedHeight >= minHeight && parsedHeight <= maxHeight) {
        setHeight(parsedHeight);
      }
    }
  }, [minHeight, maxHeight]);

  // Helper to create a collapsible section
  const CollapsibleSection = ({ id, title, className, children, icon = null, defaultExpanded = false }) => {
    const sectionId = `section-${id}-${title}`;
    const isExpanded = expandedSections[sectionId] ?? defaultExpanded;
    
    return (
      <Collapsible
        open={isExpanded}
        onOpenChange={() => toggleSection(sectionId)}
        className={cn("border border-[#1a1a1a] rounded overflow-hidden", className)}
      >
        <CollapsibleTrigger className="w-full px-3 py-2 flex items-center bg-[#050505] hover:bg-[#0a0a0a] transition-colors">
          {icon && <span className="mr-2">{icon}</span>}
          <span className="text-xs font-semibold text-[#e2e8f0]">{title}</span>
          <ChevronDownIcon 
            className={cn("ml-auto size-4 text-[#4b5563] transition-transform", {
              "transform rotate-180": isExpanded
            })}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          {children}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Helper to create a pretty-printed JSON viewer
  const JsonViewer = ({ data, title, id }) => {
    const jsonString = formatJson(data);
    
    const copyJsonContent = () => {
      navigator.clipboard.writeText(jsonString).then(() => {
        // Could add temporary visual feedback here
      });
    };
    
    return (
      <CollapsibleSection
        id={id}
        title={title}
        icon={<Info className="size-3.5 text-[#3b82f6]" />}
      >
        <div className="relative">
          <pre className="p-3 text-xs bg-[#030303] overflow-x-auto scrollbar-custom max-h-60">
            <code className="text-[#e2e8f0]">
              {jsonString}
            </code>
          </pre>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 size-6 p-1 text-[#4b5563] hover:text-[#e2e8f0] hover:bg-[#1a1a1a] rounded-sm"
            onClick={copyJsonContent}
            title="Copy JSON"
          >
            <CopyIcon className="size-3.5" />
          </Button>
        </div>
      </CollapsibleSection>
    );
  };

  return (
    <>
      {/* Only show resize bar when expanded */}
      {isExpanded && (
        <div
          ref={resizeRef}
          className="h-2 w-full fixed cursor-ns-resize z-50 hover:bg-primary/10 transition-colors"
          onMouseDown={startResizing}
          style={{ bottom: height - 4 }}
          role="slider"
          aria-valuenow={height}
          aria-valuemin={minHeight}
          aria-valuemax={maxHeight}
        />
      )}

      <div
        ref={contentRef}
        className={cn(
          'fixed flex flex-col bottom-0 bg-black w-full border-t z-40 overflow-hidden border-[#1a1a1a] transition-height duration-150',
          {
            'select-none': isResizing,
          },
        )}
        style={{ height: isExpanded ? height : 'auto' }}
      >
        {/* Console Header - Always visible */}
        <div className="flex flex-row justify-between items-center w-full h-fit border-b border-[#1a1a1a] px-2 py-1 sticky top-0 z-50 bg-[#050505]">
          <div className="text-sm pl-2 text-[#e2e8f0] flex flex-row gap-3 items-center">
            <div className="text-[#94a3b8]">
              <TerminalWindowIcon />
            </div>
            <div className="font-medium">Console</div>
            <div className="text-xs text-[#4b5563]">
              {filteredOutputs.length} output{filteredOutputs.length !== 1 ? 's' : ''}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Only show tabs when expanded */}
            {isExpanded && (
              <Tabs 
                value={activeTab} 
                onValueChange={setActiveTab}
                className="mr-2"
              >
                <TabsList className="h-7 bg-[#030303]">
                  <TabsTrigger 
                    value="all" 
                    className="text-xs h-6 px-2 data-[state=active]:bg-[#1a1a1a]"
                  >
                    All ({effectiveOutputs.length})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="nodes" 
                    className="text-xs h-6 px-2 data-[state=active]:bg-[#1a1a1a]"
                    disabled={nodeExecutionCount === 0}
                  >
                    Nodes
                    {nodeExecutionCount > 0 && (
                      <Badge className="ml-1 h-4 px-1 text-[10px] bg-[#3b82f6] hover:bg-[#2563eb]">
                        {nodeExecutionCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="error" 
                    className="text-xs h-6 px-2 data-[state=active]:bg-[#1a1a1a]"
                    disabled={errorCount === 0}
                  >
                    Errors
                    {errorCount > 0 && (
                      <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                        {errorCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="success" 
                    className="text-xs h-6 px-2 data-[state=active]:bg-[#1a1a1a]"
                    disabled={successCount === 0}
                  >
                    Success
                    {successCount > 0 && (
                      <Badge className="ml-1 h-4 px-1 text-[10px] bg-[#10b981] hover:bg-[#059669]">
                        {successCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {/* Always show error/success badges in collapsed view */}
            {!isExpanded && (
              <div className="flex gap-2 items-center mr-2">
                {errorCount > 0 && (
                  <div className="bg-[rgba(239,68,68,0.15)] text-[#ef4444] text-xs rounded-full px-2 py-0.5">
                    {errorCount} {errorCount === 1 ? 'Error' : 'Errors'}
                  </div>
                )}
                {successCount > 0 && (
                  <div className="bg-[rgba(16,185,129,0.15)] text-[#10b981] text-xs rounded-full px-2 py-0.5">
                    {successCount} {successCount === 1 ? 'Success' : 'Successes'}
                  </div>
                )}
              </div>
            )}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="size-7 p-1 hover:bg-[#1a1a1a] text-[#e2e8f0]"
                    size="icon"
                    onClick={clearConsole}
                  >
                    <CrossSmallIcon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear console</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="size-7 p-1 hover:bg-[#1a1a1a] text-[#e2e8f0]"
                    size="icon"
                    onClick={toggleExpanded}
                  >
                    {isExpanded ? <ChevronDownIcon className="size-4" /> : <ChevronUpIcon className="size-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isExpanded ? 'Collapse' : 'Expand'} console</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Console Content - Only visible when expanded */}
        {isExpanded && (
          <div className="overflow-y-auto overflow-x-hidden scrollbar-custom p-2 space-y-1 bg-[#030303]">
            {filteredOutputs.map((consoleOutput, index) => {
              // Extract workflow status if available
              const workflowStatus = extractWorkflowStatus(consoleOutput);
              const hasNodeStatus = workflowStatus && workflowStatus.result && workflowStatus.result.node_status;
              
              // Determine if we should show a normal output or a workflow output
              const isWorkflowOutput = hasNodeStatus;
              
              return (
                <div
                  key={consoleOutput.id}
                  className="border border-[#1a1a1a] rounded-md overflow-hidden bg-[#030303]"
                >
                  {/* Header bar with status and actions */}
                  <div className="flex justify-between items-center px-3 py-1.5 bg-[#050505] border-b border-[#1a1a1a]">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn('font-medium text-xs rounded-full px-2 py-0.5', {
                          'bg-[rgba(59,130,246,0.15)] text-[#3b82f6]': ['in_progress', 'loading_packages'].includes(consoleOutput.status),
                          'bg-[rgba(16,185,129,0.15)] text-[#10b981]': consoleOutput.status === 'completed',
                          'bg-[rgba(239,68,68,0.15)] text-[#ef4444]': consoleOutput.status === 'failed',
                        })}
                      >
                        {consoleOutput.status === 'in_progress' ? 'Running' : 
                         consoleOutput.status === 'loading_packages' ? 'Loading' :
                         consoleOutput.status === 'completed' ? 'Success' : 'Error'}
                      </span>
                      {consoleOutput.timestamp && (
                        <span className="text-[#4b5563] text-xs">
                          {formatTimestamp(consoleOutput.timestamp)}
                        </span>
                      )}
                      {consoleOutput.executionTime && (
                        <span className="text-[#4b5563] text-xs">
                          {(consoleOutput.executionTime / 1000).toFixed(2)}s
                        </span>
                      )}
                    </div>
                    <div className="flex items-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 p-1 text-[#4b5563] hover:text-[#e2e8f0]"
                              onClick={() => {
                                const content = consoleOutput.contents
                                  .filter(c => c.type === 'text')
                                  .map(c => c.value)
                                  .join('\n');
                                copyOutput(consoleOutput.id, content);
                              }}
                            >
                              {copiedOutputId === consoleOutput.id ? (
                                <CheckIcon className="size-3.5" />
                              ) : (
                                <CopyIcon className="size-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{copiedOutputId === consoleOutput.id ? 'Copied!' : 'Copy output'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  
                  {/* Content area */}
                  <div className="p-2">
                    {/* In-progress indicator - only show for most recent output when multiple are running */}
                    {['in_progress', 'loading_packages'].includes(consoleOutput.status) && 
                     // Only show for the most recent in-progress output
                     index === filteredOutputs.findIndex(output => 
                       ['in_progress', 'loading_packages'].includes(output.status)
                     ) && 
                     // Hide if any content has been received (other than initialization messages)
                     consoleOutput.contents.filter(content => 
                       content.type !== 'image' && 
                       !content.value.includes('Initializing') && 
                       !content.value.includes('Loading')
                     ).length === 0 && (
                      <div className="flex items-center gap-2 text-[#94a3b8] px-3 py-2 bg-[#0f0f10] rounded">
                        <LoaderIcon className="size-4 text-[#3b82f6] animate-spin" />
                        <span>
                          {consoleOutput.status === 'in_progress'
                            ? 'Initializing...'
                            : consoleOutput.status === 'loading_packages'
                              ? 'Loading packages...'
                              : null}
                        </span>
                      </div>
                    )}
                    
                    {/* Workflow output display with node status */}
                    {isWorkflowOutput && !['in_progress', 'loading_packages'].includes(consoleOutput.status) && (
                      <div className="space-y-2">
                        {/* Workflow status summary card */}
                        {workflowStatus.result?.message && (
                          <div className={cn("p-2 rounded-md border", {
                            "bg-[rgba(6,78,59,0.15)] border-[rgba(16,185,129,0.3)]": workflowStatus.status === 'success',
                            "bg-[rgba(127,29,29,0.15)] border-[rgba(239,68,68,0.3)]": workflowStatus.status === 'error' || consoleOutput.status === 'failed'
                          })}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-[#e2e8f0]">Workflow Execution</span>
                              <span 
                                className={cn("text-xs px-1.5 py-0.5 rounded", {
                                  "bg-[rgba(16,185,129,0.15)] text-[#10b981]": workflowStatus.status === 'success',
                                  "bg-[rgba(239,68,68,0.15)] text-[#ef4444]": workflowStatus.status === 'error' || consoleOutput.status === 'failed'
                                })}
                              >
                                {workflowStatus.status || (consoleOutput.status === 'failed' ? 'error' : 'unknown')}
                              </span>
                            </div>
                            <div className="mt-1 text-xs">
                              <span className="text-[#94a3b8]">Message: </span>
                              <span className={cn({
                                "text-[#ef4444]": workflowStatus.status === 'error' || consoleOutput.status === 'failed',
                                "text-[#e2e8f0]": workflowStatus.status !== 'error' && consoleOutput.status !== 'failed'
                              })}>
                                {workflowStatus.result.message}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Node Status Cards */}
                        <CollapsibleSection
                          id={consoleOutput.id}
                          title="Node Status"
                          icon={<Workflow className="size-3.5 text-[#3b82f6]" />}
                          defaultExpanded={true}
                        >
                          <div className="p-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 bg-[#0f0f10]">
                            s 
                          </div>
                        </CollapsibleSection>
                        
                        {/* Node Results Section - Only if results exist */}
                        {workflowStatus.result?.results && (
                          <CollapsibleSection
                            id={`${consoleOutput.id}-results`}
                            title="Node Results"
                            icon={<Terminal className="size-3.5 text-[#3b82f6]" />}
                          >
                            <div className="p-2 space-y-1 bg-[#0f0f10]">
                              {Object.entries(workflowStatus.result.results).map(([nodeId, result]) => {
                                const isExpanded = expandedNodeResults[`${consoleOutput.id}-${nodeId}`] ?? false;
                                const nodeStatus = workflowStatus.result.node_status[nodeId];
                                const isFailed = nodeStatus && (nodeStatus.status === 'error' || nodeStatus.status === 'failed');
                                const styles = nodeStatus ? getStatusStyles(nodeStatus.status) : {};
                                
                                return (
                                  <Collapsible
                                    key={nodeId}
                                    id={`node-result-${consoleOutput.id}-${nodeId}`}
                                    open={expandedNodeResults[`${consoleOutput.id}-${nodeId}`] === true}
                                    onOpenChange={() => toggleNodeResult(nodeId, consoleOutput.id)}
                                    className="border border-[#1a1a1a] rounded overflow-hidden"
                                  >
                                    <CollapsibleTrigger 
                                      className="w-full px-3 py-2 flex items-center hover:bg-[#0a0a0a] transition-colors"
                                      style={{
                                        backgroundColor: isFailed ? 'rgba(127, 29, 29, 0.3)' : styles.bg || '#050505'
                                      }}
                                    >
                                      <Info className="size-3.5 mr-2" style={{ color: styles.text || '#3b82f6' }} />
                                      <span 
                                        className="text-xs font-semibold"
                                        style={{ color: isFailed ? '#ef4444' : styles.text || '#e2e8f0' }}
                                      >
                                        {nodeId}
                                      </span>
                                      <ChevronDownIcon 
                                        className={cn("ml-auto size-4 transition-transform", {
                                          "transform rotate-180": isExpanded
                                        })}
                                        style={{ color: styles.text || '#4b5563' }}
                                      />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <div className="relative">
                                        <pre className="p-3 text-xs bg-[#0f0f10] overflow-x-auto scrollbar-custom max-h-60 font-mono" style={{ fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace' }}>
                                          <code className="text-[#e2e8f0]">
                                            {formatJson(result)}
                                          </code>
                                        </pre>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="absolute top-1 right-1 size-6 p-1 text-[#4b5563] hover:text-[#e2e8f0] hover:bg-[#1a1a1a] rounded-sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            copyOutput(`${consoleOutput.id}-${nodeId}`, formatJson(result));
                                          }}
                                          title="Copy JSON"
                                        >
                                          {copiedOutputId === `${consoleOutput.id}-${nodeId}` ? (
                                            <CheckIcon className="size-3.5" />
                                          ) : (
                                            <CopyIcon className="size-3.5" />
                                          )}
                                        </Button>
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                );
                              })}
                            </div>
                          </CollapsibleSection>
                        )}
                        
                        {/* Raw Content Section - Include original content in collapsible section */}
                        <CollapsibleSection
                          id={`${consoleOutput.id}-raw`}
                          title="Raw Output"
                          icon={<Terminal className="size-3.5 text-[#4b5563]" />}
                        >
                          <div className="p-2 space-y-1 bg-[#0f0f10]">
                            {consoleOutput.contents.map((content, contentIndex) => {
                             if (content.type === 'image') {
                              return (
                                <div key={`${consoleOutput.id}-${contentIndex}`} className="relative group">
                                  <img
                                    src={content.value}
                                    alt="output"
                                    className="rounded-md max-w-[600px] w-full border border-[#121212]"
                                  />
                                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="secondary"
                                      size="icon"
                                      className="size-7 bg-black/60 hover:bg-black/80 border-none text-white"
                                      onClick={() => window.open(content.value, '_blank')}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                        <polyline points="15 3 21 3 21 9" />
                                        <line x1="10" y1="14" x2="21" y2="3" />
                                      </svg>
                                    </Button>
                                  </div>
                                </div>
                              );
                            }
                            
                            // Attempt to detect and format JSON
                            const formattedContent = formatPossibleJson(content.value);
                            const isJson = formattedContent !== content.value;
                            
                            let bgColor = "#0f0f10";
                            let borderColor = "#121212";
                            let textColor = "#e2e8f0";
                            
                            if (content.type === 'error') {
                              bgColor = "rgba(127, 29, 29, 0.15)";
                              borderColor = "rgba(239, 68, 68, 0.3)";
                              textColor = "#ef4444";
                            } else if (content.type === 'warning') {
                              bgColor = "rgba(120, 53, 15, 0.15)";
                              borderColor = "rgba(245, 158, 11, 0.3)";
                              textColor = "#f59e0b";
                            } else if (content.type === 'info') {
                              bgColor = "rgba(30, 58, 138, 0.15)";
                              borderColor = "rgba(59, 130, 246, 0.3)";
                              textColor = "#3b82f6";
                            } else if (content.type === 'success') {
                              bgColor = "rgba(6, 78, 59, 0.15)";
                              borderColor = "rgba(16, 185, 129, 0.3)";
                              textColor = "#10b981";
                            }
                            
                            return (
                              <div
                                key={`${consoleOutput.id}-${contentIndex}`}
                                className="w-full rounded overflow-hidden border"
                                style={{
                                  backgroundColor: bgColor,
                                  borderColor: borderColor
                                }}
                              >
                                {isJson ? (
                                  <CollapsibleSection
                                    id={`${consoleOutput.id}-content-${contentIndex}`}
                                    title="JSON Content"
                                    icon={<Info className="size-3.5 text-[#3b82f6]" />}
                                    className="border-0 rounded-none"
                                  >
                                    <div className="relative">
                                      <pre className="p-2 text-xs font-mono overflow-x-auto scrollbar-custom bg-[#0f0f10] text-[#e2e8f0]" style={{ fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace' }}>
                                        {formattedContent}
                                      </pre>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-1 right-1 size-6 p-1 text-[#4b5563] hover:text-[#e2e8f0] hover:bg-[#1a1a1a] rounded-sm"
                                        onClick={() => copyOutput(`${consoleOutput.id}-${contentIndex}`, formattedContent)}
                                        title="Copy JSON"
                                      >
                                        {copiedOutputId === `${consoleOutput.id}-${contentIndex}` ? (
                                          <CheckIcon className="size-3.5" />
                                        ) : (
                                          <CopyIcon className="size-3.5" />
                                        )}
                                      </Button>
                                    </div>
                                  </CollapsibleSection>
                                ) : (
                                  <pre className="p-2 text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto scrollbar-custom" style={{ fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace', color: textColor }}>
                                    {content.value}
                                  </pre>
                                )}
                              </div>
                            );
                          })}
                          </div>
                        </CollapsibleSection>
                      </div>
                    )}
                    
                    {/* Normal output display (non-workflow) */}
                    {!isWorkflowOutput && !['in_progress', 'loading_packages'].includes(consoleOutput.status) && (
                      <div className="space-y-1">
                        {consoleOutput.contents.map((content, contentIndex) => {
                          if (content.type === 'image') {
                            return (
                              <div key={`${consoleOutput.id}-${contentIndex}`} className="relative group">
                                <img
                                  src={content.value}
                                  alt="output"
                                  className="rounded-md max-w-[600px] w-full border border-[#121212]"
                                />
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="size-7 bg-black/60 hover:bg-black/80 border-none text-white"
                                    onClick={() => window.open(content.value, '_blank')}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                      <polyline points="15 3 21 3 21 9" />
                                      <line x1="10" y1="14" x2="21" y2="3" />
                                    </svg>
                                  </Button>
                                </div>
                              </div>
                            );
                          }
                          
                          // Attempt to detect and format JSON
                          const formattedContent = formatPossibleJson(content.value);
                          const isJson = formattedContent !== content.value;
                          
                          let bgColor = "#0f0f10";
                          let borderColor = "#121212";
                          let textColor = "#e2e8f0";
                          
                          if (content.type === 'error') {
                            bgColor = "rgba(127, 29, 29, 0.15)";
                            borderColor = "rgba(239, 68, 68, 0.3)";
                            textColor = "#ef4444";
                          } else if (content.type === 'warning') {
                            bgColor = "rgba(120, 53, 15, 0.15)";
                            borderColor = "rgba(245, 158, 11, 0.3)";
                            textColor = "#f59e0b";
                          } else if (content.type === 'info') {
                            bgColor = "rgba(30, 58, 138, 0.15)";
                            borderColor = "rgba(59, 130, 246, 0.3)";
                            textColor = "#3b82f6";
                          } else if (content.type === 'success') {
                            bgColor = "rgba(6, 78, 59, 0.15)";
                            borderColor = "rgba(16, 185, 129, 0.3)";
                            textColor = "#10b981";
                          }
                          
                          return (
                            <div
                              key={`${consoleOutput.id}-${contentIndex}`}
                              className="w-full rounded overflow-hidden border"
                              style={{
                                backgroundColor: bgColor,
                                borderColor: borderColor
                              }}
                            >
                              {isJson ? (
                                <CollapsibleSection
                                  id={`${consoleOutput.id}-content-${contentIndex}`}
                                  title="JSON Content"
                                  icon={<Info className="size-3.5 text-[#3b82f6]" />}
                                  className="border-0 rounded-none"
                                >
                                  <div className="relative">
                                    <pre className="p-2 text-xs font-mono overflow-x-auto scrollbar-custom bg-[#0f0f10] text-[#e2e8f0]" style={{ fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace' }}>
                                      {formattedContent}
                                    </pre>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="absolute top-1 right-1 size-6 p-1 text-[#4b5563] hover:text-[#e2e8f0] hover:bg-[#1a1a1a] rounded-sm"
                                      onClick={() => copyOutput(`${consoleOutput.id}-${contentIndex}`, formattedContent)}
                                      title="Copy JSON"
                                    >
                                      {copiedOutputId === `${consoleOutput.id}-${contentIndex}` ? (
                                        <CheckIcon className="size-3.5" />
                                      ) : (
                                        <CopyIcon className="size-3.5" />
                                      )}
                                    </Button>
                                  </div>
                                </CollapsibleSection>
                              ) : (
                                <pre className="p-2 text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto scrollbar-custom" style={{ fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace', color: textColor }}>
                                  {content.value}
                                </pre>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={consoleEndRef} />
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
          background: #000000;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb {
          background-color: #1a1a1a;
          border-radius: 3px;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
          background-color: #262626;
        }
        .scrollbar-custom {
          scrollbar-width: thin;
          scrollbar-color: #1a1a1a #000000;
        }
        
        /* GitHub-like monospace font stack */
        .font-family-monospace, pre, code {
          font-family: SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace !important;
          font-feature-settings: "tnum", "tnum";
          line-height: 1.5;
        }
        
        /* Enhanced transitions for better UX */
        .transition-height {
          transition-property: height;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </>
  );
}