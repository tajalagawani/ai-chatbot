// components/NodeModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: {
    id: string;
    data: {
      label: string;
      operation: string;
      operation_name: string;
      params: Record<string, any>;
      node_type: string;
    };
  };
  onSaveParams: (nodeId: string, params: Record<string, any>) => void;
}

export const NodeModal = ({ isOpen, onClose, node, onSaveParams }: NodeModalProps) => {
  const [params, setParams] = useState<Record<string, string>>({});
  const [isEdited, setIsEdited] = useState(false);

  // Initialize params when node changes
  useEffect(() => {
    if (node && node.data.params) {
      setParams(node.data.params);
      setIsEdited(false);
    }
  }, [node]);

  const handleParamChange = (key: string, value: string) => {
    setParams(prev => ({
      ...prev,
      [key]: value
    }));
    setIsEdited(true);
  };

  const handleSave = () => {
    onSaveParams(node.id, params);
    setIsEdited(false);
    onClose();
  };

  const handleClose = () => {
    if (isEdited) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {node.data.label}
            <Badge variant="secondary" className="ml-2">
              {node.data.node_type}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="grid gap-2 mb-4">
            <div className="text-sm">
              <span className="font-semibold">Operation:</span> {node.data.operation_name}
            </div>
            <div className="text-sm text-muted-foreground">
           
              <span className="font-semibold">Node ID:</span> {node.id}
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-sm font-semibold">Parameters</div>
            {Object.entries(params).map(([key, value]) => (
              <div key={key} className="grid gap-2">
                <Label htmlFor={key} className="flex items-center gap-2">
                  {key}
                  {isEdited && (
                    <Badge variant="outline" className="text-xs">
                      Modified
                    </Badge>
                  )}
                </Label>
                <Input
                  id={key}
                  value={value}
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
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isEdited}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NodeModal;