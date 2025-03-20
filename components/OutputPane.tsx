"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@iconify/react";
import { Loader2, Copy, Check, AlertCircle, CheckCircle, Clock, History } from "lucide-react";
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Simple JSON viewer component
const JsonOut = ({ code, editable = false, onChange = () => {} }) => {
  const [copied, setCopied] = useState(false);
  const { theme, systemTheme } = useTheme();
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative h-full">
      <pre className={`p-4 rounded-md overflow-auto h-full ${isDarkMode ? 'bg-[#1a1a1a] text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
        <code>{code}</code>
      </pre>
      <Button 
        variant="ghost" 
        size="sm" 
        className="absolute top-2 right-2" 
        onClick={copyToClipboard}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </Button>
    </div>
  );
};

interface OutputPaneProps {
  nodeId: string;
  workflowId: string;
  result?: any;
  executionResponse?: any;
  nodeStatus?: string | { status: string; message?: string; timestamp?: string };
}

interface DraggableItem {
  id: string;
  name: string;
  value: any;
  type: string;
  nodeId: string;
}

interface SchemaViewProps {
  schema: any;
  data: any;
  onDragStart: (event: React.DragEvent<HTMLElement>, item: DraggableItem) => void;
  sourceNodeId: string;
}

interface ExecutionResult {
  data: any;
  timestamp: number;
  executionId?: string;
  status?: string;
}

// Function to get status icon based on execution status
const getStatusIcon = (status) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'in_progress':
      return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
    default:
      return null;
  }
};

const getStatusLabel = (status) => {
  if (!status) return null;
  
  // Handle if status is an object
  const statusValue = typeof status === 'object' ? (status.status || 'completed') : status;
  
  let color = 'bg-gray-100 text-gray-800';
  
  switch (statusValue) {
    case 'completed':
      color = 'bg-green-100 text-green-800';
      break;
    case 'failed':
      color = 'bg-red-100 text-red-800';
      break;
    case 'pending':
      color = 'bg-blue-100 text-blue-800';
      break;
    case 'in_progress':
      color = 'bg-amber-100 text-amber-800';
      break;
  }
  
  return (
    <span className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${color}`}>
      {getStatusIcon(statusValue)}
      <span className="capitalize">{statusValue}</span>
    </span>
  );
};

