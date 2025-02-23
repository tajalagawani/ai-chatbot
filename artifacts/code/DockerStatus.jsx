'use client';

import React from 'react';

// Docker Status Component
const DockerStatus = ({ 
  status,
  containerId,
  port
}) => {
  const statusIndicators = {
    'ready': { color: 'bg-green-50 text-green-700', dot: 'bg-green-500', text: 'Docker Ready' },
    'unavailable': { color: 'bg-red-50 text-red-700', dot: 'bg-red-500', text: 'Docker Unavailable' },
    'running': { color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500', text: 'Container Running' },
    'stopped': { color: 'bg-gray-50 text-gray-700', dot: 'bg-gray-500', text: 'Container Stopped' },
    'error': { color: 'bg-red-50 text-red-700', dot: 'bg-red-500', text: 'Container Error' },
    'pending': { color: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-500', text: 'Container Pending' }
  };

  // Use 'stopped' as fallback if status is undefined or not in statusIndicators
  const indicator = statusIndicators[status] || statusIndicators['stopped'];

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${indicator.color}`}>
      <div className={`w-2 h-2 rounded-full animate-pulse ${indicator.dot}`} />
      <span className="text-sm font-medium">{indicator.text}</span>
      {containerId && status === 'running' && (
        <>
          <span className="text-xs opacity-75 ml-1">ID: {containerId.substring(0, 8)}</span>
          {port && <span className="text-xs opacity-75 ml-1">Port: {port}</span>}
        </>
      )}
    </div>
  );
};

export default DockerStatus;