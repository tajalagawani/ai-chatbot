"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import JsonOut from './JsonOut';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@iconify/react";
import { Loader2, AlertCircle, CheckCircle, Clock, ChevronDown, Info, X } from "lucide-react";
import { useTheme } from 'next-themes';

/**
 * InputPane Component
 * 
 * Displays and manages input data for workflow nodes, showing connected node data
 * and providing schema visualization, JSON view, and tabular representation.
 */

interface InputPaneProps {
  nodeId: string;
  workflowId: string;
  connectedInputNodes: any[];
  // Metadata props
  metadata?: any;
  fullMetadata?: any;
  mergedMetadata?: any;
  nodeData?: any;
  nodeStatus?: any;
  workflowStatus?: string | null;
  containerId?: string | null;
  dockerStatus?: string | null;
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

/**
 * SchemaView Component
 * 
 * Renders a tree-like visualization of data schema
 */
const SchemaView = React.memo(({ schema, data, onDragStart, sourceNodeId }: SchemaViewProps) => {
  const getBadgeVariant = useCallback((type) => {
    switch (type) {
      case 'object': return 'default';
      case 'array': return 'secondary';
      case 'string': return 'outline';
      case 'number': return 'destructive';
      case 'boolean': return 'default';
      default: return 'secondary';
    }
  }, []);
  
  const renderTree = useCallback((key: string | undefined, value: { type: string; properties: { [s: string]: unknown; } | ArrayLike<unknown>; items: any; }, dataValue: any[], path = '') => {
    const fullPath = path ? `${path}.${key}` : key;
    const item = { 
      id: fullPath, 
      name: key, 
      value: dataValue, 
      type: value.type,
      nodeId: sourceNodeId
    };
    
    const titleContent = (
      <div 
        className="flex items-center justify-between w-full cursor-move px-2" 
        draggable 
        onDragStart={(event) => onDragStart(event, item)}
      >
        <div className="flex items-center gap-2">
          <Badge variant={getBadgeVariant(value.type)} className="mr-2">
            {`${key}: ${value.type}`}
          </Badge>
          <Icon icon="mdi:drag" className="text-gray-500" />
        </div>
        {value.type !== 'object' && value.type !== 'array' && (
          <span className="text-sm text-gray-500 truncate max-w-[50%]">
            {JSON.stringify(dataValue)}
          </span>
        )}
      </div>
    );

    if (value.type === 'object' && value.properties) {
      return (
        <div key={fullPath} className="mb-2 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
          <Accordion type="single" collapsible defaultValue={fullPath}>
            <AccordionItem value={fullPath} className="border-b-0">
              <AccordionTrigger className="px-2 hover:no-underline py-1">
                {titleContent}
              </AccordionTrigger>
              <AccordionContent className="pt-1">
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
        <div key={fullPath} className="mb-2 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
          <Accordion type="single" collapsible defaultValue={fullPath}>
            <AccordionItem value={fullPath} className="border-b-0">
              <AccordionTrigger className="px-2 hover:no-underline py-1">
                {titleContent}
              </AccordionTrigger>
              <AccordionContent className="pt-1">
                <div className="ml-4">
                  {renderTree('items', value.items, dataValue?.[0], fullPath)}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      );
    } else {
      return (
        <div key={fullPath} className="mb-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
          {titleContent}
        </div>
      );
    }
  }, [getBadgeVariant, onDragStart, sourceNodeId]);

  return (
    <div className="font-mono text-sm">
      {schema && schema.properties ? (
        <div className="space-y-1">
          {Object.entries(schema.properties).map(([key, value]) => 
            renderTree(key, value, data[key])
          )}
        </div>
      ) : (
        <div className="p-4 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-md">
          No schema available for this data
        </div>
      )}
    </div>
  );
});

// Table columns definition
const columns = [
  { name: "NAME", uid: "name" },
  { name: "VALUE", uid: "value" },
  { name: "TYPE", uid: "type" },
  { name: "SOURCE NODE", uid: "nodeId" },
  { name: "ACTIONS", uid: "actions" },
];

/**
 * EmptyState Component
 * 
 * Displays when no input nodes are connected
 */
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
    <div className="flex flex-col items-center gap-6 p-8 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <img 
        src="https://cdn4.iconfinder.com/data/icons/plug-electric-cs/512/energy_adapter_element_cable-06-512.png"
        alt="Wire icon"
        className="w-20 h-20 opacity-50 [filter:invert(40%)_sepia(0%)_saturate(100%)_hue-rotate(190deg)_brightness(90%)_contrast(95%)]"
      />
      <p className="text-base text-gray-500 opacity-70 font-medium">Connect a Node</p>  
    </div>
    <p className="text-sm text-gray-500 opacity-60 max-w-md text-center">
      Connect a node to access its output data and enable data flow between nodes
    </p>
  </div>
);


