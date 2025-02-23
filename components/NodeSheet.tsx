// components/NodeSheet.tsx
import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from './ui/sheet';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, Settings, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useTheme } from 'next-themes';
import { Node } from 'reactflow';

interface NodeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  node: Node | null;
  onSaveParams: (nodeId: string, params: Record<string, any>) => void;
}

const NodeSheet: React.FC<NodeSheetProps> = ({ isOpen, onClose, node, onSaveParams }) => {
  const [params, setParams] = useState<Record<string, string>>({});
  const [isEdited, setIsEdited] = useState(false);
  const { theme, systemTheme } = useTheme();
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');

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
    if (node) {
      onSaveParams(node.id, params);
      setIsEdited(false);
      onClose();
    }
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

  // Get badge color based on node kind
  const getBadgeColor = () => {
    if (!node) return "";
    
    const nodeKind = node.data.nodeKind;
    switch (nodeKind) {
      case 'Input': return "bg-orange-100 text-orange-800 border-orange-200";
      case 'Core': return "bg-green-100 text-green-800 border-green-200";
      case 'Output': return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (!node) return null;

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent 
        className={`w-[400px] sm:w-[540px] overflow-y-auto ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white'}`}
        side="right"
      >
        <SheetHeader className="pb-4 relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-0 top-0" 
            onClick={onClose}
          >
            <X size={16} />
          </Button>
          
          <SheetTitle className="flex items-center gap-2 pr-8">
            {node.data.label}
            <Badge 
              variant="outline" 
              className={`ml-2 ${getBadgeColor()}`}
            >
              {node.data.nodeKind}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="params" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="params"><Settings className="mr-2" size={16} /> Parameters</TabsTrigger>
            <TabsTrigger value="info"><Info className="mr-2" size={16} /> Node Info</TabsTrigger>
          </TabsList>
          
          <TabsContent value="params" className="py-4">
            <div className="space-y-4">
              {Object.keys(params).length > 0 ? (
                Object.entries(params).map(([key, value]) => (
                  <div key={key} className="grid gap-2">
                    <Label htmlFor={key} className="flex items-center justify-between">
                      <span>{key}</span>
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
                ))
              ) : (
                <div className="text-sm text-muted-foreground italic">
                  No parameters defined for this node
                </div>
              )}
            </div>
            
            <SheetFooter className="mt-6">
              <div className="flex w-full gap-2 justify-end">
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
              </div>
            </SheetFooter>
          </TabsContent>
          
          <TabsContent value="info" className="py-4">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-1 py-2 border-b">
                <span className="font-semibold text-sm">Node ID:</span>
                <span className="col-span-2 font-mono text-xs">{node.id}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 py-2 border-b">
                <span className="font-semibold text-sm">Node Type:</span>
                <span className="col-span-2">{node.data.nodeType}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 py-2 border-b">
                <span className="font-semibold text-sm">Operation:</span>
                <span className="col-span-2">{node.data.operation || 'N/A'}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 py-2 border-b">
                <span className="font-semibold text-sm">Operation Name:</span>
                <span className="col-span-2">{node.data.operation_name || 'N/A'}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 py-2 border-b">
                <span className="font-semibold text-sm">Position:</span>
                <span className="col-span-2 font-mono text-xs">
                  x: {Math.round(node.position.x)}, y: {Math.round(node.position.y)}
                </span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default NodeSheet;