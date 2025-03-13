"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import JsonOut from './JsonOut';
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
import { Loader2 } from "lucide-react";
import { useTheme } from 'next-themes';

interface InputPaneProps {
  nodeId: string;
  workflowId: string;
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

const SchemaView = React.memo(({ schema, data, onDragStart, sourceNodeId }: SchemaViewProps) => {
  const getChipColor = useCallback((type: any) => {
    switch (type) {
      case 'object': return 'primary';
      case 'array': return 'secondary';
      case 'string': return 'success';
      case 'number': return 'warning';
      case 'boolean': return 'danger';
      default: return 'default';
    }
  }, []);
  
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <svg
        viewBox="0 0 24 24"
        className="w-16 h-16 text-gray-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 5h10" />
        <path d="M7 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2" />
        <path d="M22 10a2 2 0 0 0-2-2h-3" />
        <path d="M20 8v8" />
        <path d="M16 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2" />
      </svg>
      <p className="text-xl text-gray-500 font-medium">Wire Me</p>
    </div>
  );
  
  const renderTree = useCallback((key: string | undefined, value: { type: string; properties: { [s: string]: unknown; } | ArrayLike<unknown>; items: any; }, dataValue: any[], path = '') => {
    const fullPath = path ? `${path}.${key}` : key;
    console.log('checking Node TREE', sourceNodeId);
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
          <Icon icon="mdi:drag" />
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
                  {renderTree('items', value.items, dataValue?.[0], fullPath)}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      );
    } else {
      return (
        <div key={fullPath} className="mb-2">
          {titleContent}
        </div>
      );
    }
  }, [getChipColor, onDragStart, sourceNodeId]);

  return (
    <div className="font-mono text-sm">
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
      <img 
        src="https://cdn4.iconfinder.com/data/icons/plug-electric-cs/512/energy_adapter_element_cable-06-512.png"
        alt="Wire icon"
        className="w-24 h-24 opacity-50 [filter:invert(40%)_sepia(0%)_saturate(100%)_hue-rotate(190deg)_brightness(90%)_contrast(95%)]"
      />
      <p className="text-base text-gray-500 opacity-30">Wire Me Left</p>  
    </div>
    <p className="text-sm text-gray-500 opacity-40 max-w-md text-center">
      Connect a node to access its output data and enable data flow between nodes
    </p>
  </div>
);

const InputPane: React.FC<InputPaneProps> = ({ nodeId, workflowId }) => {
  const { theme, systemTheme } = useTheme();
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
  const [inputData, setInputData] = useState<any>({ loading: true });
  const [activeTab, setActiveTab] = useState("schema");
  const [draggableItems, setDraggableItems] = useState<DraggableItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const rowsPerPage = 11;
  const [sourceNodeId, setSourceNodeId] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const workflow = await getWorkflow(workflowId);
        const currentNode = workflow.nodes.find((node) => node.id === nodeId);
        if (currentNode) {
          // Find the first incoming edge
          const incomingEdge = workflow.edges.find((edge) => edge.target === nodeId);
          
          if (incomingEdge) {
            const sourceNode = workflow.nodes.find((node) => node.id === incomingEdge.source);
            
            if (sourceNode && sourceNode.data && sourceNode.data.executionResponse) {
              setInputData(sourceNode.data.executionResponse);
              setSourceNodeId(sourceNode.id);
              const items = generateDraggableItems(sourceNode.data.executionResponse, sourceNode.id);
              setDraggableItems(items);
            } else {
              setInputData({ error: "No input data available" });
            }
          } else {
            setInputData({ info: "This node has no input data" });
          }
        } else {
          setInputData({ error: "Current node not found" });
        }
      } catch (error) {
        console.error('InputPane: Error fetching input data:', error);
        setInputData({ error: error.message });
      }
    };

    fetchData();
  }, [nodeId, workflowId, generateDraggableItems]);

  const generateSchemaFromData = useCallback((data: any): any => {
    if (Array.isArray(data)) {
      return {
        type: 'array',
        items: generateSchemaFromData(data[0])
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

  const handleDragStart = useCallback((event: React.DragEvent<HTMLElement>, item: DraggableItem) => {
    event.stopPropagation();
    console.log('Drag start:', item);
    event.dataTransfer.setData('text/plain', JSON.stringify(item));
  }, []);

  const renderCell = useCallback((item: { [x: string]: any; id: string | number | bigint | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | Promise<React.AwaitedReactNode> | null | undefined; }, columnKey: React.Key) => {
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
            <p className="text-sm font-medium">
              {typeof cellValue === 'object' ? JSON.stringify(cellValue) : String(cellValue)}
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
                  <span className="text-lg text-muted-foreground cursor-move">
                    <Icon icon="mdi:drag" />
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
  }, []);

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
          schema={inputSchema} 
          data={inputData} 
          onDragStart={handleDragStart}
          sourceNodeId={sourceNodeId}
        />
      )}
      {activeTab === "json" && (
        <JsonOut 
          code={JSON.stringify(inputData, null, 2)} 
          editable={false} 
          onChange={() => {}}
        />
      )}
      {activeTab === "table" && (
        <>
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
          <div className="flex w-full justify-center py-4 pt-12">
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
        </>
      )}
    </>
  ), [activeTab, inputSchema, inputData, handleDragStart, sourceNodeId, items, page, pages, renderCell]);

  return (
    <div style={{ transform: 'scale(0.75)', transformOrigin: 'top left', width: '133.33%', height: '133.33%' }}>
      <Card className="flex flex-col h-full bg-gray-100 dark:bg-[#09090b]">
        {!inputData || inputData.info ? (
          <EmptyState />
        ) : (
          <>
            <CardHeader className="flex flex-row justify-between items-center p-6">
              <div className="flex flex-row items-center gap-4">
                <Button variant="outline" className="font-bold">
                  Input Data
                </Button>
                
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                  <TabsList>
                    <TabsTrigger value="schema">Schema</TabsTrigger>
                    <TabsTrigger value="json">JSON</TabsTrigger>
                    <TabsTrigger value="table">Table</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>

            <CardContent>
              <div className="mt-4 overflow-auto h-full">
                {inputData.loading ? (
                  <div className="flex justify-center items-center">
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
                <span>Input Data (Expanded View)</span>
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

export default React.memo(InputPane);