"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Copy, Check } from "lucide-react";
import { useTheme } from 'next-themes';

const JsonOut = ({ code, editable = false, onChange = () => {} }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  // Split code into lines for line numbering
  const codeLines = useMemo(() => {
    return code.split('\n');
  }, [code]);

  return (
    <div className="relative h-full">
      <div className="flex h-full rounded-md overflow-hidden">
        {/* Line numbers column */}
        <div className="py-4 pr-2 text-right bg-[#0f0f10] border-r border-gray-700 select-none">
          {codeLines.map((_, index) => (
            <div key={index} className="text-gray-500 text-xs leading-5 px-2">
              {index + 1}
            </div>
          ))}
        </div>
        
        {/* Code content */}
        <pre className="p-4 rounded-md overflow-auto h-full flex-1 bg-[#0f0f10] text-gray-300">
          <code>
            {codeLines.map((line, index) => (
              <div key={index} className="leading-5">
                {line || ' '}
              </div>
            ))}
          </code>
        </pre>
      </div>
      
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
          case 'object': 
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 font-medium';
          case 'array': 
            return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 font-medium';
          case 'string': 
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 font-medium';
          case 'number': 
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 font-medium';
          case 'boolean': 
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 font-medium';
          default: 
            return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 font-medium';
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
                    <pre className={`text-xs mt-2 whitespace-pre-wrap break-words p-2 rounded bg-[#0f0f10] text-gray-300`}>
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

interface DataViewerProps {
  data: any;
  schema: any;
  nodeId: string;
  draggableItems: DraggableItem[];
  loading?: boolean;
  onDragStart: (event: React.DragEvent<HTMLElement>, item: DraggableItem) => void;
  activeTab: string; // Prop for active tab
}

const DataViewer: React.FC<DataViewerProps> = ({ 
  data, 
  schema, 
  nodeId, 
  draggableItems, 
  loading = false,
  onDragStart,
  activeTab = "json" // Default to JSON view if not provided
}) => {
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

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
                    onDragStart={(e) => onDragStart(e, item)}
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
  }, [formatValue, onDragStart]);

  const pages = Math.ceil(draggableItems.length / rowsPerPage);

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return draggableItems.slice(start, end);
  }, [page, draggableItems]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        {activeTab === "schema" && (
          <SchemaView 
            schema={schema} 
            data={data} 
            onDragStart={onDragStart}
            sourceNodeId={nodeId}
          />
        )}
        {activeTab === "json" && (
          <JsonOut 
            code={JSON.stringify(data, null, 2)} 
            editable={false} 
          />
        )}
        {activeTab === "table" && (
          <div className="flex flex-col h-full">
            <div className="overflow-y-auto flex-1">
              {draggableItems.length > 0 ? (
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
                      <TableRow key={item.id} draggable onDragStart={(event) => onDragStart(event, item)}>
                        {columns.map((column) => (
                          <TableCell key={column.uid}>{renderCell(item, column.uid)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-muted-foreground">No data available</p>
                </div>
              )}
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
      </div>
    </div>
  );
};

// Helper functions to be exported and reused
export const generateDraggableItems = (data: any, sourceNodeId: string, prefix = ''): DraggableItem[] => {
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
};

export const generateSchemaFromData = (data: any): any => {
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
};

// Export common utility functions and status components
export const getStatusIcon = (status) => {
  const CheckCircle = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className={props.className || "h-4 w-4 text-green-500"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
  
  const AlertCircle = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className={props.className || "h-4 w-4 text-red-500"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  );
  
  const Clock = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className={props.className || "h-4 w-4 text-blue-500"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  );
  
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

export const getStatusLabel = (status) => {
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