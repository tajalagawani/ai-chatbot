import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { 
  ChevronDown, 
  ChevronUp, 
  Check, 
  RefreshCw,
  X,
  AlertCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader,
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import nodeApiService from './nodeApiService';

interface NodeSettingsProps {
  workflowId: string;
  nodeId: string;
  nodeData: any;
  onSave: (newData: any) => void;
  onExecutionComplete?: (response: any) => void;
  onDragEnd?: (event: any) => void;
}

const NodeSettings: React.FC<NodeSettingsProps> = ({
  workflowId,
  nodeId,
  nodeData,
  onSave,
  onExecutionComplete
}) => {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodeType, setNodeType] = useState<string>('');
  const [nodeInfo, setNodeInfo] = useState<any>(null);
  const [operations, setOperations] = useState<any[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [operationDetails, setOperationDetails] = useState<any>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [executing, setExecuting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('info');

  // Initialize form when component mounts
  useEffect(() => {
    if (nodeData) {
      const nodeTypeFromData = nodeData.nodeType || '';
      setNodeType(nodeTypeFromData);
      
      // Initialize form values from existing node data
      if (nodeData.params) {
        setFormValues(nodeData.params);
      }
      
      if (nodeData.operation) {
        setSelectedOperation(nodeData.operation);
      }
      
      // Load node info, schema, and operations
      loadNodeData(nodeTypeFromData);
    }
  }, [nodeData]);

  // Load operation details when operation is selected
  useEffect(() => {
    if (nodeType && selectedOperation) {
      loadOperationDetails(nodeType, selectedOperation);
    }
  }, [nodeType, selectedOperation]);

  // Load all node data (info, schema, operations)
  const loadNodeData = async (nodeType: string) => {
    if (!nodeType) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching node data for node type: ${nodeType}`);
      
      // Debug API endpoint
      const apiBaseUrl = 'http://localhost:5088/api/nodes'; // This should match your nodeApiService
      console.log(`API Base URL: ${apiBaseUrl}`);
      console.log(`Requesting: ${apiBaseUrl}/nodes/${nodeType} and ${apiBaseUrl}/nodes/${nodeType}/operations`);
      
      // Fetch node info and operations in parallel
      const [infoResult, operationsResult] = await Promise.all([
        nodeApiService.getNodeInfo(nodeType).catch(error => {
          console.error("Error fetching node info:", error);
          throw error;
        }),
        nodeApiService.getNodeOperations(nodeType).catch(error => {
          console.error("Error fetching operations:", error);
          throw error;
        })
      ]);
      
      console.log("Node info received:", infoResult);
      console.log("Operations received:", operationsResult);
      
      setNodeInfo(infoResult);
      setOperations(operationsResult);
      
      // If we don't have a selected operation yet, select the first one
      if (!selectedOperation && operationsResult.length > 0) {
        setSelectedOperation(operationsResult[0].name);
      }
    } catch (err) {
      console.error("API request failed:", err);
      // Check for CORS issues
      if (err instanceof Error && err.message.includes('CORS')) {
        setError(`CORS error: Your browser is blocking requests to the API. Check that your API allows requests from ${window.location.origin}`);
      } else if (err instanceof Error && err.message.includes('NetworkError')) {
        setError(`Network error: Unable to connect to the API server. Make sure your API is running at the correct URL.`);
      } else {
        setError(`Failed to load node data: ${err instanceof Error ? err.message : String(err)}`);
      }
      showAlert('error', `Failed to load node data: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Load details for a specific operation
  const loadOperationDetails = async (nodeType: string, operationName: string) => {
    if (!nodeType || !operationName) return;
    
    try {
      const details = await nodeApiService.getOperationDetails(nodeType, operationName);
      setOperationDetails(details);
      
      // Initialize default values for this operation
      const defaultValues: Record<string, any> = {};
      if (details && details.parameters) {
        details.parameters.forEach((param: any) => {
          if (param.default !== null && param.default !== undefined && !(param.name in formValues)) {
            defaultValues[param.name] = param.default;
          }
        });
        
        // Update form values with defaults for any new parameters
        setFormValues(prev => ({
          ...prev,
          ...defaultValues
        }));
      }
    } catch (err) {
      setError(`Failed to load operation details: ${err instanceof Error ? err.message : String(err)}`);
      showAlert('error', `Failed to load operation details: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Handle form value changes
  const handleInputChange = (paramName: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [paramName]: value
    }));
    
    // Clear validation error when field is updated
    if (validationErrors[paramName]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[paramName];
        return newErrors;
      });
    }
  };

  // Validate form before saving or executing
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!operationDetails || !operationDetails.parameters) {
      return true; // Can't validate without parameters
    }
    
    operationDetails.parameters.forEach((param: any) => {
      const value = formValues[param.name];
      
      // Check required parameters
      if (param.required && (value === undefined || value === null || value === '')) {
        errors[param.name] = `${param.name} is required`;
      }
      
      // Additional type validation could be added here
      if (value !== undefined && value !== null) {
        if (param.type === 'number' && isNaN(Number(value))) {
          errors[param.name] = `${param.name} must be a number`;
        }
        
        // Validate min/max values for numbers
        if (param.type === 'number') {
          const numValue = Number(value);
          if (param.min_value !== null && numValue < param.min_value) {
            errors[param.name] = `${param.name} must be at least ${param.min_value}`;
          }
          if (param.max_value !== null && numValue > param.max_value) {
            errors[param.name] = `${param.name} must be at most ${param.max_value}`;
          }
        }
        
        // Validate string pattern
        if (param.type === 'string' && param.pattern && !new RegExp(param.pattern).test(value)) {
          errors[param.name] = `${param.name} does not match the required pattern`;
        }
      }
    });
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return false;
    }
    
    return true;
  };

  // Handle save button click
  const handleSave = () => {
    if (!validateForm()) {
      showAlert('error', 'Please fix the validation errors before saving');
      return;
    }
    
    const newNodeData = {
      ...nodeData,
      nodeType: nodeType,
      operation: selectedOperation,
      params: formValues
    };
    
    onSave(newNodeData);
    showAlert('success', 'Node settings saved successfully');
  };

  // Handle execute button click
  const handleExecute = async () => {
    if (!validateForm()) {
      showAlert('error', 'Please fix the validation errors before executing');
      return;
    }
    
    setExecuting(true);
    
    try {
      const executionParams = {
        nodeId,
        workflowId,
        nodeType,
        operation: selectedOperation,
        params: formValues
      };
      
      const result = await nodeApiService.executeNodeOperation(executionParams);
      
      if (onExecutionComplete) {
        onExecutionComplete(result);
      }
      
      showAlert('success', 'Node executed successfully');
    } catch (err) {
      setError(`Execution failed: ${err instanceof Error ? err.message : String(err)}`);
      showAlert('error', `Execution failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExecuting(false);
    }
  };

  // Show alert message
  const showAlert = (severity: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setAlertSeverity(severity);
    setAlertMessage(message);
    setAlertOpen(true);
    
    // Auto-close success alerts after 3 seconds
    if (severity === 'success') {
      setTimeout(() => {
        setAlertOpen(false);
      }, 3000);
    }
  };

  // Helper function to get alert variant based on severity
  const getAlertVariant = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'warning';
      case 'success':
        return 'success';
      default:
        return 'default';
    }
  };

  // Render a form field based on parameter type
  const renderFormField = (param: any) => {
    const paramName = param.name;
    const value = formValues[paramName] !== undefined ? formValues[paramName] : '';
    const hasError = !!validationErrors[paramName];
    const errorMessage = validationErrors[paramName];
    
    // Skip advanced parameters unless showAdvanced is true
    const isAdvanced = !param.required;
    if (isAdvanced && !showAdvanced) {
      return null;
    }
    
    switch (param.type) {
      case 'string':
        // Handle enum type (dropdown)
        if (param.enum && Array.isArray(param.enum)) {
          return (
            <div key={paramName} className="space-y-2 mb-4">
              <Label htmlFor={paramName} className={hasError ? "text-red-500" : ""}>
                {paramName} {param.required && <span className="text-red-500">*</span>}
              </Label>
              <Select
                defaultValue={value || ''}
                onValueChange={(newValue) => handleInputChange(paramName, newValue)}
              >
                <SelectTrigger id={paramName} className={hasError ? "border-red-500" : ""}>
                  <SelectValue placeholder={`Select ${paramName}`} />
                </SelectTrigger>
                <SelectContent>
                  {param.enum.map((option: string) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={`text-xs ${hasError ? "text-red-500" : "text-muted-foreground"}`}>
                {hasError ? errorMessage : param.description}
              </p>
            </div>
          );
        }
        
        // Regular text input
        return (
          <div key={paramName} className="space-y-2 mb-4">
            <Label htmlFor={paramName} className={hasError ? "text-red-500" : ""}>
              {paramName} {param.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={paramName}
              value={value || ''}
              onChange={(e) => handleInputChange(paramName, e.target.value)}
              className={hasError ? "border-red-500" : ""}
            />
            <p className={`text-xs ${hasError ? "text-red-500" : "text-muted-foreground"}`}>
              {hasError ? errorMessage : param.description}
            </p>
          </div>
        );
        
      case 'number':
        return (
          <div key={paramName} className="space-y-2 mb-4">
            <Label htmlFor={paramName} className={hasError ? "text-red-500" : ""}>
              {paramName} {param.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={paramName}
              type="number"
              value={value || ''}
              onChange={(e) => handleInputChange(paramName, e.target.value === '' ? '' : Number(e.target.value))}
              className={hasError ? "border-red-500" : ""}
              min={param.min_value !== null ? param.min_value : undefined}
              max={param.max_value !== null ? param.max_value : undefined}
            />
            <p className={`text-xs ${hasError ? "text-red-500" : "text-muted-foreground"}`}>
              {hasError ? errorMessage : param.description}
            </p>
          </div>
        );
        
      case 'boolean':
        return (
          <div key={paramName} className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <Label htmlFor={paramName}>
                {paramName} {param.required && <span className="text-red-500">*</span>}
              </Label>
              <p className="text-xs text-muted-foreground">
                {param.description}
              </p>
            </div>
            <Switch
              id={paramName}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleInputChange(paramName, checked)}
            />
          </div>
        );
        
      case 'object':
        return (
          <div key={paramName} className="space-y-2 mb-4">
            <Label htmlFor={paramName} className={hasError ? "text-red-500" : ""}>
              {paramName} {param.required && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id={paramName}
              value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value || ''}
              onChange={(e) => {
                try {
                  const parsedValue = e.target.value.trim() ? JSON.parse(e.target.value) : {};
                  handleInputChange(paramName, parsedValue);
                } catch (err) {
                  // Allow invalid JSON during typing
                  handleInputChange(paramName, e.target.value);
                }
              }}
              className={`font-mono ${hasError ? "border-red-500" : ""}`}
              rows={4}
            />
            <p className={`text-xs ${hasError ? "text-red-500" : "text-muted-foreground"}`}>
              {hasError ? errorMessage : param.description}
            </p>
          </div>
        );
        
      case 'array':
        return (
          <div key={paramName} className="space-y-2 mb-4">
            <Label htmlFor={paramName} className={hasError ? "text-red-500" : ""}>
              {paramName} {param.required && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id={paramName}
              value={Array.isArray(value) ? JSON.stringify(value, null, 2) : value || ''}
              onChange={(e) => {
                try {
                  const parsedValue = e.target.value.trim() ? JSON.parse(e.target.value) : [];
                  handleInputChange(paramName, parsedValue);
                } catch (err) {
                  // Allow invalid JSON during typing
                  handleInputChange(paramName, e.target.value);
                }
              }}
              className={`font-mono ${hasError ? "border-red-500" : ""}`}
              rows={4}
            />
            <p className={`text-xs ${hasError ? "text-red-500" : "text-muted-foreground"}`}>
              {hasError ? errorMessage : `${param.description} (JSON array)`}
            </p>
          </div>
        );
        
      default:
        return (
          <div key={paramName} className="space-y-2 mb-4">
            <Label htmlFor={paramName} className={hasError ? "text-red-500" : ""}>
              {paramName} {param.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={paramName}
              value={value || ''}
              onChange={(e) => handleInputChange(paramName, e.target.value)}
              className={hasError ? "border-red-500" : ""}
            />
            <p className={`text-xs ${hasError ? "text-red-500" : "text-muted-foreground"}`}>
              {hasError ? errorMessage : param.description}
            </p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-full">
        <div className="animate-spin w-6 h-6 mb-4">
          <RefreshCw className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Loading node data...</p>
        <p className="text-xs text-zinc-500 mt-2">
          Check the console for API requests (F12 &gt; Console)
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4"
          onClick={() => {
            // Force fetch even if we're in a loading state
            const currentNodeType = nodeData?.nodeType || '';
            if (currentNodeType) {
              console.log("Manual retry for:", currentNodeType);
              loadNodeData(currentNodeType);
            } else {
              setError("No node type specified in nodeData");
              setLoading(false);
            }
          }}
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Alert message */}
      {alertOpen && (
        <Alert 
          variant={getAlertVariant(alertSeverity) as any}
          className="mb-2 mx-2 mt-2"
        >
          <div className="flex justify-between w-full items-center">
            <div className="flex items-center">
              {alertSeverity === 'error' && <AlertCircle className="h-4 w-4 mr-2" />}
              <AlertDescription>{alertMessage}</AlertDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setAlertOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      )}
      
      {/* Node info header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center">
              {nodeInfo?.name || nodeType}
              {nodeInfo?.version && (
                <Badge variant="outline" className="ml-2 h-5 text-xs">
                  v{nodeInfo.version}
                </Badge>
              )}
            </h3>
            {nodeInfo?.description && (
              <p className="text-sm text-zinc-400 mt-1">
                {nodeInfo.description}
              </p>
            )}
          </div>
        </div>
        {nodeInfo?.author && (
          <p className="text-xs text-zinc-500 mt-1">
            Author: {nodeInfo.author}
          </p>
        )}
      </div>
      
      {/* Form content */}
      <ScrollArea className="flex-1 p-4 bg-zinc-950">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Operation selection */}
        {operations.length > 0 && (
          <div className="space-y-2 mb-6">
            <Label htmlFor="operation-select">Operation</Label>
            <Select
              value={selectedOperation}
              onValueChange={setSelectedOperation}
            >
              <SelectTrigger id="operation-select">
                <SelectValue placeholder="Select an operation" />
              </SelectTrigger>
              <SelectContent>
                {operations.map((op) => (
                  <SelectItem key={op.name} value={op.name}>
                    {op.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {operations.find(op => op.name === selectedOperation)?.description || 'Select an operation to perform'}
            </p>
          </div>
        )}
        
        {/* Operation parameters */}
        {operationDetails && operationDetails.parameters && (
          <>
            <div className="flex items-center mb-4">
              <h4 className="text-sm font-medium text-white">Parameters</h4>
              <Separator className="flex-1 ml-2" />
            </div>
            
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4 pt-4">
                {operationDetails.parameters.filter((p: any) => p.required).map((param: any) => renderFormField(param))}
                
                {/* Advanced parameters section */}
                {operationDetails.parameters.some((p: any) => !p.required) && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-zinc-400"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                      {showAdvanced ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          Hide Advanced Parameters
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          Show Advanced Parameters
                        </>
                      )}
                    </Button>
                    
                    {showAdvanced && operationDetails.parameters.filter((p: any) => !p.required).map((param: any) => renderFormField(param))}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </ScrollArea>
      
      {/* Action buttons */}
      <div className="border-t border-zinc-800 bg-zinc-900 p-4 flex justify-between items-center">
        <Button 
          variant="default" 
          onClick={handleSave}
          disabled={executing}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Check className="h-4 w-4 mr-2" />
          Save
        </Button>
        
        <Button
          variant="secondary"
          onClick={handleExecute}
          disabled={executing}
        >
          {executing ? (
            <>
              <div className="animate-spin h-4 w-4 mr-2">
                <RefreshCw className="h-4 w-4" />
              </div>
              Executing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Execute
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default NodeSettings;