import React, { memo, FC, useState, useEffect, useCallback, useMemo } from 'react';
import { Handle, Position, NodeProps, Node, Edge } from 'reactflow';
import { useTheme } from 'next-themes';
import { Card } from '@/components/ui/card';
import { Box } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import './BaseNode.css';

interface BaseNodeProps extends NodeProps {
  icon: React.ReactElement;
  nodeKind: 'Input' | 'Core' | 'Output' | 'Default';
  nodeType: string;
  customSettings?: React.ReactElement;
  onNodeDataChange: (id: string, newData: any) => void;
  onNodeDelete: (id: string) => void;
  allNodes?: Node[];
  allEdges?: Edge[];
}

interface NodeStyles {
  [key: string]: {
    border: string;
    boxShadow: string;
  };
}

const BaseNode: FC<BaseNodeProps> = memo(({
  id,
  data,
  nodeKind,
  nodeType,
  selected,
  customSettings,
  onNodeDataChange,
  onNodeDelete,
  allNodes,
  allEdges,
}) => {
  // State management
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [logMessage, setLogMessage] = useState('No execution response yet');
  const [nodeStatus, setNodeStatus] = useState('Staging');
  const [iconSrc, setIconSrc] = useState<string | null>(null);
  const { theme, systemTheme } = useTheme();

  // Derived state
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
  const isUCMode = data?.formData?.mode === 'UC';

  // Memoized values
  const connectedInputNodes = useMemo(() => {
    if (!allEdges || !allNodes) return [];
    return allEdges
      .filter(edge => edge.target === id)
      .map(edge => allNodes.find(node => node.id === edge.source))
      .filter((node): node is Node => node !== undefined);
  }, [id, allNodes, allEdges]);

  const logoDotStyle = useMemo(() => {
    if (!data.executionResponse) return {};
    if (data.executionResponse?.result?.status === 'error' || data.executionResponse?.error) {
      return { backgroundColor: '#f44336' };
    }
    return {};
  }, [data.executionResponse]);

  // Node style calculations
  const getNodeBorderStyle = useCallback((
    nodeKind: string,
    status: string,
    selected: boolean,
    isUCMode: boolean
  ) => {
    if (isUCMode) return {};

    const baseStyle = { border: '1px solid rgb(40, 42, 41)' };
    const styleWithShadow = (color: string) => ({
      ...baseStyle,
      boxShadow: `0 0 0 ${selected ? '6px' : '5px'} ${color}`
    });

    const nodeStyles: NodeStyles = {
      selected: {
        Input: styleWithShadow('rgba(255, 165, 0, 0.3)'),
        Core: styleWithShadow('rgba(0, 128, 0, 0.3)'),
        Output: styleWithShadow('rgba(0, 0, 255, 0.3)'),
        Default: styleWithShadow('rgba(128, 128, 128, 0.3)')
      },
      status: {
        Staging: styleWithShadow('rgba(255, 0, 0, 0.3)'),
        Onboarding: styleWithShadow('rgba(1, 82, 162, 0.3)'),
        Live: styleWithShadow('rgba(16, 163, 127, 0.3)'),
        Default: styleWithShadow('rgba(3, 32, 25, 1)')
      }
    };

    return selected
      ? nodeStyles.selected[nodeKind] || nodeStyles.selected.Default
      : nodeStyles.status[status] || nodeStyles.status.Default;
  }, []);

  // Handle styles
  const handleStyle = useMemo(() => ({
    background: isDarkMode ? '#fff' : '#6D7879',
    width: 8,
    height: 20,
    padding: 3,
    borderRadius: 0,
    opacity: 1,
    zIndex: 9999999,
  }), [isDarkMode]);

  const handleOutStyle = useMemo(() => ({
    ...handleStyle,
    width: 20,
    padding: 2,
    opacity: 5,
  }), [handleStyle]);

  // Effects
  // useEffect(() => {
  //   const fetchIcon = async () => {
  //     try {
  //       const response = await fetch(`http://127.0.0.1:5009/api/node_icons/${nodeType}`);
  //       if (response.ok) {
  //         const data = await response.json();
  //         setIconSrc(data.icon);
  //       }
  //     } catch (error) {
  //       console.error(`Error fetching icon for ${nodeType}:`, error);
  //       setIconSrc(null);
  //     }
  //   };

  //   fetchIcon();
  // }, [nodeType]);

  useEffect(() => {
    if (data.executionResponse) {
      let message: string;
      if (typeof data.executionResponse === 'string') {
        message = data.executionResponse;
      } else if (typeof data.executionResponse === 'object') {
        if (!data.executionResponse?.result?.status === 'error' && !data.executionResponse?.error) {
          setNodeStatus('Onboarding');
        }
        message = JSON.stringify(data.executionResponse);
      } else {
        message = 'Execution completed';
      }
      setLogMessage(message.length > 100 ? `${message.substring(0, 97)}...` : message);
    }
  }, [data.executionResponse]);

  // Event handlers
  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setIsSheetOpen(true);
  }, []);

  const handleSheetClose = useCallback(() => {
    setIsSheetOpen(false);
  }, []);

  const handleNodeSave = useCallback((formData: any) => {
    onNodeDataChange(id, {
      ...data,
      ...formData
    });
    setIsSheetOpen(false);
  }, [id, data, onNodeDataChange]);

  // Render functions
  const renderHandles = useCallback(() => {
    const handles = {
      Input: (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          style={handleStyle}
        />
      ),
      Core: (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="left"
            style={handleStyle}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            style={handleOutStyle}
          />
        </>
      ),
      Output: (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          style={handleStyle}
        />
      ),
      Default: (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="left"
            style={handleStyle}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            style={handleOutStyle}
          />
        </>
      )
    };

    return handles[nodeKind] || handles.Default;
  }, [nodeKind, handleStyle, handleOutStyle]);

  return (
    <>
      <div className="relative" onDoubleClick={handleDoubleClick}>
        <Card
          className={`base-node ${nodeKind} ${isUCMode ? 'gradient-border' : ''} ${
            selected && isUCMode ? 'selected' : ''
          } ${isDarkMode ? 'dark' : 'light'}`}
          style={!isUCMode ? getNodeBorderStyle(nodeKind, nodeStatus, selected, isUCMode) : {}}
        >
          <div className={`node-content ${isDarkMode ? 'dark' : 'light'}`}>
            <div style={{ fontSize: '30px' }}>
              {iconSrc ? (
                <img
                  src={iconSrc}
                  alt={`${nodeType} Logo`}
                  className="node-icon"
                  onError={() => setIconSrc(null)}
                />
              ) : (
                <Box size={50} />
              )}
            </div>
          </div>

          {selected && (
            <div className="log-bar">
              <span className="green-dot" style={logoDotStyle}></span>
              <div className="marquee-container">
                <div className="marquee-text">{logMessage}</div>
              </div>
            </div>
          )}
          {renderHandles()}
        </Card>

        <div className="node-label" style={{ color: isDarkMode ? '#fff' : '#555' }}>
          {data?.label || ''}
        </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={handleSheetClose}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl font-bold">
              Node Settings: {data?.label || 'Untitled Node'}
            </SheetTitle>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-200px)] mt-6">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleNodeSave(data);
              }} 
              className="space-y-6"
            >
              <div className="space-y-4">
                <div>
                  <Label htmlFor="label">Node Label</Label>
                  <Input
                    id="label"
                    value={data?.label || ''}
                    onChange={(e) => onNodeDataChange(id, { ...data, label: e.target.value })}
                    placeholder="Enter node label"
                  />
                </div>

                <div>
                  <Label>Node Type</Label>
                  <Input
                    value={nodeType}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <Separator className="my-4" />

                <div>
                  <Label htmlFor="operation">Operation</Label>
                  <Input
                    id="operation"
                    value={data?.operation || ''}
                    onChange={(e) => onNodeDataChange(id, { ...data, operation: e.target.value })}
                    placeholder="Enter operation"
                  />
                </div>

                <div>
                  <Label htmlFor="operation_name">Operation Name</Label>
                  <Input
                    id="operation_name"
                    value={data?.operation_name || ''}
                    onChange={(e) => onNodeDataChange(id, { 
                      ...data, 
                      operation_name: e.target.value 
                    })}
                    placeholder="Enter operation name"
                  />
                </div>
              </div>

              <SheetFooter className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={handleSheetClose}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </SheetFooter>
            </form>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
});

BaseNode.displayName = 'BaseNode';

export default BaseNode;