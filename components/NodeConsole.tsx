// NodeLogger.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon, ChevronUpIcon, CheckIcon, CopyIcon, CrossSmallIcon, LoaderIcon, AlertTriangle, Clock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Types
export interface ConsoleContentItem {
  type: 'text' | 'image' | 'error' | 'warning' | 'info' | 'success';
  value: string;
}

export interface ConsoleOutput {
  id: string;
  timestamp: string;
  contents: ConsoleContentItem[];
  status: 'in_progress' | 'loading_packages' | 'completed' | 'failed';
  executionTime?: number;
  nodeId?: string;
}

export interface NodeStatus {
  status: string;
  message: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
}

export interface WorkflowResult {
  node_status: Record<string, NodeStatus>;
  results?: Record<string, any>;
  message?: string;
}

export interface WorkflowStatus {
  status: string;
  result: WorkflowResult;
}

// Helper functions
export const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) {
    return timestamp;
  }
};

export const formatJson = (jsonData: any): string => {
  try {
    return typeof jsonData === 'string' 
      ? JSON.stringify(JSON.parse(jsonData), null, 2)
      : JSON.stringify(jsonData, null, 2);
  } catch (e) {
    return typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
  }
};

export const formatPossibleJson = (content: string): string => {
  if (!content) return content;
  
  try {
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      const jsonObj = JSON.parse(content);
      return JSON.stringify(jsonObj, null, 2);
    }
    return content;
  } catch (e) {
    // Find if there's an embedded JSON object within the text
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      try {
        const jsonContent = content.substring(jsonStart, jsonEnd + 1);
        const jsonObj = JSON.parse(jsonContent);
        
        // Replace the JSON portion with formatted JSON
        return content.substring(0, jsonStart) + 
               JSON.stringify(jsonObj, null, 2) + 
               content.substring(jsonEnd + 1);
      } catch {
        // If parsing fails, return original content
      }
    }
    return content;
  }
};

export const extractWorkflowStatus = (output: ConsoleOutput): WorkflowStatus | null => {
  for (const content of output.contents) {
    if (content.type === 'text') {
      if (content.value.includes('Execution completed:') || content.value.includes('Execution failed:')) {
        const jsonStart = content.value.indexOf('{');
        if (jsonStart !== -1) {
          try {
            const jsonString = content.value.substring(jsonStart);
            return JSON.parse(jsonString);
          } catch (e) {
            // Silent error handling
          }
        }
      }
    }
  }
  return null;
};

export const getStatusStyles = (status: string): any => {
  let styles = {
    bg: 'rgba(30, 58, 138, 0.1)',
    border: 'rgba(59, 130, 246, 0.3)',
    text: '#3b82f6',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    icon: <Clock className="size-3 text-blue-500" />
  };

  switch (status.toLowerCase()) {
    case 'success':
    case 'completed':
      styles = {
        bg: 'rgba(6, 78, 59, 0.1)',
        border: 'rgba(16, 185, 129, 0.3)',
        text: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        icon: <CheckIcon className="size-3 text-green-500" />
      };
      break;
    case 'error':
    case 'failed':
      styles = {
        bg: 'rgba(127, 29, 29, 0.1)',
        border: 'rgba(239, 68, 68, 0.3)',
        text: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
        icon: <AlertTriangle className="size-3 text-red-500" />
      };
      break;
    case 'in_progress':
    case 'running':
      styles = {
        bg: 'rgba(30, 58, 138, 0.1)',
        border: 'rgba(59, 130, 246, 0.3)',
        text: '#3b82f6',
        badgeBg: 'rgba(59, 130, 246, 0.15)',
        icon: <LoaderIcon className="size-3 text-blue-500 animate-spin" />
      };
      break;
    case 'waiting':
    case 'pending':
      styles = {
        bg: 'rgba(120, 53, 15, 0.1)',
        border: 'rgba(245, 158, 11, 0.3)',
        text: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
        icon: <Clock className="size-3 text-amber-500" />
      };
      break;
    default:
      // Default is blue (in progress)
      break;
  }

  return styles;
};

// NodeLogger class
export class NodeLogger {
  private nodeId: string;
  private outputs: ConsoleOutput[] = [];
  private onUpdate: (outputs: ConsoleOutput[]) => void;
  private executionStart?: number;
  
  /**
   * Create a new NodeLogger
   * @param nodeId The ID of the node this logger is for
   * @param onUpdate Optional callback function when logs are updated
   */
  constructor(nodeId: string, onUpdate?: (outputs: ConsoleOutput[]) => void) {
    this.nodeId = nodeId;
    this.onUpdate = onUpdate || (() => {});
  }
  
