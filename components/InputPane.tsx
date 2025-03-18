"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Copy, Check, AlertCircle, CheckCircle, Clock, ArrowDown } from "lucide-react";
import { useTheme } from 'next-themes';

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

interface InputPaneProps {
  nodeId: string;
  workflowId: string;
  connectedInputNodes: any[];
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
  
  let color = 'bg-gray-100 text-gray-800';
  
  switch (status) {
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
      {getStatusIcon(status)}
      <span className="capitalize">{status}</span>
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
            {typeof dataValue === 'object' ? JSON.stringify(dataValue) : String(dataValue)}
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
                  {typeof dataValue === 'object' ? JSON.stringify(dataValue, null, 2) : String(dataValue)}
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
      <ArrowDown size={64} className="text-gray-500 opacity-40" />
      <p className="text-base text-gray-500 opacity-30">No Input Connections</p>  
    </div>
    <p className="text-sm text-gray-500 opacity-40 max-w-md text-center">
      This node doesn't have any input connections yet
    </p>
  </div>
);

const InputPane: React.FC<InputPaneProps> = ({ nodeId, workflowId, connectedInputNodes }) => {
  const { theme, systemTheme } = useTheme();
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
  const [activeTab, setActiveTab] = useState("schema");
  const [selectedNodeIndex, setSelectedNodeIndex] = useState(0);
  const [draggableItems, setDraggableItems] = useState<DraggableItem[]>([]);
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const [nodeStatus, setNodeStatus] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState(Date.now()); // Used to force re-render

  // Ensure we have a valid selectedNodeIndex when connectedInputNodes changes
  useEffect(() => {
    if (connectedInputNodes && connectedInputNodes.length > 0) {
      if (selectedNodeIndex >= connectedInputNodes.length) {
        setSelectedNodeIndex(0);
      }
      
      // Force re-render when connected nodes change or when their execution data changes
      setInstanceId(Date.now());
    }
  }, [
    connectedInputNodes, 
    selectedNodeIndex,
    // Add these dependencies to detect changes in execution results
    connectedInputNodes?.map(node => node.result?.status?.status || 
      node.data?.result?.status?.status || 
      node.executionResponse?.result?.results?.[node.id]?.status?.status).join('|'),
    connectedInputNodes?.map(node => 
      JSON.stringify(node.executionResponse?.result?.results?.[node.id] || 
      node.result || 
      node.data?.result))
  ]);

  // Generate draggable items from the current selected node
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

  // Generate schema from data
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

  // Get the currently selected node data
  const selectedNode = useMemo(() => {
    if (!connectedInputNodes || connectedInputNodes.length === 0) {
      return null;
    }
    
    return connectedInputNodes[selectedNodeIndex];
  }, [connectedInputNodes, selectedNodeIndex, instanceId]);

  // Extract the result data from the selected node
  const nodeData = useMemo(() => {
    if (!selectedNode) {
      return null;
    }
    
    console.log('Processing selected node for input pane:', selectedNode);
    
    // Find the result in the node, looking in all possible locations
    let result = null;
    
    // Check node.result (top level)
    if (selectedNode.result) {
      result = selectedNode.result;
    }
    
    // Check node.data.result
    else if (selectedNode.data?.result) {
      result = selectedNode.data.result;
    }
    
    // Check executionResponse paths
    else if (selectedNode.executionResponse?.result?.results?.[selectedNode.id]) {
      result = selectedNode.executionResponse.result.results[selectedNode.id];
    }
    
    else if (selectedNode.data?.executionResponse?.result?.results?.[selectedNode.id]) {
      result = selectedNode.data.executionResponse.result.results[selectedNode.id];
    }
    
    console.log('Extracted result from selected node:', result);
    
    // Extract status if available
    if (result?.status) {
      setNodeStatus(result.status.status || (typeof result.status === 'string' ? result.status : null));
    } else {
      setNodeStatus(null);
    }
    
    // Generate draggable items based on the result
    if (result) {
      const items = generateDraggableItems(result, selectedNode.id);
      setDraggableItems(items);
    } else {
      setDraggableItems([]);
    }
    
    return result;
  }, [selectedNode, generateDraggableItems, instanceId]);

  // Generate schema from the current node data
  const nodeSchema = useMemo(() => {
    return generateSchemaFromData(nodeData);
  }, [nodeData, generateSchemaFromData]);

  const handleDragStart = useCallback((event: React.DragEvent<HTMLElement>, item: DraggableItem) => {
    event.stopPropagation();
    console.log('Drag start from InputPane:', item);
    event.dataTransfer.setData('text/plain', JSON.stringify(item));
  }, []);

  const formatValue = useCallback((value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    if (typeof value === 'object') {
      try {
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
      {activeTab === "schema" && (
        <SchemaView 
          schema={nodeSchema} 
          data={nodeData} 
          onDragStart={handleDragStart}
          sourceNodeId={selectedNode?.id || nodeId}
        />
      )}
      {activeTab === "json" && (
        <JsonOut 
          code={JSON.stringify(nodeData, null, 2)} 
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
  ), [activeTab, nodeSchema, nodeData, handleDragStart, items, page, pages, renderCell, selectedNode, nodeId]);

  return (
    <div style={{ transform: 'scale(0.75)', transformOrigin: 'top left', width: '133.33%', height: '133.33%' }}>
      <Card className="flex flex-col h-full bg-gray-100 dark:bg-[#09090b]">
        {!connectedInputNodes || connectedInputNodes.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <CardHeader className="flex flex-row justify-between items-center p-6">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="font-bold">
                    Input Data
                  </Button>
                  
                  {/* Node Source Selector */}
                  {connectedInputNodes.length > 1 && (
                    <Select 
                      value={String(selectedNodeIndex)} 
                      onValueChange={(value) => setSelectedNodeIndex(parseInt(value))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {connectedInputNodes.map((node, index) => (
                          <SelectItem key={node.id} value={String(index)}>
                            {node.type || node.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {/* Node Status Badge */}
                  {nodeStatus && getStatusLabel(nodeStatus)}
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

            <CardContent className="overflow-hidden flex-1">
              <div className="h-full overflow-auto">
                {!nodeData ? (
                  <div className="flex justify-center items-center h-full flex-col gap-4">
                    <p className="text-muted-foreground">No result data available from this input node</p>
                    {selectedNode && (
                      <div className="text-xs text-muted-foreground">
                        Connected to node: {selectedNode.id}
                      </div>
                    )}
                  </div>
                ) : (
                  renderContent()
                )}
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
};

export default React.memo(InputPane);