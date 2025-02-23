import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState } from 'react';

const NodeSettingsSheet = ({ 
  isOpen, 
  onClose, 
  nodeData, 
  onSave 
}) => {
  const [formData, setFormData] = useState({
    label: nodeData?.label || '',
    nodeType: nodeData?.nodeType || '',
    operation: nodeData?.operation || '',
    operation_name: nodeData?.operation_name || '',
    ...nodeData?.formData
  });

  const handleInputChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...nodeData,
      label: formData.label,
      operation: formData.operation,
      operation_name: formData.operation_name,
      formData: {
        ...formData
      }
    });
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl font-bold">
            Node Settings: {nodeData?.label || 'Untitled Node'}
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-200px)] mt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="label">Node Label</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => handleInputChange('label', e.target.value)}
                  placeholder="Enter node label"
                />
              </div>

              <div>
                <Label>Node Type</Label>
                <Input
                  value={formData.nodeType}
                  disabled
                  className="bg-muted"
                />
              </div>

              <Separator className="my-4" />

              <div>
                <Label htmlFor="operation">Operation</Label>
                <Input
                  id="operation"
                  value={formData.operation}
                  onChange={(e) => handleInputChange('operation', e.target.value)}
                  placeholder="Enter operation"
                />
              </div>

              <div>
                <Label htmlFor="operation_name">Operation Name</Label>
                <Input
                  id="operation_name"
                  value={formData.operation_name}
                  onChange={(e) => handleInputChange('operation_name', e.target.value)}
                  placeholder="Enter operation name"
                />
              </div>

              {/* Additional form fields based on nodeType */}
              {nodeData?.nodeType === 'Input' && (
                <div>
                  <Label htmlFor="input_type">Input Type</Label>
                  <Input
                    id="input_type"
                    value={formData.input_type || ''}
                    onChange={(e) => handleInputChange('input_type', e.target.value)}
                    placeholder="Enter input type"
                  />
                </div>
              )}

              {nodeData?.nodeType === 'Output' && (
                <div>
                  <Label htmlFor="output_format">Output Format</Label>
                  <Input
                    id="output_format"
                    value={formData.output_format || ''}
                    onChange={(e) => handleInputChange('output_format', e.target.value)}
                    placeholder="Enter output format"
                  />
                </div>
              )}
            </div>

            <SheetFooter className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </SheetFooter>
          </form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default NodeSettingsSheet;