  /**
   * Get all logs for this node
   */
  getLogs(): ConsoleOutput[] {
    return this.outputs;
  }
  
  /**
   * Clear all logs for this node
   */
  clearLogs(): void {
    this.outputs = [];
    this.onUpdate(this.outputs);
  }
  
  /**
   * Add a new log entry
   */
  private addLog(
    content: string, 
    status: 'in_progress' | 'loading_packages' | 'completed' | 'failed' = 'completed',
    type: 'text' | 'error' | 'warning' | 'info' | 'success' = 'text'
  ): ConsoleOutput {
    const logOutput: ConsoleOutput = {
      id: this.generateUUID(),
      timestamp: new Date().toISOString(),
      nodeId: this.nodeId,
      contents: [{
        type,
        value: content
      }],
      status
    };
    
    this.outputs.push(logOutput);
    this.onUpdate(this.outputs);
    
    return logOutput;
  }
  
  /**
   * Generate a unique ID for log entries
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  /**
   * Add content to an existing log entry
   */
  private addToLog(
    logOutput: ConsoleOutput,
    content: string,
    type: 'text' | 'error' | 'warning' | 'info' | 'success' = 'text'
  ): ConsoleOutput {
    const index = this.outputs.findIndex(o => o.id === logOutput.id);
    
    if (index === -1) {
      return this.addLog(content, logOutput.status, type);
    }
    
    const updatedLog = {
      ...logOutput,
      contents: [
        ...logOutput.contents,
        {
          type,
          value: content
        }
      ]
    };
    
    this.outputs[index] = updatedLog;
    this.onUpdate(this.outputs);
    
    return updatedLog;
  }
  
  /**
   * Update the status of an existing log entry
   */
  private updateLogStatus(
    logOutput: ConsoleOutput,
    status: 'in_progress' | 'loading_packages' | 'completed' | 'failed'
  ): ConsoleOutput {
    const index = this.outputs.findIndex(o => o.id === logOutput.id);
    
    if (index === -1) {
      return logOutput;
    }
    
    const updatedLog = {
      ...logOutput,
      status
    };
    
    this.outputs[index] = updatedLog;
    this.onUpdate(this.outputs);
    
    return updatedLog;
  }
  
  /**
   * Log an informational message
   */
  info(message: string): ConsoleOutput {
    return this.addLog(`[${this.nodeId}] ${message}`, 'completed', 'info');
  }
  
  /**
   * Log a success message
   */
  success(message: string): ConsoleOutput {
    return this.addLog(`[${this.nodeId}] ${message}`, 'completed', 'success');
  }
  
  /**
   * Log a warning message
   */
  warn(message: string): ConsoleOutput {
    return this.addLog(`[${this.nodeId}] ${message}`, 'completed', 'warning');
  }
  
  /**
   * Log an error message
   */
  error(message: string): ConsoleOutput {
    return this.addLog(`[${this.nodeId}] ${message}`, 'failed', 'error');
  }
  
  /**
   * Start a process with an in-progress log
   */
  start(message: string): ConsoleOutput {
    this.executionStart = Date.now();
    return this.addLog(`[${this.nodeId}] ${message}`, 'in_progress', 'info');
  }
  
  /**
   * Complete a process that was started
   */
  complete(logOutput: ConsoleOutput, message: string): ConsoleOutput {
    let updatedLog = this.addToLog(logOutput, `[${this.nodeId}] ${message}`, 'success');
    
    // Add execution time if we have a start time
    if (this.executionStart) {
      const executionTime = Date.now() - this.executionStart;
      updatedLog = {
        ...updatedLog,
        executionTime
      };
      
      // Reset execution start time
      this.executionStart = undefined;
      
      // Update in the outputs array
      const index = this.outputs.findIndex(o => o.id === updatedLog.id);
      if (index !== -1) {
        this.outputs[index] = updatedLog;
        this.onUpdate(this.outputs);
      }
    }
    
    return this.updateLogStatus(updatedLog, 'completed');
  }
  
