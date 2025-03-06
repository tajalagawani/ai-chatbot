import { Button } from './ui/button';
import {
  Dispatch,
  SetStateAction,
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

export type OutputContentType = 'text' | 'image' | 'error' | 'warning' | 'info' | 'success';

export interface ConsoleOutputContent {
  type: OutputContentType;
  value: string;
  timestamp?: string;
}

export interface ConsoleOutput {
  id: string;
  status: 'in_progress' | 'loading_packages' | 'completed' | 'failed';
  contents: Array<ConsoleOutputContent>;
  timestamp?: string;
  executionTime?: number; // in milliseconds
}

interface ConsoleProps {
  consoleOutputs: Array<ConsoleOutput>;
  setConsoleOutputs: Dispatch<SetStateAction<Array<ConsoleOutput>>>;
  maxHeight?: number;
  minHeight?: number;
  initialHeight?: number;
}

interface NodeStatus {
  message: string;
  status: 'completed' | 'failed' | 'pending' | 'in_progress';
  timestamp: string;
}

interface WorkflowStatus {
  result?: {
    message: string;
    node_status: Record<string, NodeStatus>;
    results?: Record<string, any>;
  };
  status?: string;
  error?: string;
}

// Theme colors
const THEME = {
  bg: {
    primary: '#000000',
    card: '#09090b',
    header: '#0f1219',
    section: '#09090b',
    border: '#1f2937'
  },
  text: {
    primary: '#e2e8f0',
    secondary: '#94a3b8',
    muted: '#64748b'
  },
  status: {
    completed: {
      bg: 'rgba(6, 78, 59, 0.2)',
      border: 'rgba(16, 185, 129, 0.4)',
      text: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.2)'
    },
    failed: {
      bg: 'rgba(127, 29, 29, 0.2)',
      border: 'rgba(239, 68, 68, 0.4)',
      text: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.2)'
    },
    pending: {
      bg: 'rgba(30, 58, 138, 0.2)',
      border: 'rgba(59, 130, 246, 0.4)',
      text: '#3b82f6',
      badgeBg: 'rgba(59, 130, 246, 0.2)'
    },
    in_progress: {
      bg: 'rgba(120, 53, 15, 0.2)',
      border: 'rgba(245, 158, 11, 0.4)',
      text: '#f59e0b',
      badgeBg: 'rgba(245, 158, 11, 0.2)'
    }
  }
};

// Helper function to safely format timestamps
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    // Check if timestamp is a valid date string or timestamp
    const date = new Date(timestamp);
    
    // Check if date is valid (Invalid Date objects return NaN for getTime())
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return date.toLocaleTimeString();
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
};

// Format JSON for better display
const formatJson = (jsonObj) => {
  try {
    return JSON.stringify(jsonObj, null, 2);
  } catch (error) {
    console.error('Error formatting JSON:', error);
    return JSON.stringify(jsonObj);
  }
};

// Try to detect if a string contains JSON and format it
const formatPossibleJson = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  // Check if the string looks like JSON
  if ((text.trim().startsWith('{') && text.trim().endsWith('}')) || 
      (text.trim().startsWith('[') && text.trim().endsWith(']'))) {
    try {
      const parsed = JSON.parse(text);
      return formatJson(parsed);
    } catch {
      // Not valid JSON, return as is
      return text;
    }
  }
  
  return text;
};

// Extract node status from console output content
const extractWorkflowStatus = (consoleOutput: ConsoleOutput): WorkflowStatus | null => {
  try {
    // Find content with execution result
    const resultContent = consoleOutput.contents.find(content => 
      content.value.includes('Execution completed:') || 
      content.value.includes('Execution failed:')
    );
    
    if (!resultContent) return null;
    
    // Extract JSON from the content
    const jsonStart = resultContent.value.indexOf('{');
    if (jsonStart === -1) return null;
    
    const jsonString = resultContent.value.substring(jsonStart);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error extracting workflow status:', error);
    return null;
  }
};

