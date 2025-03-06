/* eslint-disable prettier/prettier */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState, useCallback, useMemo } from "react";
import { Modal, Box, Paper, Card } from "@mui/material";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { IconGridDots, IconX } from "@tabler/icons-react";

import OutputPane from "./OutputPane";
import InputPane from "./InputPane";

interface DraggablePanelsProps {
  isOpen: boolean;
  onClose: () => void;
  nodeName: string;
  nodeDescription: string;
  customSettings: React.ReactElement<{
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
    nodeData,
    connectedInputNodes,
  }) => {
    const { theme, systemTheme } = useTheme();
    const isDarkMode = theme === "dark" || (theme === "system" && systemTheme === "dark");
    const [executionResponse, setExecutionResponse] = useState<any>(null);
    const [isFullView, setIsFullView] = useState(true);
    const [activeTab, setActiveTab] = useState('settings');
    const [isDragging, setIsDragging] = useState(false);

    const containerWidth = 2000;
    const minimumBoxWidth = 500;
    const minimumMiddleBoxWidth = 500;

    const [sizes, setSizes] = useState({
      leftWidth: 700,
      rightWidth: 700,
    });

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
                width: isFullView ? "100vw" : "450px",
                height: "100vh",
                margin: 0,
                padding: 0,
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
                    borderRadius: 0,
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
                    }}
                  >
                    <Paper
                      sx={{
                        width: sizes.leftWidth,
                        height: "92%",
                        overflow: "hidden",
                        background: isDarkMode ? 'rgba(3, 3, 3, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        borderRadius: 0,
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
                        background: isDarkMode ? 'rgba(11, 12, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        borderRadius: "16px",
                        border: `1px solid ${isDarkMode ? '#0d1116' : '#e0e0e0'}`,
                        zIndex: 2,
                        boxShadow: isDarkMode 
                          ? '0 12px 40px rgba(0, 0, 0, 0.5)'
                          : '0 12px 40px rgba(0, 0, 0, 0.15)',
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <button
                        onClick={onClose}
                        className={`absolute top-2 left-2 w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 relative group ${
                          isDragging ? 'pointer-events-none' : ''
                        }`}
                        style={{
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <IconX size={8} className="text-red-800" />
                        </span>
                      </button>
                      <div
                        className={`bg-default-100 text-center flex items-center justify-center mx-auto p-1 w-8 h-4 min-h-4 cursor-move ${
                          isDragging ? 'select-none' : ''
                        }`}
                        onMouseDown={handleMouseDown}
                      >
                        <IconGridDots 
                          size="small"
                          style={{ transform: 'rotate(90deg) scale(0.67)' }}
                        />
                      </div>
                      {customSettings && React.cloneElement(customSettings, {
                        workflowId,
                        nodeData,
                        onSave,
                        onExecutionComplete: handleExecutionComplete,
                      })}
                    </Card>
                    <Paper
                      sx={{
                        width: sizes.rightWidth,
                        height: "92%",
                        overflow: "hidden",
                        borderRadius: 0,
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
                    borderRadius: "16px",
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
                      customSettings && React.cloneElement(customSettings, {
                        workflowId,
                        nodeData,
                        onSave,
                        onExecutionComplete: handleExecutionComplete,
                      })
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