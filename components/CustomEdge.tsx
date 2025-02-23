import React, { useMemo } from 'react';
import { BaseEdge, getStraightPath, getBezierPath, getSmoothStepPath, useReactFlow } from 'reactflow';

const DISTANCE_THRESHOLD = 150;

interface CustomEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: any;
  targetPosition: any;
  style?: React.CSSProperties;
  markerEnd?: string;
  source: string;
  target: string;
  selected?: boolean;
}

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  source,
  target,
  selected,
}: CustomEdgeProps) {
  const [edgePath, labelX, labelY] = useMemo(() => {
    const deltaX = targetX - sourceX;
    const deltaY = targetY - sourceY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    const isBackwardHorizontal = targetX < sourceX;

    if (isBackwardHorizontal) {
      return getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 20,
        offset: 40,
      });
    } else if (distance < DISTANCE_THRESHOLD) {
      return getStraightPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
      });
    } else {
      return getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
    }
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

  const isBackward = parseInt(target.split('-')[1]) < parseInt(source.split('-')[1]);

  const edgeStyle = {
    strokeWidth: 2,
    stroke: isBackward ? '#7f8185' : '#7f8185',
    strokeDasharray: selected ? '4, 4' : 'none',
    animation: selected ? 'dash-animation 1s linear infinite' : 'none',
    // Remove transition to prevent delay
    transition: 'none'
  };

  const arrowId = `arrow-${id}`;

  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const { setEdges } = useReactFlow();

  return (
    <>
      <defs>
        <marker
          id={arrowId}
          markerWidth="10"
          markerHeight="10"
          refX="6"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,10 L8,5 z" fill={edgeStyle.stroke} />
        </marker>
        <style>
          {`
            @keyframes dash-animation {
              to {
                stroke-dashoffset: -10;
              }
            }
          `}
        </style>
      </defs>
      <BaseEdge 
        path={edgePath} 
        markerEnd={`url(#${arrowId})`} 
        style={edgeStyle} 
      />
      <circle
        cx={sourceX}
        cy={sourceY}
        fill="#fff"
        r={2.5}
        stroke={edgeStyle.stroke}
        strokeWidth={1}
      />
      <circle
        cx={targetX}
        cy={targetY}
        fill="#fff"
        r={2.5}
        stroke={edgeStyle.stroke}
        strokeWidth={1}
      />
      {selected && (
        <g>
          <circle
            cx={midX}
            cy={midY}
            r={10}
            fill="gray"
            stroke="white"
            strokeWidth={1}
          />
          <text
            x={midX}
            y={midY}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', fill: 'white' }}
            onClick={() => {
              setEdges((es) => es.filter((e) => e.id !== id));
            }}
          >
            ✕
          </text>
        </g>
      )}
    </>
  );
}