import React, { useState, useEffect } from 'react';
import DraggablePanel from './DraggablePanel';
import NodeSettings from './NodeSettings';

interface Panel {
  id: string;
  type: 'nodeSettings' | 'inspector' | 'custom';
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data?: any;
  zIndex: number;
}

interface PanelManagerProps {
  workflowId: string;
  onSaveNodeSettings?: (nodeId: string, data: any) => void;
  onNodeExecutionComplete?: (nodeId: string, result: any) => void;
}

const PanelManager: React.FC<PanelManagerProps> = ({
  workflowId,
  onSaveNodeSettings,
  onNodeExecutionComplete
}) => {
  // State for managing multiple panels
  const [panels, setPanels] = useState<Panel[]>([]);
  const [topZIndex, setTopZIndex] = useState(100);
  
  // Example function to open a node settings panel
  const openNodeSettingsPanel = (nodeId: string, nodeData: any) => {
    // Check if panel already exists for this node
    const existingPanelIndex = panels.findIndex(
      (panel) => panel.type === 'nodeSettings' && panel.data?.nodeId === nodeId
    );
    
    if (existingPanelIndex !== -1) {
      // Bring existing panel to front
      bringPanelToFront(panels[existingPanelIndex].id);
      return;
    }
    
    // Calculate position for new panel (staggered)
    const offset = panels.length * 20;
    const newPosition = { x: 100 + offset, y: 100 + offset };
    
    // Create new panel
    const newPanel: Panel = {
      id: `node-settings-${nodeId}`,
      type: 'nodeSettings',
      title: `Settings: ${nodeData.nodeType || 'Node'} ${nodeId.slice(0, 6)}`,
      position: newPosition,
      size: { width: 400, height: 600 },
      data: {
        nodeId,
        nodeData
      },
      zIndex: topZIndex + 1
    };
    
    // Add panel and update top z-index
    setPanels([...panels, newPanel]);
    setTopZIndex(topZIndex + 1);
  };
  
  // Example function to open a custom panel
  const openCustomPanel = (title: string, content: React.ReactNode, size?: { width: number; height: number }) => {
    // Calculate position for new panel (staggered)
    const offset = panels.length * 20;
    const newPosition = { x: 100 + offset, y: 100 + offset };
    
    // Create new panel
    const newPanel: Panel = {
      id: `custom-${Date.now()}`,
      type: 'custom',
      title,
      position: newPosition,
      size: size || { width: 400, height: 500 },
      data: {
        content
      },
      zIndex: topZIndex + 1
    };
    
    // Add panel and update top z-index
    setPanels([...panels, newPanel]);
    setTopZIndex(topZIndex + 1);
  };
  
  // Bring a panel to the front
  const bringPanelToFront = (panelId: string) => {
    setPanels(
      panels.map((panel) => ({
        ...panel,
        zIndex: panel.id === panelId ? topZIndex + 1 : panel.zIndex
      }))
    );
    setTopZIndex(topZIndex + 1);
  };
  
  // Close a panel
  const closePanel = (panelId: string) => {
    setPanels(panels.filter((panel) => panel.id !== panelId));
  };
  
  // Update panel position
  const updatePanelPosition = (panelId: string, position: { x: number; y: number }) => {
    setPanels(
      panels.map((panel) =>
        panel.id === panelId ? { ...panel, position } : panel
      )
    );
  };
  
  // Update panel size
  const updatePanelSize = (panelId: string, size: { width: number; height: number }) => {
    setPanels(
      panels.map((panel) =>
        panel.id === panelId ? { ...panel, size } : panel
      )
    );
  };
  
  // Handle node settings save
  const handleSaveNodeSettings = (nodeId: string, newData: any) => {
    if (onSaveNodeSettings) {
      onSaveNodeSettings(nodeId, newData);
    }
  };
  
  // Handle node execution completion
  const handleNodeExecutionComplete = (nodeId: string, result: any) => {
    if (onNodeExecutionComplete) {
      onNodeExecutionComplete(nodeId, result);
    }
  };
  
  // Render all panels
  return (
    <div className="panel-manager">
      {panels.map((panel) => {
        // For node settings panels
        if (panel.type === 'nodeSettings' && panel.data?.nodeId && panel.data?.nodeData) {
          return (
            <DraggablePanel
              key={panel.id}
              id={panel.id}
              title={panel.title}
              initialPosition={panel.position}
              initialSize={panel.size}
              zIndex={panel.zIndex}
              onClose={() => closePanel(panel.id)}
              onFocus={() => bringPanelToFront(panel.id)}
            >
              <NodeSettings
                workflowId={workflowId}
                nodeId={panel.data.nodeId}
                nodeData={panel.data.nodeData}
                onSave={(newData) => handleSaveNodeSettings(panel.data.nodeId, newData)}
                onExecutionComplete={(result) => handleNodeExecutionComplete(panel.data.nodeId, result)}
              />
            </DraggablePanel>
          );
        }
        
        // For custom panels
        if (panel.type === 'custom' && panel.data?.content) {
          return (
            <DraggablePanel
              key={panel.id}
              id={panel.id}
              title={panel.title}
              initialPosition={panel.position}
              initialSize={panel.size}
              zIndex={panel.zIndex}
              onClose={() => closePanel(panel.id)}
              onFocus={() => bringPanelToFront(panel.id)}
            >
              {panel.data.content}
            </DraggablePanel>
          );
        }
        
        return null;
      })}
    </div>
  );
};

// Export main component
export default PanelManager;

// Also export utility functions for external use
export const panelManager = {
  openNodeSettings: (nodeId: string, nodeData: any) => {
    // This is a placeholder - actual implementation would need to use context or another state management solution
    console.log('Open node settings for', nodeId, nodeData);
  },
  openCustomPanel: (title: string, content: React.ReactNode) => {
    // This is a placeholder - actual implementation would need to use context or another state management solution
    console.log('Open custom panel', title);
  }
};