  /**
   * Fail a process that was started
   */
  fail(logOutput: ConsoleOutput, message: string): ConsoleOutput {
    let updatedLog = this.addToLog(logOutput, `[${this.nodeId}] ${message}`, 'error');
    
    // Add execution time if we have a start time
    if (this.executionStart) {
      const executionTime = Date.now() - this.executionStart;
      updatedLog = {
        ...updatedLog,
        executionTime
      };
      
      // Reset execution start time
      this.executionStart = undefined;
      
      // Update in the outputs array
      const index = this.outputs.findIndex(o => o.id === updatedLog.id);
      if (index !== -1) {
        this.outputs[index] = updatedLog;
        this.onUpdate(this.outputs);
      }
    }
    
    return this.updateLogStatus(updatedLog, 'failed');
  }
  
  /**
   * Update an in-progress process
   */
  update(logOutput: ConsoleOutput, message: string): ConsoleOutput {
    return this.addToLog(logOutput, `[${this.nodeId}] ${message}`, 'info');
  }
  
  /**
   * Log an object as formatted JSON
   */
  logJson(label: string, data: any): ConsoleOutput {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      return this.addLog(`[${this.nodeId}] ${label}:\n${jsonString}`, 'completed', 'info');
    } catch (error) {
      return this.error(`Error logging ${label}: ${error.message}`);
    }
  }
  
  /**
   * Create a node status object for workflow reporting
   */
  createStatus(status: string, message: string): NodeStatus {
    return {
      status,
      message,
      startTime: new Date().toISOString()
    };
  }
  
  /**
   * Update a node status with completion information
   */
  completeStatus(status: NodeStatus): NodeStatus {
    const endTime = new Date().toISOString();
    const startDate = status.startTime ? new Date(status.startTime) : new Date();
    const endDate = new Date(endTime);
    const duration = endDate.getTime() - startDate.getTime();
    
    return {
      ...status,
      endTime,
      duration
    };
  }
}

// Component props
interface NodeConsoleProps {
  nodeId: string;
  outputs: ConsoleOutput[];
  maxHeight?: number;
  minHeight?: number;
  defaultHeight?: number;
  onClear?: () => void;
  className?: string;
  title?: string;
}