export function Console({ 
  consoleOutputs, 
  setConsoleOutputs, 
  maxHeight = 800, 
  minHeight = 100, 
  initialHeight = 300 
}: ConsoleProps) {
  const [height, setHeight] = useState<number>(initialHeight);
  const [isResizing, setIsResizing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [copiedOutputId, setCopiedOutputId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // Find outputs with node status
  const outputsWithNodeStatus = useMemo(() => {
    return consoleOutputs.filter(output => {
      const workflowStatus = extractWorkflowStatus(output);
      return workflowStatus && workflowStatus.result && workflowStatus.result.node_status;
    });
  }, [consoleOutputs]);

  // Filter outputs based on active tab
  const filteredOutputs = useMemo(() => {
    if (activeTab === 'all') return consoleOutputs;
    if (activeTab === 'error') return consoleOutputs.filter(output => output.status === 'failed');
    if (activeTab === 'success') return consoleOutputs.filter(output => output.status === 'completed');
    if (activeTab === 'nodes') return outputsWithNodeStatus;
    return consoleOutputs;
  }, [consoleOutputs, activeTab, outputsWithNodeStatus]);

  // Count errors, completions, and node executions for badge display
  const errorCount = useMemo(() => 
    consoleOutputs.filter(output => output.status === 'failed').length, 
    [consoleOutputs]
  );
  
  const successCount = useMemo(() => 
    consoleOutputs.filter(output => output.status === 'completed').length, 
    [consoleOutputs]
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
    setConsoleOutputs([]);
  }, [setConsoleOutputs]);

  const copyOutput = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedOutputId(id);
      setTimeout(() => setCopiedOutputId(null), 2000);
    });
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
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

  // Clear console when artifact is hidden
  useEffect(() => {
    if (!isArtifactVisible) {
      setConsoleOutputs([]);
    }
  }, [isArtifactVisible, setConsoleOutputs]);

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
        className={cn("border border-[#1f2937] rounded overflow-hidden", className)}
      >
        <CollapsibleTrigger className="w-full px-3 py-2 flex items-center bg-[#0f1219] hover:bg-[#1a2030] transition-colors">
          {icon && <span className="mr-2">{icon}</span>}
          <span className="text-xs font-semibold text-[#e2e8f0]">{title}</span>
          <ChevronDownIcon 
            className={cn("ml-auto size-4 text-[#64748b] transition-transform", {
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
    return (
      <CollapsibleSection
        id={id}
        title={title}
        icon={<Info className="size-3.5 text-[#3b82f6]" />}
      >
        <pre className="p-3 text-xs bg-[#09090b] overflow-x-auto scrollbar-custom max-h-60">
          <code className="text-[#e2e8f0]">
            {formatJson(data)}
          </code>
        </pre>
      </CollapsibleSection>
    );
  };

  // Get status colors
  const getStatusStyles = (status) => {
    switch(status) {
      case 'completed':
        return {
          bg: "rgba(6, 78, 59, 0.2)",
          border: "rgba(16, 185, 129, 0.4)",
          text: "#10b981",
          badgeBg: "rgba(16, 185, 129, 0.2)",
          icon: <CheckIcon className="size-3.5 text-[#10b981]" />
        };
      case 'failed':
        return {
          bg: "rgba(127, 29, 29, 0.2)",
          border: "rgba(239, 68, 68, 0.4)",
          text: "#ef4444",
          badgeBg: "rgba(239, 68, 68, 0.2)",
          icon: <AlertTriangle className="size-3.5 text-[#ef4444]" />
        };
      case 'in_progress':
        return {
          bg: "rgba(120, 53, 15, 0.2)",
          border: "rgba(245, 158, 11, 0.4)",
          text: "#f59e0b",
          badgeBg: "rgba(245, 158, 11, 0.2)",
          icon: <LoaderIcon className="size-3.5 text-[#f59e0b] animate-spin" />
        };
      case 'pending':
      default:
        return {
          bg: "rgba(30, 58, 138, 0.2)",
          border: "rgba(59, 130, 246, 0.4)",
          text: "#3b82f6",
          badgeBg: "rgba(59, 130, 246, 0.2)",
          icon: <Clock className="size-3.5 text-[#3b82f6]" />
        };
    }
  };

  // If no outputs, don't render anything
  if (consoleOutputs.length === 0) return null;

  return (
    <>
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

      <div
        ref={contentRef}
        className={cn(
          'fixed flex flex-col bottom-0 bg-black w-full border-t z-40 overflow-hidden border-[#1f2937] transition-height duration-150',
          {
            'select-none': isResizing,
          },
        )}
        style={{ height }}
      >
        <div className="flex flex-row justify-between items-center w-full h-fit border-b border-[#1f2937] px-2 py-1 sticky top-0 z-50 bg-[#0f1219]">
          <div className="text-sm pl-2 text-[#e2e8f0] flex flex-row gap-3 items-center">
            <div className="text-[#94a3b8]">
              <TerminalWindowIcon />
            </div>
            <div className="font-medium">Console</div>
            <div className="text-xs text-[#64748b]">
              {filteredOutputs.length} output{filteredOutputs.length !== 1 ? 's' : ''}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Tabs 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="mr-2"
            >
              <TabsList className="h-7 bg-[#09090b]">
                <TabsTrigger 
                  value="all" 
                  className="text-xs h-6 px-2 data-[state=active]:bg-[#1f2937]"
                >
                  All ({consoleOutputs.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="nodes" 
                  className="text-xs h-6 px-2 data-[state=active]:bg-[#1f2937]"
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
                  className="text-xs h-6 px-2 data-[state=active]:bg-[#1f2937]"
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
                  className="text-xs h-6 px-2 data-[state=active]:bg-[#1f2937]"
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

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="size-7 p-1 hover:bg-[#1f2937] text-[#e2e8f0]"
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
                    className="size-7 p-1 hover:bg-[#1f2937] text-[#e2e8f0]"
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

        <div className="overflow-y-auto overflow-x-hidden scrollbar-custom p-3 space-y-3 bg-black">
          {filteredOutputs.map((consoleOutput, index) => {
            // Extract workflow status if available
            const workflowStatus = extractWorkflowStatus(consoleOutput);
            const hasNodeStatus = workflowStatus && workflowStatus.result && workflowStatus.result.node_status;
            
            // Determine if we should show a normal output or a workflow output
            const isWorkflowOutput = hasNodeStatus;
            
            return (
              <div
                key={consoleOutput.id}
                className="border border-[#1f2937] rounded-md overflow-hidden bg-[#09090b]"
              >
                {/* Header bar with status and actions */}
                <div className="flex justify-between items-center px-3 py-2 bg-[#0f1219] border-b border-[#1f2937]">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn('font-medium text-xs rounded-full px-2 py-0.5', {
                        'bg-[rgba(59,130,246,0.2)] text-[#3b82f6]': ['in_progress', 'loading_packages'].includes(consoleOutput.status),
                        'bg-[rgba(16,185,129,0.2)] text-[#10b981]': consoleOutput.status === 'completed',
                        'bg-[rgba(239,68,68,0.2)] text-[#ef4444]': consoleOutput.status === 'failed',
                      })}
                    >
                      {consoleOutput.status === 'in_progress' ? 'Running' : 
                       consoleOutput.status === 'loading_packages' ? 'Loading' :
                       consoleOutput.status === 'completed' ? 'Success' : 'Error'}
                    </span>
                    {consoleOutput.timestamp && (
                      <span className="text-[#64748b] text-xs">
                        {formatTimestamp(consoleOutput.timestamp)}
                      </span>
                    )}
                    {consoleOutput.executionTime && (
                      <span className="text-[#64748b] text-xs">
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
                            className="size-6 p-1 text-[#64748b] hover:text-[#e2e8f0]"
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
                <div className="p-3">
                  {/* In-progress indicator */}
                  {['in_progress', 'loading_packages'].includes(consoleOutput.status) && (
                    <div className="flex items-center gap-2 text-[#94a3b8] px-3 py-2 bg-[#0f1219] rounded">
                      <LoaderIcon className="size-4 text-[#3b82f6] animate-spin" />
                      <span>
                        {consoleOutput.status === 'in_progress'
                          ? 'Initializing...'
                          : consoleOutput.status === 'loading_packages'
                            ? consoleOutput.contents.map((content) =>
                                content.type === 'text' ? content.value : null
                              ).join(' ')
                            : null}
                      </span>
                    </div>
                  )}
                  
                  {/* Workflow output display with node status */}
                  {isWorkflowOutput && !['in_progress', 'loading_packages'].includes(consoleOutput.status) && (
                    <div className="space-y-3">
                      {/* Workflow status summary card */}
                      {workflowStatus.result?.message && (
                        <div className={cn("p-3 rounded-md border", {
                          "bg-[rgba(6,78,59,0.2)] border-[rgba(16,185,129,0.4)]": workflowStatus.status === 'success',
                          "bg-[rgba(127,29,29,0.2)] border-[rgba(239,68,68,0.4)]": workflowStatus.status === 'error' || consoleOutput.status === 'failed'
                        })}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#e2e8f0]">Workflow Execution</span>
                            <span 
                              className={cn("text-xs px-1.5 py-0.5 rounded", {
                                "bg-[rgba(16,185,129,0.2)] text-[#10b981]": workflowStatus.status === 'success',
                                "bg-[rgba(239,68,68,0.2)] text-[#ef4444]": workflowStatus.status === 'error' || consoleOutput.status === 'failed'
                              })}
                            >
                              {workflowStatus.status || (consoleOutput.status === 'failed' ? 'error' : 'unknown')}
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs">
                            <span className="text-[#94a3b8]">Message: </span>
                            <span className="text-[#e2e8f0]">{workflowStatus.result.message}</span>
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
                        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 bg-[#09090b]">
                          {Object.entries(workflowStatus.result.node_status).map(([nodeId, status]) => {
                            const styles = getStatusStyles(status.status);
                            
                            return (
                              <div
                                key={nodeId}
                                className="px-2 py-1.5 rounded border"
                                style={{ 
                                  backgroundColor: styles.bg,
                                  borderColor: styles.border 
                                }}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-medium text-xs text-[#e2e8f0] truncate max-w-[120px]" title={nodeId}>
                                    {nodeId}
                                  </span>
                                  <div className="flex items-center">
                                    <span 
                                      className="text-[9px] px-1 py-0.5 rounded"
                                      style={{ 
                                        backgroundColor: styles.badgeBg,
                                        color: styles.text
                                      }}
                                    >
                                      {status.status}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-start mt-1">
                                  <div className="flex-shrink-0 mt-0.5 mr-1">
                                    {styles.icon}
                                  </div>
                                  <div className="text-[10px] text-[#94a3b8] line-clamp-2" title={status.message}>
                                    {status.message}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleSection>
                      
                      {/* Node Results Section - Only if results exist */}
                      {workflowStatus.result?.results && (
                        <CollapsibleSection
                          id={`${consoleOutput.id}-results`}
                          title="Node Results"
                          icon={<Terminal className="size-3.5 text-[#3b82f6]" />}
                        >
                          <div className="p-3 space-y-2 bg-[#09090b]">
                            {Object.entries(workflowStatus.result.results).map(([nodeId, result]) => (
                              <JsonViewer 
                                key={nodeId} 
                                data={result} 
                                title={nodeId} 
                                id={`${consoleOutput.id}-${nodeId}`}
                              />
                            ))}
                          </div>
                        </CollapsibleSection>
                      )}
                      
                      {/* Raw Content Section - Include original content in collapsible section */}
                      <CollapsibleSection
                        id={`${consoleOutput.id}-raw`}
                        title="Raw Output"
                        icon={<Terminal className="size-3.5 text-[#64748b]" />}
                      >
                        <div className="p-3 space-y-2 bg-[#09090b]">
                          {consoleOutput.contents.map((content, contentIndex) => {
                           if (content.type === 'image') {
                            return (
                              <div key={`${consoleOutput.id}-${contentIndex}`} className="relative group">
                                <img
                                  src={content.value}
                                  alt="output"
                                  className="rounded-md max-w-[600px] w-full border border-[#1f2937]"
                                />
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="size-7 bg-black/50 hover:bg-black/70 border-none text-white"
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
                          
                          let bgColor = "#0f1219";
                          let borderColor = "#1f2937";
                          
                          if (content.type === 'error') {
                            bgColor = "rgba(127, 29, 29, 0.2)";
                            borderColor = "rgba(239, 68, 68, 0.4)";
                          } else if (content.type === 'warning') {
                            bgColor = "rgba(120, 53, 15, 0.2)";
                            borderColor = "rgba(245, 158, 11, 0.4)";
                          } else if (content.type === 'info') {
                            bgColor = "rgba(30, 58, 138, 0.2)";
                            borderColor = "rgba(59, 130, 246, 0.4)";
                          } else if (content.type === 'success') {
                            bgColor = "rgba(6, 78, 59, 0.2)";
                            borderColor = "rgba(16, 185, 129, 0.4)";
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
                                  <pre className="p-3 text-xs font-mono overflow-x-auto scrollbar-custom bg-[#09090b] text-[#e2e8f0]">
                                    {formattedContent}
                                  </pre>
                                </CollapsibleSection>
                              ) : (
                                <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto scrollbar-custom text-[#e2e8f0]">
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
                  <div className="space-y-2">
                    {consoleOutput.contents.map((content, contentIndex) => {
                      if (content.type === 'image') {
                        return (
                          <div key={`${consoleOutput.id}-${contentIndex}`} className="relative group">
                            <img
                              src={content.value}
                              alt="output"
                              className="rounded-md max-w-[600px] w-full border border-[#1f2937]"
                            />
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="secondary"
                                size="icon"
                                className="size-7 bg-black/50 hover:bg-black/70 border-none text-white"
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
                      
                      let bgColor = "#0f1219";
                      let borderColor = "#1f2937";
                      
                      if (content.type === 'error') {
                        bgColor = "rgba(127, 29, 29, 0.2)";
                        borderColor = "rgba(239, 68, 68, 0.4)";
                      } else if (content.type === 'warning') {
                        bgColor = "rgba(120, 53, 15, 0.2)";
                        borderColor = "rgba(245, 158, 11, 0.4)";
                      } else if (content.type === 'info') {
                        bgColor = "rgba(30, 58, 138, 0.2)";
                        borderColor = "rgba(59, 130, 246, 0.4)";
                      } else if (content.type === 'success') {
                        bgColor = "rgba(6, 78, 59, 0.2)";
                        borderColor = "rgba(16, 185, 129, 0.4)";
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
                              <pre className="p-3 text-xs font-mono overflow-x-auto scrollbar-custom bg-[#09090b] text-[#e2e8f0]">
                                {formattedContent}
                              </pre>
                            </CollapsibleSection>
                          ) : (
                            <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto scrollbar-custom text-[#e2e8f0]">
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
    </div>
    
    {/* Custom scrollbar styles */}
    <style jsx global>{`
      .scrollbar-custom::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .scrollbar-custom::-webkit-scrollbar-track {
        background: #000000;
      }
      .scrollbar-custom::-webkit-scrollbar-thumb {
        background-color: #1f2937;
        border-radius: 4px;
      }
      .scrollbar-custom::-webkit-scrollbar-thumb:hover {
        background-color: #374151;
      }
      .scrollbar-custom {
        scrollbar-width: thin;
        scrollbar-color: #1f2937 #000000;
      }
    `}</style>
  </>
);
}