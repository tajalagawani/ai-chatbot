import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE_URL = 'http://localhost:5088/api';

const NodePanelHeader = ({ nodeType, nodeData }) => {
  const [nodeInfo, setNodeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Format node type - convert camelCase to lowercase simple name
  const formatNodeType = (type) => {
    if (!type || type === 'unknown') return 'unknown';
    
    const commonSuffixes = /(Node|Assistant|Api|Service|Provider|Generator|Processor)$/i;
    let simplified = type.replace(commonSuffixes, '');
    
    if (simplified.toLowerCase() === 'openai') return 'openai';
    if (simplified.toLowerCase() === 'claude') return 'claude';
    
    return simplified.toLowerCase();
  };

  // Formatted node type for API calls
  const formattedNodeType = formatNodeType(nodeType);

  useEffect(() => {
    const fetchNodeInfo = async () => {
      if (!formattedNodeType || formattedNodeType === 'unknown') {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/nodes/${formattedNodeType}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch node info (HTTP ${response.status})`);
        }
        
        const data = await response.json();
        setNodeInfo(data);
      } catch (err) {
        console.error("Error fetching node info:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNodeInfo();
  }, [formattedNodeType]);

  // Format version string with v prefix if not present
  const formatVersion = (version) => {
    if (!version) return 'v?.?.?';
    return version.startsWith('v') ? version : `v${version}`;
  };

  return (
    <div className="mb-6 pb-4 ">
      <div className="flex items-start gap-4">
        {/* Node Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 dark:from-blue-500/10 dark:to-purple-500/10 flex items-center justify-center shadow-sm">
          <Package className="h-6 w-6 text-blue-500 dark:text-blue-400" />
        </div>

        {/* Node Info */}
        <div className="flex-grow">
          {loading ? (
            <>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-full max-w-sm mb-2" />
            </>
          ) : error ? (
            <div className="text-red-500 text-sm">
              <p className="font-medium">Error loading node info</p>
              <p>{error}</p>
            </div>
          ) : nodeInfo ? (
            <>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{nodeInfo.name || nodeType}</h2>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                  {formatVersion(nodeInfo.version)}
                </Badge>
              </div>
              
              <p className="text-sm text-muted-foreground mt-1 leading-tight">
                {nodeInfo.description || `${nodeType} node for connecting to external services`}
              </p>
            </>
          ) : (
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{nodeType || 'Unknown Node'}</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-tight">
                No additional information available
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NodePanelHeader;