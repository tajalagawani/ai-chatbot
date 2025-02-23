'use client';

import React, { useState, useRef, useEffect } from 'react';

/**
 * CompactToolbar - A VS Code-like compact toolbar component
 */
const CompactToolbar = ({ 
  actions, 
  content, 
  metadata, 
  setMetadata,
  currentVersionIndex = 0,
  isCurrentVersion = true,
  handleVersionChange,
  appendMessage
}) => {
  const [tooltip, setTooltip] = useState({ visible: false, item: null, x: 0, y: 0 });
  const toolbarRef = useRef(null);

  // Hide tooltip when scrolling
  useEffect(() => {
    const handleScroll = () => {
      setTooltip({ visible: false, item: null, x: 0, y: 0 });
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const showTooltip = (e, item) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      visible: true,
      item,
      x: rect.left + rect.width / 2, // Center tooltip below button
      y: rect.bottom + 5
    });
  };

  const hideTooltip = () => {
    setTooltip({ visible: false, item: null, x: 0, y: 0 });
  };

  return (
    <div className="artifact-actions-toolbar" ref={toolbarRef}>
      {actions.map((action, index) => {
        const isDisabled = action.isDisabled ? 
          action.isDisabled({ 
            metadata, 
            content, 
            currentVersionIndex, 
            isCurrentVersion 
          }) : false;
          
        return (
          <button
            key={index}
            className="artifact-action-button"
            onClick={() => {
              if (!isDisabled) {
                action.onClick({
                  content,
                  metadata,
                  setMetadata,
                  currentVersionIndex,
                  handleVersionChange,
                  appendMessage
                });
              }
            }}
            disabled={isDisabled}
            aria-label={action.label}
            onMouseEnter={(e) => showTooltip(e, action)}
            onMouseLeave={hideTooltip}
          >
            {action.icon}
            <span className="artifact-action-button-label">{action.label}</span>
          </button>
        );
      })}
      
      {/* Tooltip */}
      {tooltip.visible && tooltip.item && (
        <div 
          className="artifact-tooltip"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="artifact-tooltip-title">{tooltip.item.label}</div>
          {tooltip.item.description && (
            <div className="artifact-tooltip-description">{tooltip.item.description}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompactToolbar;