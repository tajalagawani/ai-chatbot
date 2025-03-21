"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataViewer, { generateDraggableItems, generateSchemaFromData, getStatusLabel } from './DataViewer';

interface OutputPaneProps {
  nodeId: string;
  workflowId: string;
  executionResponse?: any;
  result?: any;
}

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-full gap-4">
    <div className="flex flex-col items-center gap-6 p-8 rounded-md border border-gray-700 bg-[#09090b]">
      <img 
        src="/api/placeholder/100/100"
        alt="Results icon"
        className="w-24 h-24 opacity-50 [filter:invert(40%)_sepia(0%)_saturate(100%)_hue-rotate(190deg)_brightness(90%)_contrast(95%)]"
      />
      <p className="text-base text-gray-500 opacity-30">No Results Available</p>  
    </div>
    <p className="text-sm text-gray-500 opacity-40 max-w-md text-center">
      Run the workflow to see execution results for this node
    </p>
  </div>
);

const OutputPane: React.FC<OutputPaneProps> = ({ nodeId, workflowId, executionResponse, result }) => {
  const [outputData, setOutputData] = useState<any>({ loading: true });
  const [draggableItems, setDraggableItems] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [nodeStatus, setNodeStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("json");

  useEffect(() => {
    const processData = () => {
      try {
        // Prioritize result prop over executionResponse
        let dataToProcess = result || executionResponse;
        
        if (dataToProcess) {
          setHasData(true);
          
          // Extract status if available
          if (dataToProcess.status) {
            setNodeStatus(dataToProcess.status.status || (typeof dataToProcess.status === 'string' ? dataToProcess.status : null));
          }
          
          // Handle special data formats
          if (dataToProcess.result?.choices?.[0]?.message?.content) {
            // For OpenAI/Claude API type responses, highlight the content
            const content = dataToProcess.result.choices[0].message.content;
            setOutputData({
              content: content,
              raw: dataToProcess
            });
          } else if (dataToProcess.body) {
            // For API responses, highlight the body
            setOutputData({
              body: dataToProcess.body,
              raw: dataToProcess
            });
          } else {
            // Use the data as is
            setOutputData(dataToProcess);
          }
          
          // Generate draggable items from the data
          const items = generateDraggableItems(dataToProcess, nodeId);
          setDraggableItems(items);
        } else {
          setHasData(false);
          setOutputData({ message: "No execution response available" });
        }
      } catch (error) {
        console.error('OutputPane: Error processing data:', error);
        setOutputData({ error: error.message });
      }
    };
    
    processData();
  }, [nodeId, workflowId, executionResponse, result]);

  const outputSchema = useMemo(() => generateSchemaFromData(outputData), [outputData]);

  const handleDragStart = useCallback((event, item) => {
    event.stopPropagation();
    console.log('Drag start from Output:', item);
    event.dataTransfer.setData('text/plain', JSON.stringify(item));
  }, []);

  return (
    <div style={{ transform: 'scale(0.75)', transformOrigin: 'top left', width: '133.33%', height: '133.33%' }}>
      <Card className="flex flex-col h-full bg-gray-100 dark:bg-[#09090b]">
        {!hasData ? (
          <EmptyState />
        ) : (
          <>
            <CardHeader className="p-4">
              <div className="flex items-center justify-between w-full">
                {/* Left side with Node Results button and status */}
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="font-bold">
                    Node Results
                  </Button>
                  
                  {/* Node Status Badge */}
                  {nodeStatus && getStatusLabel(nodeStatus)}
                </div>
                
                {/* Right side with tabs */}
                {hasData && !outputData.loading && (
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
                {outputData.loading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin h-6 w-6 border-2 border-gray-500 rounded-full border-t-transparent"></div>
                  </div>
                ) : (
                  <DataViewer
                    data={outputData}
                    schema={outputSchema}
                    nodeId={nodeId}
                    draggableItems={draggableItems}
                    onDragStart={handleDragStart}
                    loading={outputData.loading}
                    activeTab={activeTab} 
                  />
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
                  <span>Results Data (Expanded View)</span>
                  {nodeStatus && getStatusLabel(nodeStatus)}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)}>
                  <span>✕</span>
                </Button>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex justify-between items-center w-full py-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                <TabsList>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                  <TabsTrigger value="schema">Schema</TabsTrigger>
                  <TabsTrigger value="table">Table</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <div className="py-4">
              <DataViewer
                data={outputData}
                schema={outputSchema}
                nodeId={nodeId}
                draggableItems={draggableItems}
                onDragStart={handleDragStart}
                activeTab={activeTab}
              />
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
};

export default React.memo(OutputPane);