"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import JsonOut from './JsonOut';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Icon } from "@iconify/react";
import { Loader2 } from "lucide-react";
import { useTheme } from 'next-themes';

interface OutputPaneProps {
  nodeId: string;
  workflowId: string;
  executionResponse: any;
}

interface DraggableItem {
  id: string;
  name: string;
  value: any;
  type: string;
}

const getChipColor = (type: string): string => {
  switch (type) {
    case 'object': return 'primary';
    case 'array': return 'secondary';
    case 'string': return 'success';
    case 'number': return 'warning';
    case 'boolean': return 'danger';
    default: return 'default';
  }
};

const SchemaView = React.memo(({ schema, data, onDragStart }) => {
  const renderTree = useCallback((key: string, value: any, dataValue: any, path = '') => {
    const fullPath = path ? `${path}.${key}` : key;
    const item = { id: fullPath, name: key, value: dataValue, type: value.type };
    
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
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center">
          <Badge variant={getBadgeVariant(value.type)} className="mr-2">
            {`${key}: ${value.type}`}
          </Badge>
          <Icon icon="mdi:drag" className="cursor-move mr-2" />
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
          <Accordion type="single" collapsible>
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
          <Accordion type="single" collapsible>
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
          <Accordion type="single" collapsible>
            <AccordionItem value={fullPath}>
              <AccordionTrigger className="px-2 hover:no-underline">
                {titleContent}
              </AccordionTrigger>
              <AccordionContent>
                <pre className="text-xs text-gray-500 mt-2 whitespace-pre-wrap break-words">
                  {JSON.stringify(dataValue, null, 2)}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      );
    }
  }, []);

  return useMemo(() => (
    <div className="font-mono text-sm">
      {Object.entries(schema.properties).map(([key, value]) => 
        renderTree(key, value, data[key])
      )}
    </div>
  ), [schema, data, renderTree]);
});

const columns = [
  { name: "NAME", uid: "name" },
  { name: "VALUE", uid: "value" },
  { name: "TYPE", uid: "type" },
  { name: "ACTIONS", uid: "actions" },
];

const OutputPane: React.FC<OutputPaneProps> = React.memo(({ nodeId, workflowId, executionResponse }) => {
  const { theme, systemTheme } = useTheme();
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
  const [outputData, setOutputData] = useState<any>({ loading: true });
  const [activeTab, setActiveTab] = useState("json");
  const [draggableItems, setDraggableItems] = useState<DraggableItem[]>([]);

  const generateDraggableItems = useCallback((data: any, prefix = ''): DraggableItem[] => {
    let items: DraggableItem[] = [];

    if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        items.push({
          id: fullKey,
          name: key,
          value: value,
          type: Array.isArray(value) ? 'array' : typeof value
        });

        if (typeof value === 'object' && value !== null) {
          items = items.concat(generateDraggableItems(value, fullKey));
        }
      });
    }

    return items;
  }, []);

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (executionResponse) {
          setOutputData(executionResponse);
          setDraggableItems(generateDraggableItems(executionResponse));
        } else {
          const nodeData = await fetchNodeData(workflowId, nodeId);
          if (nodeData?.data?.executionResponse) {
            setOutputData(nodeData.data.executionResponse);
            setDraggableItems(generateDraggableItems(nodeData.data.executionResponse));
          } else {
            setOutputData({ error: "No output data available" });
          }
        }
      } catch (error) {
        console.error('OutputPane: Error fetching output data:', error);
        setOutputData({ error: error.message });
      }
    };
  
    fetchData();
  }, [nodeId, workflowId, executionResponse, generateDraggableItems]);

  const outputSchema = useMemo(() => generateSchemaFromData(outputData), [outputData, generateSchemaFromData]);

  const handleDragStart = useCallback((event: React.DragEvent<HTMLElement>, item: DraggableItem) => {
    event.dataTransfer.setData('text/plain', JSON.stringify(item));
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
          <div className="flex flex-col">
            <p className="text-sm break-all">
              {typeof cellValue === 'object' 
                ? JSON.stringify(cellValue, null, 2)
                : String(cellValue)
              }
            </p>
          </div>
        );
      case "type":
        return (
          <Badge variant="outline" className="capitalize">
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

  const renderContent = useCallback(() => {
    if (outputData.loading) {
      return <div className="flex justify-center items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    switch (activeTab) {
      case "json":
        return (
          <JsonOut 
            code={JSON.stringify(outputData, null, 2)} 
            editable={false} 
            onChange={() => {}}
          />
        );
      case "schema":
        return (
          <SchemaView 
            schema={outputSchema} 
            data={outputData} 
            onDragStart={handleDragStart} 
          />
        );
      case "table":
        return (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {columns.map((column) => (
                  <TableHead key={column.uid} className={column.uid === "actions" ? "text-center" : "text-left"}>
                    {column.name}
                  </TableHead>
                ))}
              </TableHeader>
              <TableBody>
                {draggableItems.map((item) => (
                  <TableRow key={item.id} draggable onDragStart={(event) => handleDragStart(event, item)}>
                    {columns.map((column) => (
                      <TableCell key={column.uid}>{renderCell(item, column.uid)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      default:
        return null;
    }
  }, [activeTab, outputData, outputSchema, handleDragStart, draggableItems, renderCell]);

  return (
    <div style={{ transform: 'scale(0.75)', transformOrigin: 'top left', width: '133.33%', height: '133.33%' }}>
      <Card className="flex flex-col h-full bg-gray-100 dark:bg-[#09090b]">
        <CardHeader className="flex justify-between items-center p-6">
          <CardTitle className="text-xl font-bold">Out Data</CardTitle>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="schema">Schema</TabsTrigger>
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="mt-4 overflow-auto h-full">
            {renderContent()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

OutputPane.displayName = 'OutputPane';

export default OutputPane;