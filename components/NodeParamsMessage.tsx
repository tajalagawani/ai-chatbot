// components/NodeParamsMessage.tsx
import { useState } from 'react';
import { Message } from 'ai';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NodeData {
  id: string;
  label: string;
  operation: string;
  operation_name: string;
  params: Record<string, any>;
  node_type: string;
}

interface NodeParamsMessageProps {
  message: Message;
  onUpdateParams: (nodeId: string, params: Record<string, any>, originalContent: string) => void;
}

export function NodeParamsMessage({ message, onUpdateParams }: NodeParamsMessageProps) {
  const nodeData: NodeData = message.data?.node;
  const originalContent: string = message.data?.original_content;
  const [params, setParams] = useState<Record<string, any>>(nodeData?.params || {});
  const [isEdited, setIsEdited] = useState(false);

  if (!nodeData) return null;

  const handleParamChange = (key: string, value: string) => {
    setParams(prev => ({
      ...prev,
      [key]: value
    }));
    setIsEdited(true);
  };

  const handleSave = () => {
    onUpdateParams(nodeData.id, params, originalContent);
    setIsEdited(false);
  };

  return (
    <Card className="p-4 bg-muted/50">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{nodeData.label}</h3>
          <Badge variant="secondary">{nodeData.node_type}</Badge>
        </div>

        {/* Node Info */}
        <div className="text-sm text-muted-foreground">
          <div>Operation: {nodeData.operation_name}</div>
          <div>Node ID: {nodeData.id}</div>
        </div>

        {/* Parameters Form */}
        <div className="space-y-4">
          <div className="text-sm font-medium">Parameters</div>
          {Object.entries(params).map(([key, value]) => (
            <div key={key} className="grid gap-2">
              <Label htmlFor={key} className="flex items-center gap-2">
                {key}
                {isEdited && (
                  <Badge variant="outline" className="text-xs">Modified</Badge>
                )}
              </Label>
              <Input
                id={key}
                value={value?.toString() || ''}
                onChange={(e) => handleParamChange(key, e.target.value)}
                placeholder={`Enter value for ${key}`}
                className="w-full"
              />
            </div>
          ))}

          {Object.keys(params).length === 0 && (
            <div className="text-sm text-muted-foreground italic">
              No parameters defined for this node
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setParams(nodeData.params);
              setIsEdited(false);
            }}
            disabled={!isEdited}
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isEdited}
          >
            Update Parameters
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default NodeParamsMessage;