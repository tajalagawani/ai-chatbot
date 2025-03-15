// /* eslint-disable prettier/prettier */
// "use client";

// import React, { useEffect, useState, useMemo, useCallback } from 'react';
// import JsonOut from './JsonOut';
// import {
//   Spinner,
//   Tabs,
//   Tab,
//   Card,
//   CardBody,
//   CardHeader,
//   Table,
//   TableHeader,
//   TableColumn,
//   TableBody,
//   TableRow,
//   TableCell,
//   User,
//   Chip,
//   Tooltip,
//   Accordion,
//   AccordionItem
// } from "@nextui-org/react";
// import { Icon } from "@iconify/react";
// import { useTheme } from 'next-themes';

// interface OutputPaneProps {
//   nodeId: string;
//   workflowId: string;
//   executionResponse: any;
// }

// interface DraggableItem {
//   id: string;
//   name: string;
//   value: any;
//   type: string;
// }

// const getChipColor = (type: string): string => {
//   switch (type) {
//     case 'object': return 'primary';
//     case 'array': return 'secondary';
//     case 'string': return 'success';
//     case 'number': return 'warning';
//     case 'boolean': return 'danger';
//     default: return 'default';
//   }
// };

// const SchemaView = React.memo(({ schema, data, onDragStart }) => {
//   const renderTree = useCallback((key: string, value: any, dataValue: any, path = '') => {
//     const fullPath = path ? `${path}.${key}` : key;
//     const item = { id: fullPath, name: key, value: dataValue, type: value.type };
    
//     const chipColor = getChipColor(value.type);
    
//     const titleContent = (
//       <div className="flex items-center justify-between w-full">
//         <div className="flex items-center">
//           <Chip color={chipColor} variant="flat" className="mr-2">
//             {`${key}: ${value.type}`}
//           </Chip>
//           <Icon icon="mdi:drag" className="cursor-move mr-2" />
//           {(value.type === 'object' || value.type === 'array') && (
//             <Icon icon="mdi:chevron-down" className="accordion-icon" />
//           )}
//         </div>
//         {value.type !== 'object' && value.type !== 'array' && (
//           <span className="text-sm text-gray-500 truncate max-w-[50%]">
//             {JSON.stringify(dataValue)}
//           </span>
//         )}
//       </div>
//     );

//     if (value.type === 'object' && value.properties) {
//       return (
//         <Accordion key={fullPath}>
//           <AccordionItem
//             key={fullPath}
//             aria-label={key}
//             title={titleContent}
//             indicator={({ isOpen }) => (
//               <Icon icon={isOpen ? "mdi:chevron-up" : "mdi:chevron-down"} className="accordion-icon" />
//             )}
//           >
//             <div className="ml-4">
//               {Object.entries(value.properties).map(([k, v]) => 
//                 renderTree(k, v, dataValue?.[k], fullPath)
//               )}
//             </div>
//           </AccordionItem>
//         </Accordion>
//       );
//     } else if (value.type === 'array' && value.items) {
//       return (
//         <Accordion key={fullPath}>
//           <AccordionItem
//             key={fullPath}
//             aria-label={key}
//             title={titleContent}
//             indicator={({ isOpen }) => (
//               <Icon icon={isOpen ? "mdi:chevron-up" : "mdi:chevron-down"} className="accordion-icon" />
//             )}
//           >
//             <div className="ml-4">
//               {renderTree('items', value.items, dataValue?.[0], fullPath)}
//             </div>
//           </AccordionItem>
//         </Accordion>
//       );
//     } else {
//       return (
//         <Accordion key={fullPath}>
//           <AccordionItem
//             key={fullPath}
//             aria-label={key}
//             title={titleContent}
//           >
//             <pre className="text-xs text-gray-500 mt-2 whitespace-pre-wrap break-words">
//               {JSON.stringify(dataValue, null, 2)}
//             </pre>
//           </AccordionItem>
//         </Accordion>
//       );
//     }
//   }, []);

//   return useMemo(() => (
//     <div className="font-mono text-sm">
//       {Object.entries(schema.properties).map(([key, value]) => 
//         renderTree(key, value, data[key])
//       )}
//     </div>
//   ), [schema, data, renderTree]);
// });

// const columns = [
//   { name: "NAME", uid: "name" },
//   { name: "VALUE", uid: "value" },
//   { name: "TYPE", uid: "type" },
//   { name: "ACTIONS", uid: "actions" },
// ];

// const OutputPane: React.FC<OutputPaneProps> = React.memo(({ nodeId, workflowId, executionResponse }) => {
//   const { theme, systemTheme } = useTheme();
//   const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
//   const [outputData, setOutputData] = useState<any>({ loading: true });
//   const [activeTab, setActiveTab] = useState("json");
//   const [draggableItems, setDraggableItems] = useState<DraggableItem[]>([]);

//   const generateDraggableItems = useCallback((data: any, prefix = ''): DraggableItem[] => {
//     let items: DraggableItem[] = [];

//     if (typeof data === 'object' && data !== null) {
//       Object.entries(data).forEach(([key, value]) => {
//         const fullKey = prefix ? `${prefix}.${key}` : key;
//         items.push({
//           id: fullKey,
//           name: key,
//           value: value,
//           type: Array.isArray(value) ? 'array' : typeof value
//         });

