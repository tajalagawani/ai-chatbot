// CustomNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

const CustomNode = ({ data, selected }: NodeProps) => {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        background: '#f5f5f5',
        border: '2px solid #333',
        width: 250,
        boxShadow: selected ? '0 0 10px rgba(0,0,0,0.3)' : 'none'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 5 }}>{data.label}</div>
      <div>{data.description}</div>
      {/* Optional: Add handles for connections */}
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
};

export default CustomNode;