const SchemaView = React.memo(({ schema, data, onDragStart, sourceNodeId }: SchemaViewProps) => {
  const { theme, systemTheme } = useTheme();
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');

  const renderTree = useCallback((key: string | undefined, value: any, dataValue: any, path = '') => {
    const fullPath = path ? `${path}.${key}` : key;
    
    const item = { 
      id: fullPath, 
      name: key, 
      value: dataValue, 
      type: value.type,
      nodeId: sourceNodeId
    };
    
    const getBadgeVariant = (type) => {
      switch (type) {
        case 'object': return 'default';
        case 'array': return 'secondary';
        case 'string': return 'outline';
        case 'number': return 'destructive';
        case 'boolean': return 'default';
        default: return 'secondary';
      }
    };
    
    const titleContent = (
      <div 
        className="flex items-center justify-between w-full cursor-move" 
        draggable 
        onDragStart={(event) => onDragStart(event, item)}
      >
        <div className="flex items-center">
          <Badge variant={getBadgeVariant(value.type)} className="mr-2">
            {`${key}: ${value.type}`}
          </Badge>
          <span className="text-lg text-muted-foreground">⋮⋮</span>
        </div>
        {value.type !== 'object' && value.type !== 'array' && (
          <span className="text-sm text-gray-500 truncate max-w-[50%]">
            {typeof dataValue === 'object' ? JSON.stringify(dataValue || {}) : 
              dataValue !== undefined && dataValue !== null ? String(dataValue) : ''}
          </span>
        )}
      </div>
    );

    if (value.type === 'object' && value.properties) {
      return (
        <div key={fullPath} className="mb-2">
          <Accordion type="single" collapsible defaultValue={fullPath}>
            <AccordionItem value={fullPath}>
              <AccordionTrigger className="px-2 hover:no-underline">
                {titleContent}
              </AccordionTrigger>
              <AccordionContent>
                <div className="ml-4">
                  {Object.entries(value.properties).map(([k, v]) => 
                    renderTree(k, v, dataValue?.[k], fullPath)
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      );
    } else if (value.type === 'array' && value.items) {
      return (
        <div key={fullPath} className="mb-2">
          <Accordion type="single" collapsible defaultValue={fullPath}>
            <AccordionItem value={fullPath}>
              <AccordionTrigger className="px-2 hover:no-underline">
                {titleContent}
              </AccordionTrigger>
              <AccordionContent>
                <div className="ml-4">
                  {Array.isArray(dataValue) && dataValue.length > 0 ? (
                    <div>
                      {dataValue.slice(0, 3).map((item, index) => (
                        <div key={index} className="mb-2 px-2 py-1 border-l-2 border-gray-300">
                          <div className="text-xs font-medium">[{index}]</div>
                          {renderTree('item', value.items, item, `${fullPath}[${index}]`)}
                        </div>
                      ))}
                      {dataValue.length > 3 && (
                        <div className="text-xs text-gray-500 italic">
                          ...and {dataValue.length - 3} more items
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs italic text-gray-500">Empty array</div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      );
    } else {
      return (
        <div key={fullPath} className="mb-2">
          <Accordion type="single" collapsible defaultValue={fullPath}>
            <AccordionItem value={fullPath}>
              <AccordionTrigger className="px-2 hover:no-underline">
                {titleContent}
              </AccordionTrigger>
              <AccordionContent>
                <pre className={`text-xs mt-2 whitespace-pre-wrap break-words p-2 rounded ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                  {typeof dataValue === 'object' ? JSON.stringify(dataValue || {}, null, 2) : 
                    dataValue !== undefined && dataValue !== null ? String(dataValue) : ''}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      );
    }
  }, [onDragStart, sourceNodeId, isDarkMode]);

  // Handle case where schema or data might be missing
  if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">No schema data available</p>
      </div>
    );
  }

  return (
    <div className="font-mono text-sm overflow-y-auto h-full">
      {Object.entries(schema.properties).map(([key, value]) => 
        renderTree(key, value, data[key])
      )}
    </div>
  );
});

const ExecutionHistoryDropdown = ({ results, onSelectExecution, selectedIndex }) => {
  if (!results || results.length <= 1) return null;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <History className="h-4 w-4" />
          <span>Execution {selectedIndex + 1}</span>
          <span className="text-xs text-muted-foreground">
            ({new Date(results[selectedIndex].timestamp).toLocaleTimeString()})
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Execution History</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {results.map((result, index) => (
          <DropdownMenuItem 
            key={index}
            onClick={() => onSelectExecution(index)}
            className={selectedIndex === index ? "bg-muted" : ""}
          >
            <div className="flex items-center gap-2">
              {result.status && getStatusIcon(result.status)}
              <span>Execution {index + 1}</span>
              <span className="text-xs text-muted-foreground">
                ({new Date(result.timestamp).toLocaleTimeString()})
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const columns = [
  { name: "NAME", uid: "name" },
  { name: "VALUE", uid: "value" },
  { name: "TYPE", uid: "type" },
  { name: "SOURCE NODE", uid: "nodeId" },
  { name: "ACTIONS", uid: "actions" },
];

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-full gap-4">
    <div className="flex flex-col items-center gap-6 p-8 rounded-md border border-gray-700 bg-[#09090b]">
      <img 
        src="https://cdn-icons-png.flaticon.com/512/1160/1160358.png"
        alt="Output icon"
        className="w-24 h-24 opacity-50 [filter:invert(40%)_sepia(0%)_saturate(100%)_hue-rotate(190deg)_brightness(90%)_contrast(95%)]"
      />
      <p className="text-base text-gray-500 opacity-30">No Output Data Available</p>  
    </div>
    <p className="text-sm text-gray-500 opacity-40 max-w-md text-center">
      The node hasn't been executed yet or didn't produce any output
    </p>
  </div>
);

// Special component to show error details
const ErrorView = ({ error, status }) => {
  const { theme, systemTheme } = useTheme();
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
  
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-md p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <h3 className="font-medium text-red-700 dark:text-red-400">Execution Failed</h3>
        </div>
        
        <div className="text-sm text-red-800 dark:text-red-300 mb-2">
          {typeof error === 'string' ? error : (error?.message || 'An error occurred during execution')}
        </div>
        
        {status && (
          <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            {typeof status === 'object' ? (
              <>
                <span>Status: {status.status}</span>
                {status.timestamp && (
                  <span>Time: {new Date(status.timestamp).toLocaleTimeString()}</span>
                )}
              </>
            ) : (
              <span>Status: {status}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Special component to show node configuration details
const ConfigurationView = ({ config }) => {
  if (!config) return null;
  
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Node Configuration</h3>
      <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-md p-4">
        <pre className="text-xs overflow-auto max-h-48 text-slate-800 dark:text-slate-300">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>
    </div>
  );
};

const OutputPane: React.FC<OutputPaneProps> = ({ 
  nodeId, 
  workflowId, 
  result, 
  executionResponse,
  nodeStatus 
}) => {
  const { theme, systemTheme } = useTheme();
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
  const [activeTab, setActiveTab] = useState("schema");
  const [outputData, setOutputData] = useState<any>({ loading: true });
  const [draggableItems, setDraggableItems] = useState<DraggableItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const rowsPerPage = 11;
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for execution history
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [selectedExecutionIndex, setSelectedExecutionIndex] = useState(0);

  const generateDraggableItems = useCallback((data: any, sourceNodeId: string, prefix = ''): DraggableItem[] => {
    let items: DraggableItem[] = [];
    
    if (!data || typeof data !== 'object') return items;
    
    try {
      Object.entries(data).forEach(([key, value]) => {
        // Skip internal/metadata properties
        if (key.startsWith('_')) return;
        
        const fullKey = prefix ? `${prefix}.${key}` : key;
        items.push({
          id: fullKey,
          name: key,
          value: value,
          type: Array.isArray(value) ? 'array' : typeof value,
          nodeId: sourceNodeId
        });
        
        if (typeof value === 'object' && value !== null) {
          items = items.concat(generateDraggableItems(value, sourceNodeId, fullKey));
        }
      });
    } catch (e) {
      console.error('Error generating draggable items:', e);
    }
    
    return items;
  }, []);

  const generateSchemaFromData = useCallback((data: any): any => {
    if (!data || typeof data !== 'object') {
      return { type: 'unknown', properties: {} };
    }
    
    try {
      if (Array.isArray(data)) {
        if (data.length === 0) {
          return { type: 'array', items: { type: 'unknown' } };
        }
        return {
          type: 'array',
          items: generateSchemaFromData(data[0])
        };
      } else if (typeof data === 'object' && data !== null) {
        const properties: any = {};
        Object.entries(data).forEach(([key, value]) => {
          // Skip internal/metadata properties
          if (!key.startsWith('_')) {
            properties[key] = generateSchemaFromData(value);
          }
        });
        return {
          type: 'object',
          properties: properties
        };
      } else {
        return {
          type: typeof data
        };
      }
    } catch (e) {
      console.error('Error generating schema:', e);
      return { type: 'unknown', properties: {} };
    }
  }, []);

  // Try to find execution data from global flow data if not provided in props
  const findExecutionDataFromGlobal = useCallback(() => {
    if (typeof window === 'undefined' || !window._flowNodes) return null;
    
    const globalNode = window._flowNodes.find(n => n.id === nodeId);
    if (!globalNode) return null;
    
    console.log("Found node in global data:", nodeId);
    
    // Check for execution data in different possible locations
    if (globalNode.data?.executionResult?.results?.[nodeId]) {
      console.log("Found result in global executionResult");
      return globalNode.data.executionResult.results[nodeId];
    }
    
    if (globalNode.data?.result) {
      console.log("Found direct result in global node data");
      return globalNode.data.result;
    }
    
    // Check for status that might indicate an error
    if (globalNode.data?.status?.status === 'failed') {
      console.log("Found failed status in global node data");
      return {
        error: globalNode.data.status.message || "Execution failed",
        status: globalNode.data.status,
        timestamp: globalNode.data.status.timestamp || Date.now()
      };
    }
    
    return null;
  }, [nodeId]);

  // Process the node result data with improved error handling
  useEffect(() => {
    console.group("OutputPane Debug");
    console.log("Node ID:", nodeId);
    console.log("Full props dump:", {
      result: result ? typeof result : 'null',
      resultValue: result,
      executionResponse: executionResponse ? typeof executionResponse : 'null',
      executionResponseValue: executionResponse,
      nodeData: result
    });
    
    if (result && typeof result === 'object') {
      console.log("Result keys:", Object.keys(result));
      
      // Check for specific properties that indicate error state
      if (result.status?.status === 'failed' || result.execution_status?.status === 'failed') {
        console.log("Found failed status in result");
        setError(result.status?.message || result.execution_status?.message || "Execution failed");
      }
      
      // Check for direct error property
      if (result.error) {
        console.log("Found direct error property");
        setError(typeof result.error === 'string' ? result.error : (result.error.message || JSON.stringify(result.error)));
      }
    }
    console.groupEnd();
    
    // IMPROVED RESULT DETECTION - check all possible sources thoroughly
    let actualResultData = null;
    let resultSource = 'none';
    
    // First check if result is an execution status wrapper with configuration
    if (result && typeof result === 'object' && 
        (result.execution_status || result.status) && 
        result.configuration) {
      console.log("Using execution status wrapper with configuration");
      actualResultData = result;
      resultSource = 'status-wrapper';
      
      // Set error if this is a failed execution
      const status = result.execution_status?.status || result.status?.status;
      if (status === 'failed') {
        setError(result.execution_status?.message || result.status?.message || result.error || "Execution failed");
      }
    }
    // Check regular result property
    else if (result && typeof result === 'object') {
      if (result.result !== null && result.result !== undefined) {
        console.log("Using result.result property");
        actualResultData = result.result;
        resultSource = 'result-property';
      } else {
        console.log("Using direct result object");
        actualResultData = result;
        resultSource = 'direct-result';
      }
    }
    // Then check execution response
    else if (executionResponse && typeof executionResponse === 'object') {
      actualResultData = executionResponse;
      resultSource = 'executionResponse';
    }
    // Last resort - try to find data from global flow data
    else {
      const globalData = findExecutionDataFromGlobal();
      if (globalData) {
        actualResultData = globalData;
        resultSource = 'global-data';
      }
    }
    
    console.log(`Using result data from: ${resultSource}`);
    
    if (!actualResultData) {
      setHasData(false);
      setOutputData({ message: "No output data available" });
      setExecutionResults([]);
      return;
    }
    
    try {
      // Collect all execution results with timestamps
      const allResults: ExecutionResult[] = [];
      
      // Add current result with current timestamp
      allResults.push({
        data: actualResultData,
        timestamp: Date.now(),
        status: nodeStatus ? (typeof nodeStatus === 'object' ? nodeStatus.status : nodeStatus) : 
                (actualResultData.status?.status || actualResultData.execution_status?.status || 'completed')
      });
      
      // Check for historical execution results if available
      const executionHistory = actualResultData._executionHistory || [];
      
      executionHistory.forEach(histEntry => {
        if (histEntry.result) {
          allResults.push({
            data: histEntry.result,
            timestamp: histEntry.timestamp || Date.now() - 1000,
            executionId: histEntry.executionId,
            status: histEntry.status
          });
        }
      });
      
      // Sort by timestamp descending (newest first)
      if (allResults.length > 0) {
        allResults.sort((a, b) => b.timestamp - a.timestamp);
        
        // Update the execution results
        setExecutionResults(allResults);
        
        // Use selected result based on index (defaulting to latest)
        const resultToUse = allResults[selectedExecutionIndex] || allResults[0];
        setHasData(true);
        
        // Handle special data formats - focus on most important parts first
        const dataToUse = resultToUse.data;
        
        if (dataToUse.choices?.[0]?.message?.content) {
          // For OpenAI/Claude API type responses, highlight the content
          const content = dataToUse.choices[0].message.content;
          setOutputData({
            content: content,
            raw: dataToUse
          });
        } else if (dataToUse.body) {
          // For API responses, highlight the body
          setOutputData({
            body: dataToUse.body,
            raw: dataToUse
          });
        } else if (dataToUse.configuration) {
          // For execution status wrappers, include both status and configuration
          setOutputData({
            execution_status: dataToUse.execution_status || dataToUse.status,
            message: dataToUse.message,
            error: dataToUse.error,
            configuration: dataToUse.configuration,
            timestamp: dataToUse.timestamp
          });
        } else {
          // Use the data as is
          setOutputData(dataToUse);
        }
        
        // Generate draggable items from the data
        const items = generateDraggableItems(dataToUse, nodeId);
        setDraggableItems(items);
      } else {
        setHasData(false);
        setOutputData({ message: "No result data available" });
        setDraggableItems([]);
      }
    } catch (error) {
      console.error('OutputPane: Error processing data:', error);
      setOutputData({ error: error.message });
      setDraggableItems([]);
      setExecutionResults([]);
    }
  }, [nodeId, result, executionResponse, nodeStatus, selectedExecutionIndex, generateDraggableItems, findExecutionDataFromGlobal]);

  const outputSchema = useMemo(() => generateSchemaFromData(outputData), [outputData, generateSchemaFromData]);

  const handleDragStart = useCallback((event: React.DragEvent<HTMLElement>, item: DraggableItem) => {
    event.stopPropagation();
    console.log('Drag start from Output:', item);
    event.dataTransfer.setData('text/plain', JSON.stringify(item));
  }, []);

  const formatValue = useCallback((value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    if (typeof value === 'object') {
      try {
        if (!value) return '{}';
        if (Object.keys(value).length > 3) {
          return JSON.stringify({
            ...Object.fromEntries(
              Object.entries(value).slice(0, 3)
            ),
            '...': '...'
          });
        }
        return JSON.stringify(value);
      } catch (e) {
        return '[Complex Object]';
      }
    }
    
    return String(value);
  }, []);

  const renderCell = useCallback((item: DraggableItem, columnKey: React.Key) => {
    const cellValue = item[columnKey as keyof DraggableItem];
    switch (columnKey) {
      case "name":
        return (
          <div className="flex flex-col">
            <p className="text-sm font-medium">{cellValue as string}</p>
            <p className="text-xs text-muted-foreground">{item.id}</p>
          </div>
        );
      case "value":
        return (
          <div className="max-w-[300px] overflow-hidden">
            <p className="text-sm break-all truncate">
              {formatValue(cellValue)}
            </p>
          </div>
        );
      case "type":
        return (
          <Badge variant="outline" className="capitalize">
            {cellValue as string}
          </Badge>
        );
      case "nodeId":
        return (
          <Badge variant="secondary" className="capitalize">
            {cellValue as string}
          </Badge>
        );
      case "actions":
        return (
          <div className="relative flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span 
                    className="text-lg text-muted-foreground cursor-move px-2"
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                  >
                    ⋮⋮
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Drag</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      default:
        return cellValue;
    }
  }, [formatValue, handleDragStart]);

  const pages = Math.ceil(draggableItems.length / rowsPerPage);

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return draggableItems.slice(start, end);
  }, [page, draggableItems]);

  const renderContent = useCallback(() => (
    <>
      {/* If there's an error, show it first */}
      {error && (
        <ErrorView 
          error={error} 
          status={nodeStatus || 
                  (result?.status) || 
                  (result?.execution_status)}
        />
      )}
      
      {/* Show configuration if available in a status wrapper */}
      {outputData?.configuration && (
        <ConfigurationView config={outputData.configuration} />
      )}
      
      {/* Regular content display */}
      {activeTab === "schema" && (
        <SchemaView 
          schema={outputSchema} 
          data={outputData} 
          onDragStart={handleDragStart}
          sourceNodeId={nodeId}
        />
      )}
      {activeTab === "json" && (
        <JsonOut 
        code={JSON.stringify(outputData, null, 2)} 
        editable={false} 
      />
    )}
    {activeTab === "table" && (
      <div className="flex flex-col h-full">
        <div className="overflow-y-auto flex-1">
          <Table>
            <TableHeader>
              {columns.map((column) => (
                <TableHead key={column.uid} className={column.uid === "actions" ? "text-center" : "text-left"}>
                  {column.name}
                </TableHead>
              ))}
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} draggable onDragStart={(event) => handleDragStart(event, item)}>
                  {columns.map((column) => (
                    <TableCell key={column.uid}>{renderCell(item, column.uid)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {pages > 1 && (
          <div className="flex w-full justify-center py-4 border-t">
            <Pagination>
              <PaginationContent>
                <PaginationPrevious 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                />
                {Array.from({ length: Math.min(5, pages) }).map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        isActive={pageNum === page}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationNext 
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                />
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    )}
  </>
), [activeTab, outputSchema, outputData, handleDragStart, items, page, pages, renderCell, nodeId, error, nodeStatus, result]);

return (
  <div style={{ transform: 'scale(0.75)', transformOrigin: 'top left', width: '133.33%', height: '133.33%' }}>
    <Card className="flex flex-col h-full bg-gray-100 dark:bg-[#09090b]">
      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          <CardHeader className="flex flex-row justify-between items-center p-6">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Button variant="outline" className="font-bold">
                  Node Output
                </Button>
                
                {/* Node Status Badge */}
                {nodeStatus && getStatusLabel(nodeStatus)}
                
                {/* Execution History Dropdown */}
                {executionResults.length > 1 && (
                  <ExecutionHistoryDropdown
                    results={executionResults}
                    onSelectExecution={setSelectedExecutionIndex}
                    selectedIndex={selectedExecutionIndex}
                  />
                )}
              </div>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                <TabsList>
                  <TabsTrigger value="schema">Schema</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                  <TabsTrigger value="table">Table</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>

          <CardContent className="overflow-hidden flex-1 flex flex-col">
            <div className="h-full overflow-auto">
              {outputData.loading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                renderContent()
              )}
            </div>
          </CardContent>
        </>
      )}

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center w-full">
              <div className="flex items-center gap-3">
                <span>Output Data (Expanded View)</span>
                {nodeStatus && getStatusLabel(nodeStatus)}
                {executionResults.length > 1 && (
                  <ExecutionHistoryDropdown
                    results={executionResults}
                    onSelectExecution={setSelectedExecutionIndex}
                    selectedIndex={selectedExecutionIndex}
                  />
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)}>
                <Icon icon="mdi:close" />
              </Button>
            </DialogTitle>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
              <TabsList>
                <TabsTrigger value="schema">Schema</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
                <TabsTrigger value="table">Table</TabsTrigger>
              </TabsList>
            </Tabs>
          </DialogHeader>
          <div className="py-4">
            {renderContent()}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  </div>
);
};

export default React.memo(OutputPane);