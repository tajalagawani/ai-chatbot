import React, { FC, useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Save, Info, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

interface NodeParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: any;
  enum?: string[] | null;
  min_value?: number | null;
  max_value?: number | null;
}

interface OperationSchema {
  node_type: string;
  operation: string;
  parameters: NodeParameter[];
  required: string[];
}

interface NodeSchema {
  node_type: string;
  version: string;
  description: string;
  parameters: NodeParameter[];
}

interface NodeSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  data: any;
  nodeType: string;
  onNodeDataChange: (id: string, newData: any) => void;
  onNodeDelete: (id: string) => void;
  onSave: (formData: any) => void;
}

const NodeSettingsSheet: FC<NodeSettingsSheetProps> = ({
  isOpen,
  onClose,
  nodeId,
  data,
  nodeType,
  onSave,
}) => {
  const [hasChanges, setHasChanges] = useState(false);
  const [localData, setLocalData] = useState({ ...data });
  const [schema, setSchema] = useState<NodeSchema | null>(null);
  const [operationSchema, setOperationSchema] = useState<OperationSchema | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [isLoadingOperationSchema, setIsLoadingOperationSchema] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [operationSchemaError, setOperationSchemaError] = useState<string | null>(null);
  const fetchTriggeredRef = useRef(false);
  const [selectedOperation, setSelectedOperation] = useState(localData?.params?.operation || '');
  const [availableOperations, setAvailableOperations] = useState<string[]>([]);
  const [isLoadingOperations, setIsLoadingOperations] = useState(false);
  
  const API_BASE_URL = 'http://localhost:8000';
  
  // Reset local data when the sheet opens or data changes
  useEffect(() => {
    if (isOpen) {
      setLocalData({ ...data });
      setHasChanges(false);
      setSelectedOperation(data?.params?.operation || '');
      fetchTriggeredRef.current = false;
    }
  }, [data, isOpen]);

  // Effect to fetch schema and operations when sheet opens
  useEffect(() => {
    if (isOpen && !fetchTriggeredRef.current && nodeType) {
      fetchTriggeredRef.current = true;
      fetchNodeSchema(nodeType);
      fetchOperationsList(nodeType);
      
      // If an operation is already selected, fetch its specific schema
      if (data?.params?.operation) {
        fetchOperationSchema(nodeType, data.params.operation);
      }
    }
  }, [isOpen, nodeType, data?.params?.operation]);

  // Function to fetch node schema from API
  const fetchNodeSchema = async (type: string) => {
    if (!type) {
      setSchemaError('Node type is undefined or empty, cannot fetch schema');
      return;
    }
    
    setIsLoadingSchema(true);
    setSchemaError(null);
    
    const url = `${API_BASE_URL}/api/nodes/${type}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch schema: ${response.status} ${response.statusText}`);
      }
      
      const schemaData = await response.json();
      setSchema(schemaData);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? `${error.name}: ${error.message}` 
        : 'Unknown error fetching schema';
      setSchemaError(errorMessage);
    } finally {
      setIsLoadingSchema(false);
    }
  };

  // Function to fetch operation-specific schema
  const fetchOperationSchema = async (type: string, operation: string) => {
    if (!type || !operation) return;
    
    setIsLoadingOperationSchema(true);
    setOperationSchemaError(null);
    
    const url = `${API_BASE_URL}/api/operations/${type}/${operation}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch operation schema: ${response.status} ${response.statusText}`);
      }
      
      const opSchema = await response.json();
      
      // Initialize parameters with defaults if needed
      if (opSchema.parameters) {
        const updatedParams = { ...(localData.params || {}) };
        updatedParams.operation = operation;
        
        let paramsChanged = false;
        
        opSchema.parameters.forEach((param: NodeParameter) => {
          if (updatedParams[param.name] === undefined && param.default !== undefined) {
            updatedParams[param.name] = param.default;
            paramsChanged = true;
          }
        });
        
        if (paramsChanged) {
          handleLocalDataChange('params', updatedParams);
        }
      }
      
      setOperationSchema(opSchema);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? `${error.name}: ${error.message}` 
        : 'Unknown error fetching operation schema';
      setOperationSchemaError(errorMessage);
    } finally {
      setIsLoadingOperationSchema(false);
    }
  };

  // Function to fetch operations list from API
  const fetchOperationsList = async (type: string) => {
    if (!type) return;
    
    setIsLoadingOperations(true);
    
    const url = `${API_BASE_URL}/api/operations-list/${type}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch operations: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.operations) {
        setAvailableOperations(data.operations);
      } else {
        extractOperationsFromSchema();
      }
    } catch (error) {
      extractOperationsFromSchema();
    } finally {
      setIsLoadingOperations(false);
    }
  };

  // Extract operations from schema if they were not found through the API
  const extractOperationsFromSchema = () => {
    if (!schema) return;
    
    const operationParam = schema.parameters.find(param => param.name === 'operation');
    if (operationParam && operationParam.enum) {
      setAvailableOperations(operationParam.enum);
    }
  };

  // Effect to extract operations from schema if API fails
  useEffect(() => {
    if (schema && availableOperations.length === 0) {
      extractOperationsFromSchema();
    }
  }, [schema]);
  
  // Handle local data changes, without immediately updating the node
  const handleLocalDataChange = (key: string, value: any) => {
    setLocalData(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  };
  
  // Handle parameter change from form
  const handleParamChange = (name: string, value: any) => {
    const updatedParams = { ...(localData.params || {}) };
    updatedParams[name] = value;
    handleLocalDataChange('params', updatedParams);
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localData);
    setHasChanges(false);
  };
  
  // Close sheet with confirmation if there are unsaved changes
  const handleClose = () => {
    if (!hasChanges || confirm('You have unsaved changes. Are you sure you want to close?')) {
      onClose();
    }
  };
  
  // Helper function to extract a short title from a long label
  const getShortTitle = (label: string) => {
    const match = label.match(/^([^:]+):/);
    if (match && match[1]) {
      return match[1].trim();
    }
    const words = label.split(' ');
    return words.slice(0, 3).join(' ') + (words.length > 3 ? '...' : '');
  };
  
  // Handle operation change
  const handleOperationChange = (operation: string) => {
    // Don't process placeholder value
    if (operation === '_placeholder') {
      return;
    }

    setSelectedOperation(operation);
    
    // Fetch the operation-specific schema
    fetchOperationSchema(nodeType, operation);
    
    // Start with minimal params - keep the token fields and other generics
    const updatedParams: Record<string, any> = { 
      operation: operation 
    };

    // Preserve authentication fields that may exist
    if (localData.params) {
      Object.entries(localData.params).forEach(([key, value]) => {
        const paramName = key.toLowerCase();
        const isAuthField = paramName.includes('token') || 
                           paramName.includes('key') || 
                           paramName.includes('secret') || 
                           paramName.includes('auth');
        
        if (isAuthField) {
          updatedParams[key] = value;
        }
      });
    }
    
    // Update the form state with our new params
    handleLocalDataChange('params', updatedParams);
  };
  
  // Render a form input based on parameter type
  const renderParameterInput = (param: NodeParameter) => {
    const value = localData.params?.[param.name] !== undefined 
      ? localData.params[param.name] 
      : param.default;
    
    const paramType = param.type.toLowerCase();
    
    switch (paramType) {
      case 'string':
        if (param.enum && param.enum.length > 0) {
          return (
            <Select 
              value={value !== undefined ? String(value) : '_empty'}
              onValueChange={(val) => handleParamChange(param.name, val === '_empty' ? '' : val)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={`Select ${param.name}`} />
              </SelectTrigger>
              <SelectContent>
                {value === '' && <SelectItem value="_empty">-- None --</SelectItem>}
                {param.enum.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        return (
          <Input
            type="text"
            value={value !== undefined ? String(value) : ''}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            placeholder={param.description}
            className="mt-1.5"
          />
        );
        
      case 'number':
        return (
          <Input
            type="number"
            value={value !== undefined ? String(value) : ''}
            onChange={(e) => handleParamChange(param.name, e.target.valueAsNumber || 0)}
            min={param.min_value !== null ? param.min_value : undefined}
            max={param.max_value !== null ? param.max_value : undefined}
            placeholder={param.description}
            className="mt-1.5"
          />
        );
        
      case 'boolean':
        return (
          <div className="flex items-center space-x-2 mt-1.5">
            <Checkbox 
              id={`${param.name}-checkbox`}
              checked={Boolean(value)} 
              onCheckedChange={(checked) => handleParamChange(param.name, checked)}
            />
            <label 
              htmlFor={`${param.name}-checkbox`}
              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {param.description}
            </label>
          </div>
        );
        
      case 'object':
      case 'json':
        const stringValue = typeof value === 'object' 
          ? JSON.stringify(value, null, 2) 
          : value || '{}';
          
        return (
          <Textarea
            value={stringValue}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleParamChange(param.name, parsed);
              } catch (error) {
                // Keep the string value even if invalid JSON
                handleParamChange(param.name, e.target.value);
              }
            }}
            placeholder={param.description}
            className="font-mono mt-1.5 min-h-[100px]"
          />
        );
        
      case 'array':
        const arrayValue = Array.isArray(value) 
          ? JSON.stringify(value, null, 2) 
          : value || '[]';
          
        return (
          <Textarea
            value={arrayValue}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleParamChange(param.name, parsed);
              } catch (error) {
                // Keep the string value even if invalid JSON
                handleParamChange(param.name, e.target.value);
              }
            }}
            placeholder={param.description}
            className="font-mono mt-1.5 min-h-[100px]"
          />
        );
        
      case 'binary':
        return (
          <div className="mt-1.5">
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    // Get base64 string (remove the prefix)
                    const base64 = reader.result?.toString().split(',')[1] || '';
                    handleParamChange(param.name, base64);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Select a file to upload
            </p>
          </div>
        );
        
      case 'secret':
      case 'password':
        return (
          <Input
            type="password"
            value={value !== undefined ? String(value) : ''}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            placeholder={param.description}
            className="mt-1.5"
          />
        );
        
      default:
        return (
          <Input
            value={value !== undefined ? String(value) : ''}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            placeholder={param.description}
            className="mt-1.5"
          />
        );
    }
  };
  
  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="right" className="p-0" style={{ width: '450px', maxWidth: '90vw' }}>
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-2 mb-1">
              {nodeType && <Badge variant="outline">{nodeType}</Badge>}
              <SheetTitle className="text-xl font-bold truncate">
                {getShortTitle(localData?.label || 'Untitled Node')}
              </SheetTitle>
            </div>
            <SheetDescription className="text-sm text-muted-foreground">
              Node ID: {nodeId}
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="flex-1 px-6 pt-4">
            <form onSubmit={handleSubmit} className="space-y-6 pb-20">
              <div>
                <Label htmlFor="label" className="text-sm font-medium">Node Label</Label>
                <Textarea
                  id="label"
                  value={localData?.label || ''}
                  onChange={(e) => handleLocalDataChange('label', e.target.value)}
                  placeholder="Enter a descriptive label for this node"
                  className="mt-1.5 min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Detailed description of what this node does and how it fits in your workflow.
                </p>
              </div>

              {/* Operation selection (only shown if the node has operations) */}
              {schema && schema.parameters.some(p => p.name === 'operation') && (
                <div>
                  <Label htmlFor="operation" className="text-sm font-medium">Operation <span className="text-red-500">*</span></Label>
                  {isLoadingOperations ? (
                    <div className="flex items-center space-x-2 mt-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading operations...</span>
                    </div>
                  ) : (
                    <Select 
                      value={selectedOperation || '_placeholder'} 
                      onValueChange={handleOperationChange}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select operation" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[400px]">
                        <SelectItem value="_placeholder">-- Select Operation --</SelectItem>
                        {availableOperations.map((op) => (
                          <SelectItem key={op} value={op}>{op}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Select the operation to perform with this node
                  </p>
                </div>
              )}
              
              {/* Error state for schema */}
              {schemaError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Error loading node schema: {schemaError}</AlertDescription>
                </Alert>
              )}
              
              {/* Show a prompt to select an operation if none is selected */}
              {schema && !isLoadingSchema && !selectedOperation && schema.parameters.some(p => p.name === 'operation') && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Please select an operation to configure its parameters.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Loading state for operation schema */}
              {isLoadingOperationSchema && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading operation parameters...</span>
                </div>
              )}
              
              {/* Error state for operation schema */}
              {operationSchemaError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Error loading operation schema: {operationSchemaError}</AlertDescription>
                </Alert>
              )}
              
              {/* Render parameters based on operation schema */}
              {operationSchema && !isLoadingOperationSchema && selectedOperation && (
                <div className="space-y-6 border-t pt-4">
                  <h3 className="text-sm font-medium">Parameters for {selectedOperation}</h3>
                  {operationSchema.parameters.length > 0 ? (
                    operationSchema.parameters.map(param => (
                      <div key={param.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={param.name} className="text-sm font-medium flex items-center">
                            {param.name}
                            {operationSchema.required.includes(param.name) && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </Label>
                          <Badge variant="outline" className="text-xs">
                            {param.type}
                          </Badge>
                        </div>
                        
                        {renderParameterInput(param)}
                        
                        <p className="text-xs text-muted-foreground mt-1">
                          {param.description}
                        </p>
                      </div>
                    ))
                  ) : (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        This operation has no configurable parameters.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </form>
          </ScrollArea>
          
          {/* Save Button (fixed at bottom) */}
          {hasChanges && (
            <div className="border-t px-6 py-4 bg-background">
              <Button type="submit" className="w-full" onClick={handleSubmit}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NodeSettingsSheet;