/**
 * InputPane Component
 * 
 * Main component for visualizing and interacting with node input data
 */
const InputPane: React.FC<InputPaneProps> = ({ 
  nodeId, 
  workflowId, 
  connectedInputNodes,
  metadata,
  fullMetadata,
  mergedMetadata,
  nodeData,
  nodeStatus,
  workflowStatus,
  containerId,
  dockerStatus
}) => {
  const { theme, systemTheme } = useTheme();
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
  const [inputNodes, setInputNodes] = useState<any>([]);
  const [activeNode, setActiveNode] = useState<any | null>(null);
  const [inputData, setInputData] = useState<any>({ loading: true });
  const [activeTab, setActiveTab] = useState("schema");
  const [draggableItems, setDraggableItems] = useState<DraggableItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const [sourceNodeId, setSourceNodeId] = useState<string | null>(null);
  const [metadataNodeStatus, setMetadataNodeStatus] = useState<any>({});
  const [executionResults, setExecutionResults] = useState<any>({});
  const [debugMode, setDebugMode] = useState<boolean>(false);

  // Effect for handling synthetic nodes
  useEffect(() => {
    if ((!Array.isArray(connectedInputNodes) || connectedInputNodes.length === 0) && 
        mergedMetadata) {
      const resultsData = mergedMetadata.executionResult?.result?.results || {};
      const nodeStatusData = mergedMetadata.executionResult?.result?.node_status || {};
      
      // For todos_request, create nodes for its dependencies
      if (nodeId === 'todos_request' && resultsData['public_api_request']) {
        const syntheticNodes = [{
          id: 'public_api_request',
          type: 'API-Request',
          data: {
            type: 'API-Request',
            label: 'Public API Request',
            executionResponse: resultsData['public_api_request']
          }
        }];
        
        setInputNodes(syntheticNodes);
        setActiveNode(syntheticNodes[0]);
        
        // Set the input data
        const nodeData = resultsData['public_api_request'];
        if (nodeData) {
          if (nodeData.body) {
            setInputData(nodeData.body);
          } else {
            setInputData(nodeData);
          }
          setSourceNodeId('public_api_request');
          const items = generateDraggableItems(nodeData.body || nodeData, 'public_api_request');
          setDraggableItems(items);
        }
      }
      
      // For openai_analysis, the dependency is todos_request
      if (nodeId === 'openai_analysis' && resultsData['todos_request']) {
        const syntheticNodes = [{
          id: 'todos_request',
          type: 'API-Request',
          data: {
            type: 'API-Request',
            label: 'Todos Request',
            executionResponse: resultsData['todos_request']
          }
        }];
        
        setInputNodes(syntheticNodes);
        setActiveNode(syntheticNodes[0]);
        
        // Set the input data
        const nodeData = resultsData['todos_request'];
        if (nodeData) {
          if (nodeData.body) {
            setInputData(nodeData.body);
          } else {
            setInputData(nodeData);
          }
          setSourceNodeId('todos_request');
          const items = generateDraggableItems(nodeData.body || nodeData, 'todos_request');
          setDraggableItems(items);
        }
      }
    }
  }, [connectedInputNodes, mergedMetadata, nodeId]);

  /**
   * Get node data from metadata
   */
  const getNodeDataFromMetadata = useCallback((nodeId: string) => {
    // Try to get node data from executionResults
    if (mergedMetadata?.executionResult?.result?.results && 
        mergedMetadata.executionResult.result.results[nodeId]) {
      return mergedMetadata.executionResult.result.results[nodeId];
    }
    
    // Try another location pattern in metadata
    if (mergedMetadata?.results && mergedMetadata.results[nodeId]) {
      return mergedMetadata.results[nodeId];
    }
    
    return null;
  }, [mergedMetadata]);

  /**
   * Generate draggable items from data
   */
  const generateDraggableItems = useCallback((data: any, sourceNodeId: string, prefix = ''): DraggableItem[] => {
    let items: DraggableItem[] = [];
    if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
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
    }
    return items;
  }, []);

  // Extract node statuses from metadata
  useEffect(() => {
    if (mergedMetadata?.nodeStatus) {
      setMetadataNodeStatus(mergedMetadata.nodeStatus);
    } else if (mergedMetadata?.executionResult?.result?.node_status) {
      setMetadataNodeStatus(mergedMetadata.executionResult.result.node_status);
    }

    // Extract execution results
    if (mergedMetadata?.executionResult?.result?.results) {
      setExecutionResults(mergedMetadata.executionResult.result.results);
    } else if (mergedMetadata?.results) {
      setExecutionResults(mergedMetadata.results);
    }
  }, [mergedMetadata]);

  // Main effect for loading input data
  useEffect(() => {
    const loadIncomingNodes = (nodes, edges, currentNodeId) => {
      const incomingNodeSet = new Set();
      const queue = [currentNodeId];
      const visited = new Set();

      while (queue.length > 0) {
        const nodeId = queue.shift();
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        // Find all edges that target this node
        const incomingEdges = edges.filter(edge => edge.target === nodeId);

        for (const edge of incomingEdges) {
          const sourceNode = nodes.find(node => node.id === edge.source);
          if (sourceNode) {
            incomingNodeSet.add(sourceNode);
            queue.push(sourceNode.id);
          }
        }
      }

      // Convert Set to Array and update state
      const incomingNodes = Array.from(incomingNodeSet);
      setInputNodes(incomingNodes);
      return incomingNodes;
    };

    // Reset loading state
    setInputData({ loading: true });

    // First priority: Process connected input nodes directly
    if (connectedInputNodes && connectedInputNodes.length > 0) {
      // Use the connected input nodes directly
      setInputNodes(connectedInputNodes);
      
      // Use the first node as active by default if no active node is selected
      if (!activeNode && connectedInputNodes.length > 0) {
        const firstNode = connectedInputNodes[0];
        setActiveNode(firstNode);
        
        // Attempt to get data from multiple sources
        const nodeExecResponse = firstNode.data?.executionResponse;
        const nodeResultFromMetadata = getNodeDataFromMetadata(firstNode.id);
        const nodeStatusFromMetadata = metadataNodeStatus[firstNode.id];
        
        // Determine which data to use, with priority order
        let nodeData = null;
        let dataSource = '';
        
        if (nodeExecResponse) {
          nodeData = nodeExecResponse;
          dataSource = 'node.data.executionResponse';
        } else if (nodeResultFromMetadata) {
          // If we have result data from metadata, use that
          if (nodeResultFromMetadata.body) {
            // For API requests, use the body
            nodeData = nodeResultFromMetadata.body;
            dataSource = 'metadata.results[nodeId].body';
          } else if (nodeResultFromMetadata.result) {
            // For AI nodes, might have result field
            nodeData = nodeResultFromMetadata.result;
            dataSource = 'metadata.results[nodeId].result';
          } else {
            // Otherwise use the whole result object
            nodeData = nodeResultFromMetadata;
            dataSource = 'metadata.results[nodeId]';
          }
        }
        
        if (nodeData) {
          setSourceNodeId(firstNode.id);
          setInputData(nodeData);
          const items = generateDraggableItems(nodeData, firstNode.id);
          setDraggableItems(items);
        } else if (nodeStatusFromMetadata) {
          // No data, but we have status
          setInputData({
            info: `Node status: ${nodeStatusFromMetadata.status}`,
            status: nodeStatusFromMetadata.status,
            message: nodeStatusFromMetadata.message || 'No execution data available',
            timestamp: nodeStatusFromMetadata.timestamp
          });
        } else {
          setInputData({ info: "No execution data available for this node" });
        }
      }
      
      return; // Skip the fallback workflow fetch
    }

    // Second priority: Fallback to fetching workflow data if needed
    const fetchData = async () => {
      try {
        const workflow = await getWorkflow(workflowId);
        
        const currentNode = workflow.nodes.find((node) => node.id === nodeId);
        if (currentNode) {
          // Load incoming nodes for this node
          const incomingNodes = loadIncomingNodes(workflow.nodes, workflow.edges, nodeId);
          
          if (incomingNodes.length > 0) {
            // Find the first incoming edge
            const incomingEdge = workflow.edges.find((edge) => edge.target === nodeId);
            
            if (incomingEdge) {
              const sourceNode = workflow.nodes.find((node) => node.id === incomingEdge.source);
              setActiveNode(sourceNode);
              
              // Try to get data from node or metadata
              if (sourceNode.data?.executionResponse) {
                setInputData(sourceNode.data.executionResponse);
                setSourceNodeId(sourceNode.id);
                const items = generateDraggableItems(sourceNode.data.executionResponse, sourceNode.id);
                setDraggableItems(items);
              } else {
                // Try to get data from metadata
                const nodeResultFromMetadata = getNodeDataFromMetadata(sourceNode.id);
                const nodeStatusFromMetadata = metadataNodeStatus[sourceNode.id];
                
                if (nodeResultFromMetadata) {
                  const dataToUse = nodeResultFromMetadata.body || nodeResultFromMetadata;
                  setInputData(dataToUse);
                  setSourceNodeId(sourceNode.id);
                  const items = generateDraggableItems(dataToUse, sourceNode.id);
                  setDraggableItems(items);
                } else if (nodeStatusFromMetadata) {
                  setInputData({
                    info: `Node status: ${nodeStatusFromMetadata.status}`,
                    status: nodeStatusFromMetadata.status,
                    message: nodeStatusFromMetadata.message || 'No execution data available',
                    timestamp: nodeStatusFromMetadata.timestamp
                  });
                } else {
                  setInputData({ error: "No input data available" });
                }
              }
            } else {
              setInputData({ info: "This node has no incoming connections" });
            }
          } else {
            setInputData({ info: "This node has no input data" });
          }
        } else {
          setInputData({ error: "Current node not found in workflow" });
        }
      } catch (error) {
        setInputData({ error: error.message || "Error fetching workflow data" });
      }
    };

    // Only fetch if we have no input nodes and a valid workflow ID
    if ((!inputNodes || inputNodes.length === 0) && workflowId) {
      fetchData();
    } else if (!workflowId) {
      setInputData({ error: "No workflow ID provided" });
    } else if (inputNodes && inputNodes.length === 0) {
      setInputData({ info: "No input connections available" });
    }
  }, [
    nodeId, 
    workflowId, 
    connectedInputNodes, 
    generateDraggableItems, 
    activeNode, 
    getNodeDataFromMetadata, 
    metadataNodeStatus,
    inputNodes
  ]);

  // Handle activeNode changes
  useEffect(() => {
    if (activeNode && activeNode.id) {
      // Reset previous data state
      setInputData({ loading: true });
      
      // Try to get data from node's own execution response
      const nodeExecResponse = activeNode.data?.executionResponse;
      
      // If we have any execution response with body, use that
      if (nodeExecResponse && nodeExecResponse.body) {
        setSourceNodeId(activeNode.id);
        setInputData(nodeExecResponse.body);
        const items = generateDraggableItems(nodeExecResponse.body, activeNode.id);
        setDraggableItems(items);
      } 
      // If we have a general execution response, use that
      else if (nodeExecResponse && typeof nodeExecResponse === 'object' && 
               !nodeExecResponse.error && !nodeExecResponse.status) {
        setSourceNodeId(activeNode.id);
        setInputData(nodeExecResponse);
        const items = generateDraggableItems(nodeExecResponse, activeNode.id);
        setDraggableItems(items);
      }
      // For pending nodes, show a proper message instead of just "No execution data"
      else if (activeNode.data?.status?.status === 'pending') {
        setInputData({ 
          info: "Node pending execution", 
          status: "pending",
          message: activeNode.data.status.message || "Waiting for execution",
          timestamp: activeNode.data.status.timestamp
        });
      }
      // For failed nodes, show the error message
      else if (activeNode.data?.status?.status === 'failed') {
        setInputData({ 
          error: "Execution failed", 
          status: "failed",
          message: activeNode.data.status.message || "Execution failed",
          timestamp: activeNode.data.status.timestamp
        });
      }
      // Default case - no data
      else {
        setInputData({ info: "No execution data available for this node" });
      }
    }
  }, [activeNode, generateDraggableItems]);

  /**
   * Generate schema from data
   */
  const generateSchemaFromData = useCallback((data: any): any => {
    // Handle null/undefined
    if (data === null || data === undefined) {
      return { type: 'null' };
    }
    
    if (Array.isArray(data)) {
      return {
        type: 'array',
        items: data.length > 0 ? generateSchemaFromData(data[0]) : { type: 'any' }
      };
    } else if (typeof data === 'object' && data !== null) {
      const properties: any = {};
      Object.entries(data).forEach(([key, value]) => {
        properties[key] = generateSchemaFromData(value);
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
  }, []);

  const inputSchema = useMemo(() => generateSchemaFromData(inputData), [inputData, generateSchemaFromData]);

  /**
   * Handle drag start event
   */
  const handleDragStart = useCallback((event: React.DragEvent<HTMLElement>, item: DraggableItem) => {
    event.stopPropagation();
    event.dataTransfer.setData('text/plain', JSON.stringify(item));
  }, []);

  /**
   * Render table cell
   */
  const renderCell = useCallback((item: { [x: string]: any; id: string | number | bigint | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | React.ReactFragment | React.ReactPortal | null | undefined; }, columnKey: React.Key) => {
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
          <div className="flex flex-col">
            <p className="text-sm font-medium truncate max-w-[200px]">
              {typeof cellValue === 'object' 
                ? JSON.stringify(cellValue).substring(0, 50) + (JSON.stringify(cellValue).length > 50 ? '...' : '')
                : String(cellValue)}
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
          <div className="relative flex items-center gap-2 justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-lg text-muted-foreground cursor-move">
                    <Icon icon="mdi:drag" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Drag item</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      default:
        return cellValue;
    }
  }, []);

  const pages = Math.ceil(draggableItems.length / rowsPerPage);

  /**
   * Calculate paginated items
   */
  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return draggableItems.slice(start, end);
  }, [page, draggableItems, rowsPerPage]);

  /**
   * Render node icon
   */
  const renderNodeIcon = (nodeType: string) => {
    if (!nodeType) return <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full"></div>;
    
    // Clean up node type for icon
    const nodeTypeStr = nodeType?.toLowerCase() || 'default';
    let iconName = 'mdi:cube-outline';
    
    // Map common node types to icons
    if (nodeTypeStr.includes('ai') || nodeTypeStr.includes('llm')) iconName = 'mdi:robot-outline';
    else if (nodeTypeStr.includes('api')) iconName = 'mdi:api';
    else if (nodeTypeStr.includes('openai')) iconName = 'simple-icons:openai';
    else if (nodeTypeStr.includes('claude')) iconName = 'mdi:chat-processing-outline';
    else if (nodeTypeStr.includes('request')) iconName = 'mdi:web';
    else if (nodeTypeStr.includes('database')) iconName = 'mdi:database-outline';
    else if (nodeTypeStr.includes('transform')) iconName = 'mdi:transfer';
    
    return <Icon icon={iconName} className="w-5 h-5" />;
  };

  /**
   * Get node status from metadata
   */
  const getNodeStatus = useCallback((nodeId: string) => {
    if (metadataNodeStatus && metadataNodeStatus[nodeId]) {
      return metadataNodeStatus[nodeId];
    }
    return null;
  }, [metadataNodeStatus]);

  /**
   * Get status icon based on node status
   */
  const getStatusIcon = useCallback((nodeId: string) => {
    const status = getNodeStatus(nodeId)?.status;
    
    if (!status) return null;
    
    switch(status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  }, [getNodeStatus]);

  /**
   * Render content based on active tab
   */
  const renderContent = useCallback(() => {
    // Show loading state
    if (inputData.loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    
    // Show error/info messages
    if (inputData.error || inputData.info) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-2">
          {inputData.error ? (
            <AlertCircle className="h-12 w-12 text-red-500 mb-2" />
          ) : (
            <Info className="h-12 w-12 text-blue-500 mb-2" />
          )}
          <p className="text-lg font-medium text-center">
            {inputData.error || inputData.info}
          </p>
          {inputData.message && (
            <p className="text-sm text-center text-gray-500 max-w-md">
              {inputData.message}
            </p>
          )}
        </div>
      );
    }
    
    // Show metadata about node status if available
    if (activeNode && metadataNodeStatus && metadataNodeStatus[activeNode.id]) {
      const nodeStatus = metadataNodeStatus[activeNode.id];
      
      // For nodes that are pending or failed but don't have execution data
      if ((nodeStatus.status === 'pending' || nodeStatus.status === 'failed') && 
          !inputData.body && !Array.isArray(inputData) && Object.keys(inputData).length < 3) {
        return (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            {nodeStatus.status === 'failed' ? (
              <AlertCircle className="h-12 w-12 text-red-500 mb-2" />
            ) : nodeStatus.status === 'pending' ? (
              <Clock className="h-12 w-12 text-blue-500 mb-2" />
            ) : (
              <Info className="h-12 w-12 text-blue-500 mb-2" />
            )}
            <Badge 
              variant={nodeStatus.status === 'completed' ? 'default' : 
                     nodeStatus.status === 'failed' ? 'destructive' : 'secondary'}
              className="mb-2"
            >
              {nodeStatus.status}
            </Badge>
            <p className="text-lg font-medium text-center">
              {nodeStatus.message || `Node is ${nodeStatus.status}`}
            </p>
            {nodeStatus.timestamp && (
              <p className="text-xs text-center text-gray-500">
                {new Date(nodeStatus.timestamp).toLocaleString()}
              </p>
            )}
          </div>
        );
      }
    }
    
    // Render the content based on active tab
    switch (activeTab) {
      case "schema":
        return (
          <SchemaView 
            schema={inputSchema} 
            data={inputData} 
            onDragStart={handleDragStart}
            sourceNodeId={sourceNodeId}
          />
        );
      case "json":
        return (
          <JsonOut 
            code={JSON.stringify(inputData, null, 2)} 
            editable={false} 
            onChange={() => {}}
          />
        );
      case "table":
        return (
          <>
            <Table>
              <TableHeader>
                {columns.map((column) => (
                  <TableHead key={column.uid} className={column.uid === "actions" ? "text-right" : ""}>
                    {column.name}
                  </TableHead>
                ))}
              </TableHeader>
              <TableBody>
                {items.length > 0 ? (
                  items.map((item) => (
                    <TableRow key={item.id} draggable onDragStart={(event) => handleDragStart(event, item)} className="cursor-move hover:bg-gray-200 dark:hover:bg-gray-800">
                      {columns.map((column) => (
                        <TableCell key={column.uid}>{renderCell(item, column.uid)}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center py-6 text-muted-foreground">
                      No data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {pages > 1 && (
              <div className="flex w-full justify-center py-4 mt-4">
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
          </>
        );
      case "metadata":
        // Show node metadata and status
        return (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-2">Node Status</h3>
              {activeNode && metadataNodeStatus && metadataNodeStatus[activeNode.id] ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      metadataNodeStatus[activeNode.id].status === 'completed' ? 'default' :
                      metadataNodeStatus[activeNode.id].status === 'failed' ? 'destructive' :
                      'secondary'
                    }>
                      {metadataNodeStatus[activeNode.id].status}
                    </Badge>
                    {getStatusIcon(activeNode.id)}
                  </div>
                  <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                    <p>{metadataNodeStatus[activeNode.id].message || "No message available"}</p>
                    {metadataNodeStatus[activeNode.id].timestamp && (
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(metadataNodeStatus[activeNode.id].timestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No status information available for this node</p>
              )}
            </div>
            
            {/* Show execution results if available */}
            {activeNode && executionResults && executionResults[activeNode.id] && (
              <div className="border rounded-lg p-4 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-2">Execution Results</h3>
                <JsonOut 
                  code={JSON.stringify(executionResults[activeNode.id], null, 2)} 
                  editable={false} 
                  onChange={() => {}}
                />
              </div>
            )}
            
            {/* Show workflow metadata */}
            {mergedMetadata && (
              <div className="border rounded-lg p-4 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-2">Workflow Metadata</h3>
                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <h4 className="text-md font-medium mb-1">Container Status</h4>
                    <Badge variant={mergedMetadata.containerStatus === 'running' ? 'default' : 'outline'}>
                      {mergedMetadata.containerStatus || 'Not Available'}
                    </Badge>
                  </div>
                  {mergedMetadata.executionId && (
                    <div className="col-span-2">
                      <h4 className="text-md font-medium mb-1">Execution ID</h4>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded p-2 text-xs font-mono">
                        {mergedMetadata.executionId}
                      </div>
                    </div>
                  )}
                  {mergedMetadata.executionStatus && (
                    <div className="col-span-2">
                      <h4 className="text-md font-medium mb-1">Execution Status</h4>
                      <Badge variant={
                        mergedMetadata.executionStatus === 'completed' ? 'default' :
                        mergedMetadata.executionStatus === 'failed' ? 'destructive' :
                        'secondary'
                      }>
                        {mergedMetadata.executionStatus}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  }, [
    activeTab, 
    inputSchema, 
    inputData, 
    items, 
    pages, 
    page, 
    handleDragStart, 
    renderCell, 
    sourceNodeId, 
    metadataNodeStatus, 
    activeNode, 
    getStatusIcon, 
    executionResults, 
    mergedMetadata
  ]);

  return (
    <Card className="flex flex-col h-full bg-gray-100 dark:bg-[#09090b] border-gray-300 dark:border-gray-700">
      {inputNodes.length === 0 ? (
        <div className="flex flex-col p-6 gap-4">
          {debugMode && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Debug Information</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setDebugMode(false)}
                  className="text-gray-500"
                >
                  <X className="h-4 w-4 mr-1" />
                  Hide Debug
                </Button>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto max-h-96">
                <p className="font-medium mb-2">Props Received:</p>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify({
                    nodeId,
                    workflowId,
                    connectedInputNodes: connectedInputNodes?.map(node => ({
                      id: node?.id,
                      type: node?.type
                    })) || 'none',
                    hasMetadata: !!metadata,
                    hasFullMetadata: !!fullMetadata,
                    hasMergedMetadata: !!mergedMetadata,
                    metadataKeys: mergedMetadata ? Object.keys(mergedMetadata) : []
                  }, null, 2)}
                </pre>
                
                {mergedMetadata?.nodeStatus && (
                  <>
                    <p className="font-medium mt-4 mb-2">Available Node Statuses:</p>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(mergedMetadata.nodeStatus, null, 2)}
                    </pre>
                  </>
                )}
                
                {mergedMetadata?.executionResult?.result?.results && (
                  <>
                    <p className="font-medium mt-4 mb-2">Available Results:</p>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(Object.keys(mergedMetadata.executionResult.result.results), null, 2)}
                    </pre>
                  </>
                )}
                
                <Button 
                  className="mt-4"
                  variant="outline"
                  onClick={() => console.log('Full metadata:', mergedMetadata)}
                >
                  Log Full Metadata
                </Button>
              </div>
            </>
          )}
          <EmptyState />
        </div>
      ) : (
        <>
          <CardHeader className="flex flex-row items-center justify-between p-2 pb-1 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-1 font-medium text-xs h-7 px-2">
                    {activeNode ? (
                      <>
                        <div className="flex items-center gap-2">
                          {renderNodeIcon(activeNode?.type)}
                          <span className="text-xs">{activeNode?.type}</span>
                        </div>
                        {getStatusIcon(activeNode.id)}
                      </>
                    ) : (
                      <>
                        <Icon icon="mdi:connection" className="h-4 w-4" />
                        <span className="text-xs">Input Data</span>
                      </>
                    )}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-[500px] overflow-y-auto w-64">
                  {inputNodes.map((nodeItem: any) => (
                    <DropdownMenuItem
                      key={nodeItem.id}
                      className="flex items-center gap-2 py-2 cursor-pointer"
                      onClick={() => setActiveNode(nodeItem)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {renderNodeIcon(nodeItem?.type)}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{nodeItem?.type}</p>
                          <p className="text-xs text-muted-foreground truncate">{nodeItem?.data?.label || nodeItem.id}</p>
                        </div>
                        {getStatusIcon(nodeItem.id)}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                <TabsList className="h-6">
                  <TabsTrigger value="schema" className="px-1.5 py-0.5 text-xs">Schema</TabsTrigger>
                  <TabsTrigger value="json" className="px-1.5 py-0.5 text-xs">JSON</TabsTrigger>
                  <TabsTrigger value="table" className="px-1.5 py-0.5 text-xs">Table</TabsTrigger>
                  <TabsTrigger value="metadata" className="px-1.5 py-0.5 text-xs">Meta</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsExpanded(true)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <Icon icon="mdi:fullscreen" className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Expand View</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>

          <CardContent className="p-3 pt-3 overflow-auto flex-grow">
            <div className="overflow-auto h-full">
              {renderContent()}
            </div>
          </CardContent>
        </>
      )}

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              {activeNode && (
                <div className="flex items-center gap-2">
                  {renderNodeIcon(activeNode?.type)}
                  <span>{activeNode?.type}</span>
                  {getStatusIcon(activeNode.id)}
                </div>
              )}
              <span>Input Data (Expanded View)</span>
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                <TabsList className="h-7">
                  <TabsTrigger value="schema" className="px-2 py-0.5 text-xs">Schema</TabsTrigger>
                  <TabsTrigger value="json" className="px-2 py-0.5 text-xs">JSON</TabsTrigger>
                  <TabsTrigger value="table" className="px-2 py-0.5 text-xs">Table</TabsTrigger>
                  <TabsTrigger value="metadata" className="px-2 py-0.5 text-xs">Meta</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="p-6">
            {renderContent()}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default React.memo(InputPane);