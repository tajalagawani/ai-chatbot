"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDown } from "lucide-react";
import DataViewer, { generateDraggableItems, generateSchemaFromData, getStatusLabel } from './DataViewer';

interface InputPaneProps {
  nodeId: string;
  workflowId: string;
  connectedInputNodes: any[];
}

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
  const [selectedNodeIndex, setSelectedNodeIndex] = useState(0);
  const [draggableItems, setDraggableItems] = useState([]);
  const [nodeStatus, setNodeStatus] = useState(null);
  const [instanceId, setInstanceId] = useState(Date.now()); // Used to force re-render
  const [activeTab, setActiveTab] = useState("json"); // State for tabs

  // Ensure we have a valid selectedNodeIndex when connectedInputNodes changes
  useEffect(() => {
    if (connectedInputNodes && connectedInputNodes.length > 0) {
      if (selectedNodeIndex >= connectedInputNodes.length) {
        setSelectedNodeIndex(0);
      }
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
  }, [selectedNode, instanceId]);

  // Generate schema from the current node data
  const nodeSchema = useMemo(() => {
    return generateSchemaFromData(nodeData);
  }, [nodeData]);

  const handleDragStart = useCallback((event, item) => {
    event.stopPropagation();
    console.log('Drag start from InputPane:', item);
    event.dataTransfer.setData('text/plain', JSON.stringify(item));
  }, []);

  return (
    <div style={{ transform: 'scale(0.75)', transformOrigin: 'top left', width: '133.33%', height: '133.33%' }}>
      <Card className="flex flex-col h-full bg-gray-100 dark:bg-[#09090b]">
        {!connectedInputNodes || connectedInputNodes.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <CardHeader className="p-4">
              <div className="flex items-center justify-between w-full">
                {/* Left side content */}
                <div className="flex items-center space-x-2">
                  <Button variant="outline" className="font-bold whitespace-nowrap">
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
                
                {/* Right side content */}
                {nodeData && (
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                      <TabsTrigger value="json">JSON</TabsTrigger>
                      <TabsTrigger value="schema">Schema</TabsTrigger>
                      <TabsTrigger value="table">Table</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
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
                  <DataViewer
                    data={nodeData}
                    schema={nodeSchema}
                    nodeId={selectedNode?.id || nodeId}
                    draggableItems={draggableItems}
                    onDragStart={handleDragStart}
                    activeTab={activeTab}
                  />
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