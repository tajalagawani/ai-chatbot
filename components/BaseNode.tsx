// Enhanced BaseNode.tsx with Results Modal and Connected Nodes
import React, { memo, FC, useState, useEffect, useCallback, useMemo } from 'react';
import { Handle, Position, NodeProps, Node, Edge } from 'reactflow';
import { useTheme } from 'next-themes';
import { Card } from '@/components/ui/card';
import { 
  Box, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  FileText, 
  X 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [logMessage, setLogMessage] = useState('No execution response yet');
  const [nodeStatus, setNodeStatus] = useState('Staging');
  const [iconSrc, setIconSrc] = useState<string | null>(null);
  const [showErrorTooltip, setShowErrorTooltip] = useState(false);
  const [connectedInputNodes, setConnectedInputNodes] = useState<Node[]>([]);
  const { theme, systemTheme } = useTheme();

  // Derived state
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
  const isUCMode = data mode = 'UC';
  
  // Check if node is currently executing
  const isExecuting = data?.executionStatus === 'executing';

  // Get the node status from data if available
  const executionStatus = data?.status?.status || null;
  
  // Extract node results (new)
  const nodeResult = useMemo(() => {
    if (!data.result) return null;
    return data.result;
  }, [data.result]);
  
  // Check if node has results
  const hasResults = !!nodeResult;
  
  // Format node results for display
  const formattedResults = useMemo(() => {
    if (!nodeResult) return "No results available";
    
    try {
      if (typeof nodeResult === 'string') {
        return nodeResult;
      } else if (typeof nodeResult === 'object') {
        // Format different result types specially
        if (nodeResult.result?.choices?.[0]?.message?.content) {
          // For AI nodes like OpenAI, emphasize the content
          return {
            content: nodeResult.result.choices[0].message.content,
            metadata: JSON.stringify(nodeResult, null, 2)
          };
        } else if (nodeResult.body) {
          // For API requests, highlight the body
          return {
            summary: typeof nodeResult.body === 'string' ? nodeResult.body : 
                     JSON.stringify(nodeResult.body, null, 2),
            metadata: JSON.stringify(nodeResult, null, 2)
          };
        } else {
          // Default formatting
          return JSON.stringify(nodeResult, null, 2);
        }
      } else {
        return String(nodeResult);
      }
    } catch (e) {
      return "Error formatting results: " + String(e);
    }
  }, [nodeResult]);
  
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

  // Memoized connected nodes with properly formatted data
  const memoizedConnectedNodes = useMemo(() => {
    if (!allEdges || !allNodes) return [];
    
    const sourceNodes = allEdges
      .filter(edge => edge.target === id)
      .map(edge => {
        const sourceNode = allNodes.find(node => node.id === edge.source);
        if (sourceNode) {
          // Create enhanced node with both node structure and result data
          const enhancedNode = {
            ...sourceNode,
            // Add result at top level for components that expect it there
            result: sourceNode.data?.result || null,
            // Add executionResponse at top level 
            executionResponse: sourceNode.data?.executionResponse || null,
            // Also update the data object to include these properties
            data: {
              ...sourceNode.data,
              // Include result in data object
              result: sourceNode.data?.result || null,
              // Include executionResponse in data object
              executionResponse: sourceNode.data?.executionResponse || null
            }
          };
          
          console.log(`Source node ${sourceNode.id} data:`, {
            hasTopLevelResult: !!enhancedNode.result,
            hasDataResult: !!enhancedNode.data.result,
            resultType: enhancedNode.result ? typeof enhancedNode.result : 'none',
            resultPreview: enhancedNode.result ? 
              (typeof enhancedNode.result === 'object' ? 
               JSON.stringify(enhancedNode.result).substring(0, 100) + '...' : 
               String(enhancedNode.result).substring(0, 100) + '...') : 
              'none'
          });
          
          return enhancedNode;
        }
        return undefined;
      })
      .filter((node): node is Node => node !== undefined);
    
    console.log('Memoized connected input nodes for', id, ':', sourceNodes.map(node => ({
      id: node.id,
      hasResult: !!node.result,
      hasExecutionResponse: !!node.executionResponse, 
      hasDataResult: !!node.data.result,
      hasDataExecutionResponse: !!node.data.executionResponse
    })));
    
    return sourceNodes;
  }, [id, allNodes, allEdges]);

  // Update connected nodes state whenever the memoized value changes
  useEffect(() => {
    if (memoizedConnectedNodes.length > 0) {
      console.log(`Setting connected input nodes for ${id}:`, 
        memoizedConnectedNodes.map(node => node.id));
      setConnectedInputNodes(memoizedConnectedNodes);
    }
  }, [memoizedConnectedNodes, id]);

  const logoDotStyle = useMemo(() => {
    if (!data.executionResponse) return {};
    if (data.executionResponse?.result?.status === 'error' || data.executionResponse?.error) {
      return { backgroundColor: '#f44336' };
    }
    return {};
  }, [data.executionResponse]);

  // Handler for showing results modal
  const handleResultsIconClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (hasResults || executionStatus === 'failed' || executionStatus === 'completed') {
      setIsResultsModalOpen(true);
    }
  }, [hasResults, executionStatus]);

  // Get status icon based on execution status
  const getStatusIcon = useCallback(() => {
    if (!executionStatus) return null;
    
    switch (executionStatus) {
      case 'completed':
        return (
          <div 
            className="status-icon clickable-icon"
            onClick={handleResultsIconClick}
            title="View node results"
          >
            <CheckCircle className="h-4 w-4 status-icon-completed" />
          </div>
        );
      case 'failed':
        return (
          <div 
            className="status-icon error-status-icon clickable-icon"
            onClick={handleResultsIconClick}
            title={errorMessage || "View error details"}
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
  }, [executionStatus, errorMessage, handleResultsIconClick]);

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
      };
    }

    // If we have execution status, use that for styling
    if (executionStatus) {
      const baseStyle = { border: '0.5px solid' };
      const styleWithShadow = (borderColor: string, shadowColor: string) => ({
        ...baseStyle,
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
    const baseStyle = {  };
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

  // Function to find connected input nodes using global flow data
  // This is a fallback method if the memoized nodes aren't available
  const findConnectedInputNodes = useCallback(() => {
    // First try to use the memoized nodes (preferred method)
    if (memoizedConnectedNodes.length > 0) {
      console.log("Using memoized connected nodes:", memoizedConnectedNodes);
      return memoizedConnectedNodes;
    }
    
    // If no memoized nodes, try using global flow data
    const flowNodes = window._flowNodes || [];
    const flowEdges = window._flowEdges || [];
    
    console.log("Falling back to global flow data:", 
      flowNodes.length, "nodes and", flowEdges.length, "edges");
    
    // Find all edges where this node is the target
    const incomingEdges = flowEdges.filter(edge => edge.target === id);
    console.log("Incoming edges for node", id, ":", incomingEdges);
    
    // Get source nodes for these edges
    const sourceNodes = incomingEdges
      .map(edge => {
        const sourceNode = flowNodes.find(node => node.id === edge.source);
        if (sourceNode) {
          // Create enhanced node with both node structure and result data
          return {
            ...sourceNode,
            // Add result at top level for components that expect it there
            result: sourceNode.result || sourceNode.data?.result || null,
            // Add executionResponse at top level 
            executionResponse: sourceNode.executionResponse || sourceNode.data?.executionResponse || null,
            // Also update the data object to include these properties
            data: {
              ...sourceNode.data,
              // Include result in data object
              result: sourceNode.data?.result || sourceNode.result || null,
              // Include executionResponse in data object
              executionResponse: sourceNode.data?.executionResponse || sourceNode.executionResponse || null
            }
          };
        }
        return undefined;
      })
      .filter(Boolean);
    
    console.log('Connected input nodes from global data for', id, ':', sourceNodes);
    return sourceNodes;
  }, [id, memoizedConnectedNodes]);

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
    
    // Second priority: Check for node result data
    if (nodeResult) {
      let resultSummary = '';
      
      if (typeof nodeResult === 'string') {
        resultSummary = nodeResult.substring(0, 150) + (nodeResult.length > 150 ? '...' : '');
      } else if (typeof nodeResult === 'object') {
        if (nodeResult.result?.choices?.[0]?.message?.content) {
          // For AI nodes like OpenAI, show the generated content
          resultSummary = nodeResult.result.choices[0].message.content;
        } else if (nodeResult.body) {
          // For API requests, show a summary of the response
          resultSummary = `Response: ${JSON.stringify(nodeResult.body).substring(0, 150)}...`;
        } else {
          // Fallback: stringify the full result
          resultSummary = JSON.stringify(nodeResult).substring(0, 150) + '...';
        }
      } else {
        resultSummary = String(nodeResult).substring(0, 150) + '...';
      }
      
      setLogMessage(resultSummary);
      return;
    }
    
    // Third priority: Show execution response details if available
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
            // For API requests, show a summary of the response
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
    
    // Fourth priority: Show status message if available
    if (data?.status?.message) {
      setLogMessage(data.status.message);
      return;
    }
    
    // Default message if nothing else is available
    setLogMessage('No execution response yet');
  }, [data.executionResponse, data?.status, data.id, errorMessage, nodeResult]);

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
        executionResponse: data.executionResponse,
        result: nodeResult
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
    if (nodeResult) {
      console.log('✅ Execution Result:', nodeResult);
    }
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
    allEdges,
    nodeResult
  ]);

  // Event handlers
  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Log all node data
    const nodeData = logNodeData();
    console.log('Complete node data on double-click:', nodeData);
    
    // Update connected nodes before opening the modal
    // First check if we already have connected nodes
    if (connectedInputNodes.length === 0) {
      // If not, find them now
      const inputNodes = findConnectedInputNodes();
      setConnectedInputNodes(inputNodes);
      console.log('Input nodes set before opening modal:', inputNodes);
    } else {
      console.log('Using existing connected nodes:', connectedInputNodes);
    }
    
    // Open node settings modal
    setIsModalOpen(true);
  }, [logNodeData, findConnectedInputNodes, connectedInputNodes]);

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

  // Render the results modal content
  const renderResultsModalContent = () => {
    // First show errors if they exist
    if (errorMessage) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <h3 className="text-sm font-medium text-red-700 mb-2">Error</h3>
          <div className="whitespace-pre-wrap text-sm text-red-800">{errorMessage}</div>
        </div>
      );
    }
    
    // If no results available, show a message
    if (!nodeResult) {
      return (
        <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-600">
          No detailed results available for this node.
        </div>
      );
    }

    // Otherwise format the results
    if (typeof formattedResults === 'string') {
      return (
        <pre className="bg-slate-50 p-4 rounded-md overflow-auto max-h-96 text-sm">
          {formattedResults}
        </pre>
      );
    } else if (typeof formattedResults === 'object') {
      return (
        <div className="space-y-4">
          {formattedResults.content && (
            <div className="bg-white border border-green-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-green-700 mb-2">Content</h3>
              <div className="whitespace-pre-wrap text-sm">{formattedResults.content}</div>
            </div>
          )}
          
          {formattedResults.summary && (
            <div className="bg-white border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-700 mb-2">Summary</h3>
              <div className="whitespace-pre-wrap text-sm">{formattedResults.summary}</div>
            </div>
          )}
          
          {formattedResults.metadata && (
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-2">Full Response</h3>
              <pre className="overflow-auto max-h-60 text-xs">{formattedResults.metadata}</pre>
            </div>
          )}
        </div>
      );
    }
    
    return <div>No results available</div>;
  };

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
                </div>
              )}
              
              {/* Add results icon if results are available */}
              {hasResults && (
                <div 
                  className="results-icon"
                  onClick={handleResultsIconClick}
                  title="View node results"
                >
                  <FileText className="h-5 w-5 text-blue-500 hover:text-blue-700 transition-colors cursor-pointer" />
                </div>
              )}
            </div>
          </div>