//         if (typeof value === 'object' && value !== null) {
//           items = items.concat(generateDraggableItems(value, fullKey));
//         }
//       });
//     }

//     return items;
//   }, []);

//   const generateSchemaFromData = useCallback((data: any): any => {
//     if (Array.isArray(data)) {
//       return {
//         type: 'array',
//         items: generateSchemaFromData(data[0])
//       };
//     } else if (typeof data === 'object' && data !== null) {
//       const properties: any = {};
//       Object.entries(data).forEach(([key, value]) => {
//         properties[key] = generateSchemaFromData(value);
//       });
//       return {
//         type: 'object',
//         properties: properties
//       };
//     } else {
//       return {
//         type: typeof data
//       };
//     }
//   }, []);
//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         if (executionResponse) {
//           setOutputData(executionResponse);
//           setDraggableItems(generateDraggableItems(executionResponse));
//         } else {
//           // If fetchNodeData is not available, you could implement it inline
//           const nodeData = await fetchNodeData(workflowId, nodeId);
//           const nodeData = await fetchNodeData(workflowId, nodeId);
//           if (nodeData?.data?.executionResponse) {
//             setOutputData(nodeData.data.executionResponse);
//             setDraggableItems(generateDraggableItems(nodeData.data.executionResponse));
//           } else {
//             setOutputData({ error: "No output data available" });
//           }
//         }
//       } catch (error) {
//         console.error('OutputPane: Error fetching output data:', error);
//         setOutputData({ error: error.message });
//       }
//     };
  
//     fetchData();
//   }, [nodeId, workflowId, executionResponse, generateDraggableItems]);

//   const outputSchema = useMemo(() => generateSchemaFromData(outputData), [outputData, generateSchemaFromData]);

//   const handleDragStart = useCallback((event: React.DragEvent<HTMLElement>, item: DraggableItem) => {
//     event.dataTransfer.setData('text/plain', JSON.stringify(item));
//   }, []);

//   const renderCell = useCallback((item: DraggableItem, columnKey: React.Key) => {
//     const cellValue = item[columnKey as keyof DraggableItem];

//     switch (columnKey) {
//       case "name":
//         return (
//           <User
//             name={cellValue as string}
//             description={item.id}
//           >
//             {item.id}
//           </User>
//         );
//       case "value":
//         return (
//           <div className="flex flex-col">
//             <p className="text-sm break-all">
//               {typeof cellValue === 'object' 
//                 ? JSON.stringify(cellValue, null, 2)
//                 : String(cellValue)
//               }
//             </p>
//           </div>
//         );
//       case "type":
//         return (
//           <Chip className="capitalize" size="sm" variant="flat">
//             {cellValue as string}
//           </Chip>
//         );
//       case "actions":
//         return (
//           <div className="relative flex items-center gap-2">
//             <Tooltip content="Drag">
//               <span className="text-lg text-default-400 cursor-move">
//                 <Icon icon="mdi:drag" />
//               </span>
//             </Tooltip>
//           </div>
//         );
//       default:
//         return cellValue;
//     }
//   }, []);

//   const renderContent = useCallback(() => {
//     if (outputData.loading) {
//       return <Spinner />;
//     }

//     switch (activeTab) {
//       case "json":
//         return (
//           <JsonOut 
//             code={JSON.stringify(outputData, null, 2)} 
//             editable={false} 
//             onChange={() => {}}
//           />
//         );
//       case "schema":
//         return (
//           <SchemaView 
//             schema={outputSchema} 
//             data={outputData} 
//             onDragStart={handleDragStart} 
//           />
//         );
//       case "table":
//         return (
//           <div className="overflow-x-auto">
//             <Table aria-label="Example table with custom cells">
//               <TableHeader columns={columns}>
//                 {(column) => (
//                   <TableColumn key={column.uid} align={column.uid === "actions" ? "center" : "start"}>
//                     {column.name}
//                   </TableColumn>
//                 )}
//               </TableHeader>
//               <TableBody items={draggableItems}>
//                 {(item) => (
//                   <TableRow key={item.id} draggable onDragStart={(event) => handleDragStart(event, item)}>
//                     {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
//                   </TableRow>
//                 )}
//               </TableBody>
//             </Table>
//           </div>
//         );
//       default:
//         return null;
//     }
//   }, [activeTab, outputData, outputSchema, handleDragStart, draggableItems, renderCell]);

//   return (
//     <div style={{ transform: 'scale(0.75)', transformOrigin: 'top left', width: '133.33%', height: '133.33%' }}>
// <Card className="flex justify-between items-center p-6 h-full bg-gray-100 dark:bg-[#09090b]">
//           <CardHeader className="flex justify-between items-center">
//           <h4 className="text-xl font-bold">Out Data</h4>
//           <Tabs 
//             aria-label="Input Data Tabs"
//             selectedKey={activeTab}
//             onSelectionChange={setActiveTab as any}
//           >
//             <Tab key="json" title="JSON" />
//             <Tab key="schema" title="Schema" />
//             <Tab key="table" title="Table" />
//           </Tabs>
//         </CardHeader>
//         <CardBody>
//           <div className="mt-4 overflow-auto h-full">
//             {renderContent()}
//           </div>
//         </CardBody>
//       </Card>
//     </div>
//   );
// });

// OutputPane.displayName = 'OutputPane';

// export default OutputPane;