// Component
export const NodeConsole: React.FC<NodeConsoleProps> = ({
  nodeId,
  outputs,
  maxHeight = 400,
  minHeight = 100,
  defaultHeight = 200,
  onClear,
  className,
  title
}) => {
  // Filter outputs for this node
  const nodeOutputs = outputs.filter(output => 
    output.nodeId === nodeId || 
    output.contents.some(content => 
      content.type === 'text' && content.value.includes(`[${nodeId}]`)
    )
  );
  
  // Find workflow outputs that include this node's status
  const workflowOutputs = outputs.filter(output => {
    const workflowStatus = extractWorkflowStatus(output);
    return workflowStatus && 
           workflowStatus.result && 
           workflowStatus.result.node_status && 
           workflowStatus.result.node_status[nodeId];
  });
  
  const [height, setHeight] = useState<number>(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);
  const [copiedOutputId, setCopiedOutputId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = (e: MouseEvent) => {
    if (isResizing) {
      // Calculate based on the parent element's position
      const parent = resizeRef.current?.parentElement;
      if (!parent) return;
      
      const parentRect = parent.getBoundingClientRect();
      const newHeight = parentRect.bottom - e.clientY;
      
      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setHeight(newHeight);
      }
    }
  };
  
  const toggleExpanded = () => {
    if (isExpanded) {
      // Collapse
      setHeight(minHeight);
    } else {
      // Expand
      setHeight(defaultHeight);
    }
    setIsExpanded(!isExpanded);
  };
  
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };
  
  const copyOutput = (id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedOutputId(id);
      setTimeout(() => setCopiedOutputId(null), 2000);
    });
  };

  // Handle mouse events for resizing
  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);
  
  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (isExpanded) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [nodeOutputs, isExpanded]);
  
  // Helper component for collapsible sections
  const CollapsibleSection: React.FC<{
    id: string;
    title: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
    icon?: React.ReactNode;
  }> = ({ id, title, children, defaultExpanded = false, icon }) => {
    const sectionId = `section-${id}-${title}`;
    const isExpanded = expandedSections[sectionId] ?? defaultExpanded;
    
    return (
      <Collapsible
        open={isExpanded}
        onOpenChange={() => toggleSection(sectionId)}
        className="border border-gray-800 rounded overflow-hidden mb-2"
      >
        <CollapsibleTrigger className="w-full px-3 py-2 flex items-center bg-gray-900 hover:bg-gray-800 transition-colors">
          {icon && <span className="mr-2">{icon}</span>}
          <span className="text-xs font-semibold text-gray-100">{title}</span>
          <ChevronDownIcon 
            className={cn("ml-auto size-4 text-gray-500 transition-transform", {
              "transform rotate-180": isExpanded
            })}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-2 bg-gray-950">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    );
  };
  
  // If no outputs, show a message
  if (nodeOutputs.length === 0 && workflowOutputs.length === 0) {
    return (
      <div className={cn(
        "border border-gray-800 rounded-md bg-black p-3",
        className
      )}>
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm text-white font-medium">
            {title || `Node: ${nodeId}`}
          </div>
        </div>
        <div className="text-sm text-gray-400 italic">
          No logs available for this node
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className={cn(
        "border border-gray-800 rounded-md overflow-hidden bg-black flex flex-col",
        className
      )}
      style={{ height }}
    >
      <div 
        ref={resizeRef}
        className="h-1 w-full cursor-ns-resize hover:bg-blue-500/30 transition-colors"
        onMouseDown={startResizing}
        role="separator"
      />
      
      <div className="flex justify-between items-center px-3 py-1.5 bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="text-sm text-white font-medium">
          {title || `Node: ${nodeId}`}
        </div>
        <div className="flex items-center gap-2">
          {onClear && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 p-1 text-gray-400 hover:text-white hover:bg-gray-800"
              onClick={onClear}
              title="Clear logs"
            >
              <CrossSmallIcon className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-6 p-1 text-gray-400 hover:text-white hover:bg-gray-800"
            onClick={toggleExpanded}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDownIcon className="size-4" /> : <ChevronUpIcon className="size-4" />}
          </Button>
        </div>
      </div>
      
      <div className="overflow-y-auto p-2 space-y-2 flex-1 scrollbar-custom">
        {/* Workflow Status for this Node */}
        {workflowOutputs.length > 0 && (
          <CollapsibleSection
            id={`${nodeId}-workflow`}
            title="Workflow Executions"
            defaultExpanded={true}
            icon={<Info className="size-3.5 text-blue-500" />}
          >
            <div className="space-y-2">
              {workflowOutputs.map(output => {
                const workflowStatus = extractWorkflowStatus(output);
                if (!workflowStatus || !workflowStatus.result || !workflowStatus.result.node_status) {
                  return null;
                }
                
                const nodeStatus = workflowStatus.result.node_status[nodeId];
                if (!nodeStatus) return null;
                
                // Get status styles
                const styles = getStatusStyles(nodeStatus.status);
                
                // Check for node result
                const hasNodeResult = workflowStatus.result.results && workflowStatus.result.results[nodeId];
                
                return (
                  <div 
                    key={output.id}
                    className="border rounded-md overflow-hidden"
                    style={{ 
                      backgroundColor: styles.bg,
                      borderColor: styles.border 
                    }}
                  >
                    <div 
                      className="flex justify-between items-center px-3 py-1.5 border-b"
                      style={{ borderColor: styles.border }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ 
                            backgroundColor: "rgba(0, 0, 0, 0.2)",
                            color: styles.text
                          }}
                        >
                          {nodeStatus.status}
                        </span>
                        {output.timestamp && (
                          <span className="text-gray-400 text-xs">
                            {formatTimestamp(output.timestamp)}
                          </span>
                        )}
                        {nodeStatus.duration && (
                          <span className="text-gray-400 text-xs">
                            {(nodeStatus.duration / 1000).toFixed(2)}s
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-2">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {styles.icon}
                        </div>
                        <div className="text-xs" style={{ color: styles.text }}>
                          {nodeStatus.message}
                        </div>
                      </div>
                      
                      {hasNodeResult && (
                        <CollapsibleSection
                          id={`${output.id}-${nodeId}-result`}
                          title="Execution Result"
                          icon={<Info className="size-3.5 text-gray-400" />}
                        >
                          <div className="relative">
                            <pre className="p-2 text-xs font-mono bg-black/50 rounded border border-gray-800 overflow-x-auto max-h-60 text-gray-300">
                              {formatJson(workflowStatus.result.results[nodeId])}
                            </pre>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 size-6 p-1 text-gray-500 hover:text-white hover:bg-gray-800 rounded-sm"
                              onClick={() => copyOutput(`${output.id}-${nodeId}-result`, formatJson(workflowStatus.result.results[nodeId]))}
                              title="Copy result"
                            >
                              {copiedOutputId === `${output.id}-${nodeId}-result` ? (
                                <CheckIcon className="size-3.5" />
                              ) : (
                                <CopyIcon className="size-3.5" />
                              )}
                            </Button>
                          </div>
                        </CollapsibleSection>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}
        
        {/* Standard Node Logs */}
        {nodeOutputs.length > 0 && (
          <CollapsibleSection
            id={`${nodeId}-logs`}
            title="Node Logs"
            defaultExpanded={true}
            icon={<Clock className="size-3.5 text-gray-400" />}
          >
            <div className="space-y-2">
              {nodeOutputs.map(output => (
                <div
                  key={output.id}
                  className="border border-gray-800 rounded-md overflow-hidden bg-gray-950"
                >
                  <div className="flex justify-between items-center px-3 py-1 bg-gray-900 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn("text-xs px-1.5 py-0.5 rounded", {
                          "bg-blue-900/50 text-blue-400": output.status === 'in_progress',
                          "bg-green-900/50 text-green-400": output.status === 'completed',
                          "bg-red-900/50 text-red-400": output.status === 'failed'
                        })}
                      >
                        {output.status === 'in_progress' ? 'Running' : 
                         output.status === 'completed' ? 'Success' : 'Error'}
                      </span>
                      {output.timestamp && (
                        <span className="text-gray-400 text-xs">
                          {formatTimestamp(output.timestamp)}
                        </span>
                      )}
                      {output.executionTime && (
                        <span className="text-gray-400 text-xs">
                          {(output.executionTime / 1000).toFixed(2)}s
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 p-1 text-gray-500 hover:text-white hover:bg-gray-800"
                      onClick={() => {
                        const content = output.contents
                          .filter(c => c.type === 'text')
                          .map(c => c.value)
                          .join('\n');
                        copyOutput(output.id, content);
                      }}
                      title="Copy output"
                    >
                      {copiedOutputId === output.id ? (
                        <CheckIcon className="size-3.5" />
                      ) : (
                        <CopyIcon className="size-3.5" />
                      )}
                    </Button>
                  </div>
                  
                  <div className="p-2 space-y-1">
                    {output.contents.map((content, contentIndex) => {
                      if (content.type === 'image') {
                        return (
                          <div key={`${output.id}-${contentIndex}`} className="relative group">
                            <img
                              src={content.value}
                              alt="output"
                              className="rounded-md max-w-full border border-gray-800"
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
                      
                      let bgColor = "rgb(5, 5, 5)";
                      let borderColor = "rgb(18, 18, 18)";
                      
                      if (content.type === 'error') {
                        bgColor = "rgba(127, 29, 29, 0.15)";
                        borderColor = "rgba(239, 68, 68, 0.3)";
                      } else if (content.type === 'warning') {
                        bgColor = "rgba(120, 53, 15, 0.15)";
                        borderColor = "rgba(245, 158, 11, 0.3)";
                      } else if (content.type === 'info') {
                        bgColor = "rgba(30, 58, 138, 0.15)";
                        borderColor = "rgba(59, 130, 246, 0.3)";
                      } else if (content.type === 'success') {
                        bgColor = "rgba(6, 78, 59, 0.15)";
                        borderColor = "rgba(16, 185, 129, 0.3)";
                      }
                      
                      return (
                        <div 
                          key={`${output.id}-${contentIndex}`}
                          className="w-full rounded overflow-hidden border"
                          style={{
                            backgroundColor: bgColor,
                            borderColor: borderColor
                          }}
                        >
                          {isJson ? (
                            <CollapsibleSection
                              id={`${output.id}-content-${contentIndex}`}
                              title="JSON Content"
                              icon={<Info className="size-3.5 text-blue-500" />}
                            >
                              <div className="relative">
                                <pre className="p-2 text-xs font-mono overflow-x-auto bg-black/30 text-gray-200">
                                  {formattedContent}
                                </pre>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute top-1 right-1 size-6 p-1 text-gray-500 hover:text-white hover:bg-gray-800 rounded-sm"
                                  onClick={() => copyOutput(`${output.id}-${contentIndex}`, formattedContent)}
                                  title="Copy JSON"
                                >
                                  {copiedOutputId === `${output.id}-${contentIndex}` ? (
                                    <CheckIcon className="size-3.5" />
                                  ) : (
                                    <CopyIcon className="size-3.5" />
                                  )}
                                </Button>
                              </div>
                            </CollapsibleSection>
                          ) : (
                            <pre className="p-2 text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto text-gray-200">
                              {formattedContent}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
        
        <div ref={consoleEndRef} />
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
      `}</style>
    </div>
  );
};

export default NodeConsole;