{/* Show log bar for all nodes with execution responses, not just selected ones */}
{(data.executionResponse || data?.status || nodeResult) && (
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
        
        {/* Add clickable execution status badge */}
        {executionStatus && (
          <div 
            className={`node-status-badge node-status-${executionStatus} clickable-badge`}
            onClick={handleResultsIconClick}
            title="Click to view node details"
          >
            {executionStatus}
          </div>
        )}
      </div>

      {/* Use DraggablePanels for node settings */}
      <DraggablePanels
        isOpen={isModalOpen}
        onClose={handleModalClose}
        customSettings={customSettings}
        onSave={handleNodeSave}
        workflowId={data?.workflowId || ''}
        nodeId={id}
        nodeName={data?.type || nodeType || id}
        nodeDescription={data?.description || ''}
        nodeData={{
          ...data,
          result: nodeResult // Ensure result is passed
        }}
        connectedInputNodes={connectedInputNodes} // Pass connected nodes to DraggablePanels
      />
      
      {/* Results Modal */}
      <Dialog open={isResultsModalOpen} onOpenChange={setIsResultsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              {data?.type || nodeType || id} Results
            </DialogTitle>
            <DialogDescription>
              Execution results for node ID: {id}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            {renderResultsModalContent()}
          </div>
          
          <div className="mt-6 flex justify-end">
            <DialogClose asChild>
              <Button className="bg-slate-100 text-slate-900 hover:bg-slate-200">
                Close
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add styles for clickable elements */}
      <style jsx global>{`
        .results-icon {
          position: absolute;
          bottom: -6px;
          right: -6px;
          background-color: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .results-icon:hover {
          transform: scale(1.1);
          box-shadow: 0 3px 6px rgba(0,0,0,0.15);
        }
        
        .dark .results-icon {
          background-color: #1f2937;
          border-color: #374151;
        }
        
        .clickable-badge {
          cursor: pointer;
          transition: transform 0.2s;
        }
        
       .clickable-badge:hover {
          transform: translateX(-50%) scale(1.05);
        }
        
        .clickable-icon {
          cursor: pointer;
          transition: transform 0.2s;
        }
        
        .clickable-icon:hover {
          transform: scale(1.1);
        }
      `}</style>
    </>
  );
});

BaseNode.displayName = 'BaseNode';

export default BaseNode;