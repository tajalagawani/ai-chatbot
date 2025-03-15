// Enhanced BaseNode.tsx
import React, { memo, FC, useState, useEffect, useCallback, useMemo } from 'react';
import { Handle, Position, NodeProps, Node, Edge } from 'reactflow';
import { useTheme } from 'next-themes';
import { Card } from '@/components/ui/card';
import { Box, Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import DraggablePanels from './panelsModal';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [logMessage, setLogMessage] = useState('No execution response yet');
  const [nodeStatus, setNodeStatus] = useState('Staging');
  const [iconSrc, setIconSrc] = useState<string | null>(null);
  const [showErrorTooltip, setShowErrorTooltip] = useState(false);
  const { theme, systemTheme } = useTheme();

  // Derived state
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
  const isUCMode = data?.formData?.mode === 'UC';
  
  // Check if node is currently executing
  const isExecuting = data?.executionStatus === 'executing';

  // Get the node status from data if available
  const executionStatus = data?.status?.status || null;
  
  // Extract error message from execution response if available
  const errorMessage = useMemo(() => {
    if (!data.executionResponse) return null;
    
    // Direct error in the execution response
    if (data.executionResponse?.error) {
      return data.executionResponse.error.message || String(data.executionResponse.error);
    }
    
    // Error in result object
    if (data.executionResponse?.result?.status === 'error') {
      return data.executionResponse.result.message || 'An error occurred during execution';
    }
    
    // Error in specific node results (like the claude_analysis example)
    if (data.executionResponse?.result?.results && data.id in data.executionResponse.result.results) {
      const nodeResult = data.executionResponse.result.results[data.id];
      if (nodeResult?.error) {
        return nodeResult.error;
      }
      if (nodeResult?.status === 'error') {
        return nodeResult.message || 'Node execution failed';
      }
    }
    
    // Check node_status for error messages
    if (data.executionResponse?.result?.node_status && data.id in data.executionResponse.result.node_status) {
      const nodeStatus = data.executionResponse.result.node_status[data.id];
      if (nodeStatus?.status === 'failed') {
        return nodeStatus.message || 'Node execution failed';
      }
    }
    
    return null;
  }, [data.executionResponse, data.id]);

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

  // Get status icon based on execution status
  const getStatusIcon = useCallback(() => {
    if (!executionStatus) return null;
    
    switch (executionStatus) {
      case 'completed':
        return (
          <div className="status-icon">
            <CheckCircle className="h-4 w-4 status-icon-completed" />
          </div>
        );
      case 'failed':
        return (
          <div 
            className="status-icon error-status-icon"
            title={errorMessage || "Execution failed"}
          >
            <AlertCircle className="h-4 w-4 status-icon-failed" />
          </div>
        );
      case 'pending':
        return (
          <div className="status-icon">
            <Clock className="h-4 w-4 status-icon-pending" />
          </div>
        );
      case 'in_progress':
        return (
          <div className="status-icon">
            <Clock className="h-4 w-4 status-icon-in-progress" />
          </div>
        );
      default:
        return null;
    }
  }, [executionStatus, errorMessage]);

  // Node style calculations
  const getNodeBorderStyle = useCallback((
    nodeKind: string,
    status: string,
    selected: boolean,
    isUCMode: boolean,
    isExecuting: boolean,
    executionStatus: string | null
  ) => {
    if (isUCMode) return {};

    // If node is executing, return an amber highlight
    if (isExecuting) {
      return {
        border: '1px solid rgb(245, 158, 11)',
        boxShadow: '0 0 0 5px rgba(245, 158, 11, 0.3)'
      };
    }

    // If we have execution status, use that for styling
    if (executionStatus) {
      const baseStyle = { border: '0.5px solid' };
      const styleWithShadow = (borderColor: string, shadowColor: string) => ({
        ...baseStyle,
        borderColor,
        boxShadow: `0 0 0 ${selected ? '4px' : '2px'} ${shadowColor}`
      });

      switch (executionStatus) {
        case 'completed':
          return styleWithShadow('#10b981', 'rgba(16, 185, 129, 0.3)');
        case 'failed':
          return styleWithShadow('#ef4444', 'rgba(239, 68, 68, 0.3)');
        case 'pending':
          return styleWithShadow('#3b82f6', 'rgba(59, 130, 246, 0.3)');
        case 'in_progress':
          return styleWithShadow('#f59e0b', 'rgba(245, 158, 11, 0.3)');
      }
    }

    // Fall back to original styling if no execution status
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

  // Update log message with detailed response data for all nodes
  useEffect(() => {
    // First priority: Show detailed error message if available
    if (errorMessage) {
      setLogMessage(`Error: ${errorMessage}`);
      return;
    }
    
    // Second priority: Show execution response details if available
    if (data.executionResponse) {
      let detailedMessage = '';
      
      // Handle different response formats
      if (typeof data.executionResponse === 'string') {
        detailedMessage = data.executionResponse;
      } else if (typeof data.executionResponse === 'object') {
        // Get node-specific results from the execution response
        if (data.executionResponse?.result?.results && data.id in data.executionResponse.result.results) {
          const nodeResult = data.executionResponse.result.results[data.id];
          
          // Display different details based on the type of node
          if (nodeResult?.result?.choices?.[0]?.message?.content) {
            // For AI nodes like OpenAI, show the generated content
            detailedMessage = nodeResult.result.choices[0].message.content;
          } else if (nodeResult?.body) {
            // For API request nodes, show a summary of the response
            detailedMessage = `Response: ${JSON.stringify(nodeResult.body).substring(0, 150)}...`;
          } else if (nodeResult?.status) {
            // For other nodes with status info
            detailedMessage = `Status: ${nodeResult.status}${nodeResult.error ? ` - Error: ${nodeResult.error}` : ''}`;
          } else {
            // Fallback: stringify the full result
            detailedMessage = JSON.stringify(nodeResult).substring(0, 150) + '...';
          }
        } else {
          // If no node-specific results, use the status message if available
          detailedMessage = data?.status?.message || JSON.stringify(data.executionResponse).substring(0, 150) + '...';
        }
      }
      
      setLogMessage(detailedMessage);
      return;
    }
    
    // Third priority: Show status message if available
    if (data?.status?.message) {
      setLogMessage(data.status.message);
      return;
    }
    
    // Default message if nothing else is available
    setLogMessage('No execution response yet');
  }, [data.executionResponse, data?.status, data.id, errorMessage]);

  // Log all node data when double-clicked
  const logNodeData = useCallback(() => {
    // Create a structured object to log all node data
    const nodeDataLog = {
      nodeId: id,
      nodeType: data?.type || nodeType || id,
      nodeKind,
      position: { x: data?.position_x, y: data?.position_y },
      status: executionStatus,
      selected,
      connections: {
        inputs: connectedInputNodes.map(node => ({
          id: node.id,
          type: node.data?.type || node.type
        })),
        outputConnections: allEdges?.filter(edge => edge.source === id).map(edge => edge.target) || []
      },
      allNodeData: { ...data },
      originalProperties: data?._originalProperties || [],
      executionDetails: {
        status: executionStatus,
        hasError: !!errorMessage,
        errorMessage,
        executionResponse: data.executionResponse
      }
    };

    // Log to console with expandable sections
    console.group(`Node Data: ${id} (${data?.type || nodeType || 'Unknown Type'})`);
    console.log('📌 Basic Information:', {
      id,
      type: data?.type || nodeType,
      label: data?.label,
      description: data?.description,
      nodeKind
    });
    console.log('🔄 Current State:', {
      selected,
      isExecuting,
      executionStatus,
      nodeStatus,
      hasUnsavedChanges: data?.hasUnsavedChanges
    });
    console.log('📝 Complete Node Properties:', data);
    console.log('🔗 Connections:', {
      inputNodes: connectedInputNodes,
      outputTo: allEdges?.filter(edge => edge.source === id).map(edge => edge.target) || []
    });
    if (data.executionResponse) {
      console.log('🚀 Execution Response:', data.executionResponse);
    }
    if (errorMessage) {
      console.error('❌ Error:', errorMessage);
    }
    console.log('📊 Node Data Structure:', {
      originalProperties: data?._originalProperties || [],
      originalStructure: data?._originalStructure || {}
    });
    console.groupEnd();

    return nodeDataLog;
  }, [
    id, 
    data, 
    nodeType, 
    nodeKind, 
    selected, 
    isExecuting, 
    executionStatus, 
    nodeStatus, 
    errorMessage, 
    connectedInputNodes, 
    allEdges
  ]);

  // Event handlers
  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Log all node data
    const nodeData = logNodeData();
    console.log('Complete node data on double-click:', nodeData);
    
    // Open node settings modal
    setIsModalOpen(true);
  }, [logNodeData]);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleNodeSave = useCallback((formData: any) => {
    console.log('Saving node data - before:', data);
    console.log('New form data to apply:', formData);
    
    // Extract essential properties that should be preserved
    const essentialProps = {
      id,
      position_x: data.position_x,
      position_y: data.position_y,
      label: data.label,
      type: data.type,
    };
    
    // Create completely new node data object - no merging with previous data
    const newNodeData = {
      ...essentialProps,  // Keep essential properties
      ...formData         // Add all new parameters
    };
    
    // Add original structure tracking if needed
    if (data._originalProperties) {
      // Create new _originalProperties array with only current properties
      newNodeData._originalProperties = [
        ...Object.keys(essentialProps),
        ...Object.keys(formData).filter(key => !Object.keys(essentialProps).includes(key))
      ];
    }
    
    console.log('Final node data to save (no old properties):', newNodeData);
    
    // Apply the changes - completely replacing old data
    onNodeDataChange(id, newNodeData);
  }, [id, data, onNodeDataChange]);
  // Get the background color based on execution status
  const getNodeBackgroundClass = () => {
    if (!executionStatus) return '';
    
    switch (executionStatus) {
      case 'completed':
        return 'bg-green-50';
      case 'failed':
        return 'bg-red-50';
      case 'pending':
        return 'bg-blue-50';
      case 'in_progress':
        return 'bg-amber-50';
      default:
        return '';
    }
  };

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
          } ${isDarkMode ? 'dark' : 'light'} ${isExecuting ? 'executing' : ''} ${getNodeBackgroundClass()}`}
          style={!isUCMode ? getNodeBorderStyle(nodeKind, nodeStatus, selected, isUCMode, isExecuting, executionStatus) : {}}
        >
          <div className={`node-content ${isDarkMode ? 'dark' : 'light'}`}>
            <div style={{ fontSize: '30px', position: 'relative' }}>
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
              
              {/* Add spinner when node is executing */}
              {isExecuting && (
                <div className="executing-spinner">
                  <Loader2 className="h-8 w-8 text-amber-500 animate-spin absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
              )}
            </div>
          </div>

          {/* Show log bar for all nodes with execution responses, not just selected ones */}
          {(data.executionResponse || data?.status) && (
            <div className="log-bar">
              <span className="green-dot" style={logoDotStyle}></span>
              <div className="marquee-container">
                <div className="marquee-text">{logMessage}</div>
              </div>
            </div>
          )}
          {renderHandles()}
        </Card>

        {/* Add status icon outside the node */}
        {getStatusIcon()}

        <div className="node-label" style={{ color: isDarkMode ? '#fff' : '#555' }}>
          {data?.type || nodeType || id}
        </div>
        
        {/* Add execution status badge if available */}
        {executionStatus && (
          <div className={`node-status-badge node-status-${executionStatus}`}>
            {executionStatus}
          </div>
        )}
      </div>

      {/* Use DraggablePanels instead of NodeSettingsSheet */}
      <DraggablePanels
        isOpen={isModalOpen}
        onClose={handleModalClose}
        customSettings={customSettings}
        onSave={handleNodeSave}
        workflowId={data?.workflowId || ''}
        nodeId={id}
        nodeName={data?.type || nodeType || id}
        nodeDescription={data?.description || ''}
        nodeData={data}
        connectedInputNodes={connectedInputNodes}
      />
    </>
  );
});

BaseNode.displayName = 'BaseNode';

export default BaseNode;