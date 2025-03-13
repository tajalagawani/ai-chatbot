/* eslint-disable prettier/prettier */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Modal, Box, Paper, Card } from "@mui/material";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { IconGridDots } from "@tabler/icons-react";
import { X } from "lucide-react";

import DynamicNodeSettings from "./DynamicNodeSettings";
import OutputPane from "./OutputPane";
import InputPane from "./InputPane";

interface DraggablePanelsProps {
  isOpen: boolean;
  onClose: () => void;
  nodeName: string;
  nodeDescription: string;
  customSettings?: React.ReactElement<{
    onDragEnd: (event: DragEndEvent) => void;
    workflowId?: string;
    nodeData?: any;
    onSave?: (newData: any) => void;
    onExecutionComplete?: (response: any) => void;
  }> | null;
  onSave: (newData: any) => void;
  workflowId: string;
  nodeId: string;
  nodeData: any;
  connectedInputNodes: any[];
}

const DraggablePanels: React.FC<DraggablePanelsProps> = React.memo(
  ({
    isOpen,
    onClose,
    customSettings,
    onSave,
    workflowId,
    nodeId,
    nodeName,
    nodeDescription,
    nodeData,
    connectedInputNodes,
  }) => {
    const { theme, systemTheme } = useTheme();
    const isDarkMode = theme === "dark" || (theme === "system" && systemTheme === "dark");
    const [executionResponse, setExecutionResponse] = useState<any>(null);
    const [isFullView, setIsFullView] = useState(true);
    const [activeTab, setActiveTab] = useState('settings');
    const [isDragging, setIsDragging] = useState(false);

    // Fixed container width that won't change
    const containerWidth = 2800;
    const minimumBoxWidth = 600;
    const minimumMiddleBoxWidth = 780;

    // Use fixed sizes that won't change unless explicitly dragged
    const [sizes, setSizes] = useState({
      leftWidth: 1050,
      rightWidth: 1050,
    });

    // Reset sizes when modal opens
    useEffect(() => {
      if (isOpen) {
        setSizes({
          leftWidth: 1050,
          rightWidth: 1050,
        });
      }
    }, [isOpen]);

    const handleExecutionComplete = useCallback((response: any) => {
      setExecutionResponse(response);
    }, []);

    const handleMouseDown = useCallback(
      (event: React.MouseEvent) => {
        event.preventDefault();
        const startX = event.clientX;
        const startLeftWidth = sizes.leftWidth;
        setIsDragging(true);
        
        document.body.style.userSelect = 'none';
        document.body.style.WebkitUserSelect = 'none';
        document.body.style.MozUserSelect = 'none';
        document.body.style.msUserSelect = 'none';

        const handleMouseMove = (moveEvent: MouseEvent) => {
          moveEvent.preventDefault();
          const deltaX = moveEvent.clientX - startX;
          let newLeftWidth = Math.max(startLeftWidth + deltaX, minimumBoxWidth);
          let newRightWidth = containerWidth - newLeftWidth - minimumMiddleBoxWidth;

          if (newRightWidth < minimumBoxWidth) {
            newRightWidth = minimumBoxWidth;
            newLeftWidth = containerWidth - minimumMiddleBoxWidth - newRightWidth;
          }

          setSizes({
            leftWidth: newLeftWidth,
            rightWidth: newRightWidth,
          });
        };

        const handleMouseUp = () => {
          setIsDragging(false);
          document.body.style.userSelect = '';
          document.body.style.WebkitUserSelect = '';
          document.body.style.MozUserSelect = '';
          document.body.style.msUserSelect = '';
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
      },
      [sizes],
    );

    const handleDragEnd = useCallback(
      (event: DragEndEvent) => {
        if (customSettings && React.isValidElement(customSettings)) {
          customSettings.props.onDragEnd?.(event);
        }
      },
      [customSettings],
    );

    const memoizedInputPane = useMemo(
      () => (
        <InputPane
          connectedInputNodes={connectedInputNodes}
          nodeId={nodeId}
          workflowId={workflowId}
        />
      ),
      [nodeId, workflowId, connectedInputNodes],
    );

    const memoizedOutputPane = useMemo(
      () => (
        <OutputPane
          executionResponse={executionResponse}
          nodeId={nodeId}
          workflowId={workflowId}
        />
      ),
      [nodeId, workflowId, executionResponse],
    );

    const renderDynamicSettings = () => {
      // If custom settings are provided, use those instead
      if (customSettings) {
        return React.cloneElement(customSettings, {
          workflowId,
          nodeData,
          onSave,
          onExecutionComplete: handleExecutionComplete,
        });
      }
      
      // Otherwise render our dynamic settings
      return (
        <DynamicNodeSettings
          nodeData={nodeData}
          workflowId={workflowId}
          nodeId={nodeId}
          onSave={onSave}
          onExecutionComplete={handleExecutionComplete}
        />
      );
    };

    const renderPanelHeader = () => (
      <div className="flex items-center p-2">
        <div className="flex items-center gap-2 z-10">
          <span>{nodeName}</span>
        </div>
      </div>
    );

    return (
      <Modal
        open={isOpen}
        onClose={onClose}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          '& .MuiBackdrop-root': {
            backdropFilter: 'blur(18px)',
            backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          },
        }}
      >
        <DndContext onDragEnd={handleDragEnd}>
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                width: "calc(100vw - 50px)", // Changed to 10px margin on each side (20px total)
                height: "calc(105vh - 20px)", // Changed to 10px margin on top and bottom (20px total)
                paddingBottom: "20px", // Changed to 10px padding on bottom
              }}
              className={isDragging ? 'select-none' : ''}
            >
              {isFullView ? (
                <Paper
                  sx={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: 'transparent',
                    overflow: "hidden",
                    borderRadius: "8px",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  {renderPanelHeader()}
                  <Box
                    sx={{
                      display: "flex",
                      width: "100%",
                      height: "calc(100% - 48px)",
                      position: "relative",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Paper
                      sx={{
                        width: sizes.leftWidth,
                        height: "92%",
                        overflow: "hidden",
                        background: isDarkMode ? 'rgba(3, 3, 3, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        borderRadius: "8px 0 0 8px",
                        position: "relative",
                        zIndex: 1,
                        marginRight: "-8px",
                        userSelect: isDragging ? 'none' : 'text',
                      }}
                    >
                      {memoizedInputPane}
                    </Paper>
                    <Card
                      sx={{
                        width: minimumMiddleBoxWidth,
                        height: "100%",
                        overflow: "auto",
                        position: "relative",
                        background: isDarkMode ? '#09090b' : '#ffffff',
                        borderRadius: "8px",
                        border: isDarkMode ? '0.1px solid #2d2d2d' : '0.1px solid #e0e0e0',
                        zIndex: 2,
                        boxShadow: isDarkMode ? '0 12px 40px rgba(0, 0, 0, 0.5)' : '0 12px 40px rgba(0, 0, 0, 0.1)',
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <button
                        onClick={onClose}
                        className={`absolute top-3 right-3 text-gray-400 hover:text-white ${
                          isDragging ? 'pointer-events-none' : ''
                        }`}
                        style={{
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <X size={18} />
                      </button>
                      
                      {/* More visible drag handle */}
                      <div
                        className={`flex items-center justify-center mx-auto p-2 mt-1 mb-1 cursor-move border rounded-md ${
                          isDarkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-100'
                        } ${isDragging ? 'select-none' : ''}`}
                        onMouseDown={handleMouseDown}
                        style={{
                          width: '32px',
                          height: '20px',
                          backgroundColor: isDarkMode ? 'rgba(40, 40, 40, 0.9)' : 'rgba(240, 240, 240, 0.9)',
                        }}
                      >
                        <IconGridDots 
                          size={16}
                          style={{ transform: 'rotate(90deg)' }}
                          stroke={isDarkMode ? 'rgba(200, 200, 200, 0.9)' : 'rgba(100, 100, 100, 0.9)'}
                          strokeWidth={2.5}
                        />
                      </div>
                      
                      {/* Render our dynamic settings component */}
                      <div className="p-4 pt-2 flex-1 overflow-auto">
                        {renderDynamicSettings()}
                      </div>
                    </Card>
                    <Paper
                      sx={{
                        width: sizes.rightWidth,
                        height: "92%",
                        overflow: "hidden",
                        borderRadius: "0 2px 2px 0",
                        position: "relative",
                        background: isDarkMode ? 'rgba(3, 3, 3, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        zIndex: 1,
                        marginLeft: "-8px",
                        userSelect: isDragging ? 'none' : 'text',
                      }}
                    >
                      {memoizedOutputPane}
                    </Paper>
                  </Box>
                </Paper>
              ) : (
                <Paper
                  sx={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: isDarkMode ? 'rgba(11, 12, 18, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                    overflow: "hidden",
                    borderRadius: "8px",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  {renderPanelHeader()}
                  <motion.div 
                    className="flex-1 overflow-auto p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'settings' ? (
                      renderDynamicSettings()
                    ) : (
                      <div className="prose dark:prose-invert">
                        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                          {JSON.stringify(nodeData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </motion.div>
                </Paper>
              )}
            </motion.div>
          </AnimatePresence>
        </DndContext>
      </Modal>
    );
  }
);

DraggablePanels.displayName = "DraggablePanels";

export default DraggablePanels;