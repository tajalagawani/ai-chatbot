import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Play, AlertCircle, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { OptionBadges } from './OperationBadges';
import OperationsDropdown from './OperationsDropdown';
import NodePanelHeader from './NodePanelHeader';

// shadcn components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Type definitions
interface OperationParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default: any;
  enum: string[] | null;
  min_value: number | null;
  max_value: number | null;
  pattern: string | null;
  operation_specific?: boolean;
}

interface OperationParams {
  operation_specific: Record<string, OperationParameter>;
  common: Record<string, OperationParameter>;
}

interface Operation {
  name: string;
  description: string;
  type: string;
  implemented: boolean;
  documentation: string;
  parameters: OperationParams;
  example: any;
}

interface DynamicNodeSettingsProps {
  nodeData: any;
  workflowId: string;
  nodeId: string;
  onSave: (updatedData: any) => void;
  onExecutionComplete?: (response: any) => void;
}

const API_BASE_URL = 'http://localhost:5088/api';

const DynamicNodeSettings: React.FC<DynamicNodeSettingsProps> = ({ 
  nodeData, 
  workflowId, 
  nodeId,
  onSave, 
  onExecutionComplete
}) => {
  // Extract node type from the data and format it
  const rawNodeType = nodeData?.type || 'unknown';
  
  // Format node type - convert camelCase to lowercase simple name
  const formatNodeType = (type: string): string => {
    // Handle empty or unknown types
    if (!type || type === 'unknown') return 'unknown';
    
    // Extract the core name by finding common patterns
    const commonSuffixes = /(Node|Assistant|Api|Service|Provider|Generator|Processor)$/i;
    
    // Remove the suffixes
    let simplified = type.replace(commonSuffixes, '');
    
    // Handle special cases
    if (simplified.toLowerCase() === 'openai') return 'openai';
    if (simplified.toLowerCase() === 'claude') return 'claude';
    
    // Convert camelCase to lowercase
    return simplified.toLowerCase();
  };
  
  const nodeType = formatNodeType(rawNodeType);
  
  // State for the component
  const [operations, setOperations] = useState<string[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [operationDetails, setOperationDetails] = useState<Operation | null>(null);
  const [formData, setFormData] = useState<any>(nodeData?.formData || {});
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingOperation, setLoadingOperation] = useState<boolean>(false);
  const [executingNode, setExecutingNode] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scrolledTop, setScrolledTop] = useState<boolean>(true);
  const [scrolledBottom, setScrolledBottom] = useState<boolean>(true);
  
  // Refs
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle scroll event to show/hide shadows
  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      setScrolledTop(scrollTop <= 5);
      setScrolledBottom(scrollTop + clientHeight >= scrollHeight - 5);
    }
  };
  
  // Add scroll event listener
  useEffect(() => {
    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener('scroll', handleScroll);
      // Check initial scroll state
      handleScroll();
    }
    return () => {
      if (contentElement) {
        contentElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, [operationDetails]);

  // Fetch available operations when component mounts
  useEffect(() => {
    const fetchOperations = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log(`Fetching operations for node type: ${nodeType}`);
        const response = await fetch(`${API_BASE_URL}/nodes/${nodeType}/operations`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch operations for ${nodeType} (HTTP ${response.status})`);
        }
        
        const data = await response.json();
        console.log(`Received operations data:`, data);
        
        // Handle different response formats
        let operationsList = [];
        
        if (data.operations && typeof data.operations === 'object') {
          // Extract operations from the operations object in the response
          operationsList = Object.keys(data.operations);
        } else if (data.operations_count > 0) {
          // Extract from our Flask API's specific format
          operationsList = Object.keys(data.operations || {});
        } else if (Array.isArray(data)) {
          // Direct array of operations
          operationsList = data;
        } else if (typeof data === 'object' && data !== null) {
          // Maybe operations are directly in the response object
          operationsList = Object.keys(data).filter(key => 
            typeof data[key] === 'object' && 
            data[key] !== null && 
            !key.startsWith('_')
          );
        }
        
        console.log(`Processed operations list:`, operationsList);
        
        if (operationsList.length > 0) {
          setOperations(operationsList);
          
          // Set initial operation if exists in node data
          if (nodeData?.formData?.operation) {
            setSelectedOperation(nodeData.formData.operation);
            fetchOperationDetails(nodeData.formData.operation);
          } else {
            setSelectedOperation(operationsList[0]);
            fetchOperationDetails(operationsList[0]);
          }
        } else {
          console.warn(`No operations found for node type: ${nodeType}`);
          setOperations([]);
        }
      } catch (err) {
        console.error("Error fetching operations:", err);
        setError(`Failed to load operations: ${err.message}`);
        setOperations([]);
      } finally {
        setLoading(false);
      }
    };

    if (nodeType && nodeType !== 'unknown') {
      fetchOperations();
    }
  }, [nodeType, nodeData]);

  // Fetch details for specific operation
  const fetchOperationDetails = useCallback(async (operation: string) => {
    if (!operation || !nodeType) return;
    
    setLoadingOperation(true);
    setError(null);
    
    try {
      console.log(`Fetching details for operation: ${operation} (node type: ${nodeType})`);
      const response = await fetch(`${API_BASE_URL}/nodes/${nodeType}/operations/${operation}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch details for operation: ${operation} (HTTP ${response.status})`);
      }
      
      const data = await response.json();
      console.log(`Received operation details:`, data);
      
      // Adapt the API response to our expected Operation format
      const processedOperationDetails: Operation = {
        name: operation,
        description: data.note || `${operation} operation for ${nodeType}`,
        type: nodeType,
        implemented: true,
        documentation: "",
        parameters: {
          common: {},
          operation_specific: {}
        },
        example: {}
      };
      
      // Process parameters from the API response
      if (Array.isArray(data.parameters)) {
        // Convert parameters array to our required format
        data.parameters.forEach((param: any) => {
          // Skip the operation parameter itself in the form fields
          if (param.name === 'operation') return;
          
          const processedParam: OperationParameter = {
            name: param.name || "Unknown",
            type: param.type || "string",
            description: param.description || param.name || "",
            required: param.required || false,
            default: param.default !== undefined ? param.default : null,
            enum: param.enum || null,
            min_value: param.min_value !== undefined ? param.min_value : null,
            max_value: param.max_value !== undefined ? param.max_value : null,
            pattern: param.pattern || null,
            operation_specific: true
          };
          
          processedOperationDetails.parameters.operation_specific[param.name] = processedParam;
        });
      }
      
      console.log("Processed operation details:", processedOperationDetails);
      setOperationDetails(processedOperationDetails);
      
      // Initialize form with defaults from the operation details
      const initialFormValues = { 
        ...formData,
        operation: operation 
      };
      
      // Add default values for parameters
      Object.entries(processedOperationDetails.parameters.operation_specific).forEach(([key, param]: [string, any]) => {
        if (formData[key] === undefined && param.default !== null) {
          initialFormValues[key] = param.default;
        }
      });
      
      setFormData(initialFormValues);
    } catch (err) {
      console.error("Error fetching operation details:", err);
      setError(`Failed to load operation details: ${err.message}`);
    } finally {
      setLoadingOperation(false);
    }
  }, [nodeType, formData]);

  // Handle operation change
  const handleOperationChange = (operation) => {
    setSelectedOperation(operation);
    fetchOperationDetails(operation);
    
    // Update the operation in the form data
    setFormData(prev => ({
      ...prev,
      operation: operation
    }));
  };

  // Handle form field changes
  const handleInputChange = (paramName, value) => {
    setFormData(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  // Handle form submission
  const handleSubmit = (event) => {
    if (event) event.preventDefault();
    
    onSave({
      ...nodeData,
      formData: formData
    });
  };

  // Handle executing the node
  const handleExecute = async () => {
    setExecutingNode(true);
    setError(null);
    
    try {
      // Adjust this endpoint to match your Flask API structure
      const response = await fetch(`${API_BASE_URL}/execute/${nodeType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute node');
      }
      
      const result = await response.json();
      
      if (onExecutionComplete) {
        onExecutionComplete(result);
      }
    } catch (err) {
      console.error("Error executing node:", err);
      setError(`Execution failed: ${err.message}`);
    } finally {
      setExecutingNode(false);
    }
  };

  // Render form fields based on parameter type
  const renderField = (param: OperationParameter, key: string) => {
    const value = formData[key] !== undefined ? formData[key] : param.default;
    
    switch (param.type) {
      case 'string':
        if (param.enum) {
          return (
            <div className="space-y-2 mb-6" key={key}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor={key} className="flex items-center text-base">
                      {param.name}
                      {param.required && <span className="text-red-500 ml-1 font-bold text-lg">*</span>}
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{param.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <div className="mt-1">
                <OptionBadges
                  options={param.enum}
                  selectedOption={value}
                  onSelect={(option) => handleInputChange(key, option)}
                  size="sm"
                  variant="rounded"
                />
              </div>
            </div>
          );
        } else if (key === 'system' || key === 'prompt' || (param.name && param.name.toLowerCase().includes('prompt'))) {
          return (
            <div className="space-y-2 mb-6" key={key}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor={key} className="flex items-center text-base">
                      {param.name}
                      {param.required && <span className="text-red-500 ml-1 font-bold text-lg">*</span>}
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{param.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <div className="mt-1">
                <Textarea
                  id={key}
                  value={value || ''}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder={param.description}
                  rows={5}
                  className="w-full bg-background dark:bg-[#0f0f10] text-foreground dark:text-white hover:bg-background dark:hover:bg-[#0f0f10] 
                            focus:bg-background dark:focus:bg-[#0f0f10] border-input dark:border-zinc-800 transition-colors duration-200"
                />
              </div>
            </div>
          );
        } else {
          return (
            <div className="space-y-2 mb-6" key={key}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor={key} className="flex items-center text-base">
                      {param.name}
                      {param.required && <span className="text-red-500 ml-1 font-bold text-lg">*</span>}
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{param.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <div className="m-1 ">
                <Input
                  id={key}
                  type="text"
                  value={value || ''}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder={param.description}
                  required={param.required}
                  className="bg-background dark:bg-[#0f0f10] text-foreground dark:text-white hover:bg-background dark:hover:bg-[#0f0f10] 
                             focus:bg-background dark:focus:bg-[#0f0f10] border-input dark:border-zinc-800 transition-colors duration-200 p-1 "
                />
              </div>
            </div>
          );
        }
        
      case 'number':
        if (param.min_value !== null && param.max_value !== null) {
          return (
            <div className="space-y-2 mb-6" key={key}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor={key} className="flex items-center justify-between text-base">
                      <span>
                        {param.name}
                        {param.required && <span className="text-red-500 ml-1 font-bold text-lg">*</span>}
                      </span>
                      <span className="text-sm text-muted-foreground text-gray-300">
                        {value || param.default}
                      </span>
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{param.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <div className="mt-1 px-1">
                <Slider
                  id={key}
                  min={param.min_value}
                  max={param.max_value}
                  step={param.name === 'temperature' || param.name === 'top_p' ? 0.1 : 1}
                  value={[value !== undefined && value !== null ? value : param.default]}
                  onValueChange={(vals) => handleInputChange(key, vals[0])}
                />
              </div>
            </div>
          );
        } else {
          return (
            <div className="space-y-2 mb-6" key={key}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor={key} className="flex items-center text-base">
                      {param.name}
                      {param.required && <span className="text-red-500 ml-1 font-bold text-lg">*</span>}
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{param.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <div className="mt-1">
                <Input
                  id={key}
                  type="number"
                  value={value !== undefined && value !== null ? value : ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    handleInputChange(key, val);
                  }}
                  placeholder={param.description}
                  required={param.required}
                  min={param.min_value !== null ? param.min_value : undefined}
                  max={param.max_value !== null ? param.max_value : undefined}
                  className="bg-background dark:bg-[#0f0f10] text-foreground dark:text-white hover:bg-background dark:hover:bg-[#0f0f10] 
                             focus:bg-background dark:focus:bg-[#0f0f10] border-input dark:border-zinc-800 transition-colors duration-200"
                />
              </div>
            </div>
          );
        }
        
      case 'boolean':
        return (
          <div className="flex items-center justify-between mb-6" key={key}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor={key} className="flex items-center text-base">
                    {param.name}
                    {param.required && <span className="text-red-500 ml-1 font-bold text-lg">*</span>}
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{param.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Switch
              id={key}
              checked={value || false}
              onCheckedChange={(checked) => handleInputChange(key, checked)}
            />
          </div>
        );
        
      case 'array':
        return (
          <div className="space-y-2 mb-6" key={key}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor={key} className="flex items-center text-base">
                    {param.name}
                    {param.required && <span className="text-red-500 ml-1 font-bold text-lg">*</span>}
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{param.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <div className="mt-1">
              <Textarea
                id={key}
                value={value ? JSON.stringify(value, null, 2) : ''}
                onChange={(e) => {
                  try {
                    const parsed = e.target.value ? JSON.parse(e.target.value) : [];
                    handleInputChange(key, parsed);
                  } catch (err) {
                    // Show validation error, but still update the raw text
                    console.warn("Invalid JSON for array input:", err);
                  }
                }}
                placeholder={`Enter JSON array: ${param.description}`}
                rows={3}
                className="font-mono text-sm bg-background dark:bg-[#0f0f10] text-foreground dark:text-white 
                          hover:bg-background dark:hover:bg-[#0f0f10] focus:bg-background dark:focus:bg-[#0f0f10] 
                          border-input dark:border-zinc-800 transition-colors duration-200"
              />
            </div>
          </div>
        );
        
      case 'object':
        return (
          <div className="space-y-2 mb-6" key={key}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor={key} className="flex items-center text-base">
                    {param.name}
                    {param.required && <span className="text-red-500 ml-1 font-bold text-lg">*</span>}
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{param.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <div className="mt-1">
              <Textarea
                id={key}
                value={value ? JSON.stringify(value, null, 2) : ''}
                onChange={(e) => {
                  try {
                    const parsed = e.target.value ? JSON.parse(e.target.value) : {};
                    handleInputChange(key, parsed);
                  } catch (err) {
                    // Show validation error, but still update the raw text
                    console.warn("Invalid JSON for object input:", err);
                  }
                }}
                placeholder={`Enter JSON object: ${param.description}`}
                rows={3}
                className="font-mono text-sm bg-background dark:bg-[#0f0f10] text-foreground dark:text-white 
                          hover:bg-background dark:hover:bg-[#0f0f10] focus:bg-background dark:focus:bg-[#0f0f10] 
                          border-input dark:border-zinc-800 transition-colors duration-200"
              />
            </div>
          </div>
        );
        
      default:
        return (
          <div className="space-y-2 mb-6" key={key}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor={key} className="flex items-center text-base">
                    {param.name}
                    {param.required && <span className="text-red-500 ml-1 font-bold text-lg">*</span>}
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{param.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <div className="mt-1">
              <Input
                id={key}
                type="text"
                value={value || ''}
                onChange={(e) => handleInputChange(key, e.target.value)}
                placeholder={param.description}
                required={param.required}
                className="bg-background dark:bg-[#0f0f10] text-foreground dark:text-white hover:bg-background dark:hover:bg-[#0f0f10] 
                          focus:bg-background dark:focus:bg-[#0f0f10] border-input dark:border-zinc-800 transition-colors duration-200"
              />
            </div>
          </div>
        );
    }
  };

  // Helper function to get all fields for the current operation
  const getAllFields = () => {
    if (!operationDetails) return [];
    
    const fields = [];
    
    // First add all required parameters
    if (operationDetails.parameters.operation_specific) {
      Object.entries(operationDetails.parameters.operation_specific)
        .filter(([key, param]) => param.required && key !== 'operation')
        .forEach(([key, param]) => {
          fields.push({ key, param });
        });
    }
    
    // Then add all optional parameters
    if (operationDetails.parameters.operation_specific) {
      Object.entries(operationDetails.parameters.operation_specific)
        .filter(([key, param]) => !param.required && key !== 'operation')
        .sort((a, b) => {
          // Sort by parameter name
          return a[0].localeCompare(b[0]);
        })
        .forEach(([key, param]) => {
          fields.push({ key, param });
        });
    }
    
    return fields;
  };

  // Render loading state
  if (loading) {
    return (
      <div className="h-full overflow-auto text-foreground dark:text-white">
        <NodePanelHeader nodeType={rawNodeType} nodeData={nodeData} />
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          <span className="ml-3">Loading operations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col text-foreground dark:text-white">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background dark:bg-[#09090b] ">
        <NodePanelHeader nodeType={rawNodeType} nodeData={nodeData} />
        {/* Top shadow when scrolled */}
        <div className={`h-2 bg-gradient-to-b from-gray-900/20 to-transparent absolute bottom-0 left-0 right-0 transform translate-y-full z-10 pointer-events-none transition-opacity duration-200 ${scrolledTop ? 'opacity-0' : 'opacity-100'}`}></div>
      </div>
      
      {/* Scrollable content including operations section */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-auto relative scroll-smooth"
        onScroll={handleScroll}
      >
        <div className="">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {operations.length > 0 && (
            <div className="mb-4">
              <OperationsDropdown
                operations={operations}
                selectedOperation={selectedOperation}
                onSelect={handleOperationChange}
                label="Available Operations"
                placeholder="Search operations..."
              />
            </div>
          )}
          
          {/* Description area */}
          {operationDetails?.description && (
            <div className="bg-muted dark:bg-[#0f0f10] p-3 rounded-md border border-input dark:border-zinc-800 mb-4">
              <p className="text-sm text-muted-foreground dark:text-gray-300">{operationDetails.description}</p>
            </div>
          )}
          
          {/* Required notice */}
          {operationDetails && (
            <div className="mb-4 flex items-center">
              <span className="text-red-500 font-bold text-lg mr-1">*</span>
              <span className="text-sm text-gray-300">Required fields</span>
            </div>
          )}

          {loadingOperation ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full"></div>
              <span className="ml-3">Loading operation details...</span>
            </div>
          ) : operationDetails ? (
            <form onSubmit={handleSubmit} className="pb-20">
              {/* All fields in one simple list */}
              <div className="space-y-2">
                {getAllFields().map(({ key, param }) => renderField(param, key))}
              </div>
            </form>
          ) : (
            <div className="py-2 text-center text-gray-300">
              {operations.length > 0 
                ? 'Select an operation to configure parameters' 
                : (
                  <div className="space-y-2">
                    <p>No operations found for node type: <strong>{rawNodeType}</strong></p>
                    <p className="text-sm">Check if this node type is correctly configured on the server.</p>
                    <p className="text-xs text-gray-400">Node type used for API call: {nodeType}</p>
                  </div>
                )
              }
            </div>
          )}
        </div>
      </div>
      
      {/* Sticky footer with smaller icons */}
      <div className="sticky bottom-0 z-10 bg-background dark:bg-[#09090b] border-t border-input dark:border-zinc-800 pt-4 pb-4 px-4">
        {/* Bottom shadow when scrolled */}
        <div className={`h-2 bg-gradient-to-t from-gray-900/20 to-transparent absolute top-0 left-0 right-0 transform -translate-y-full z-10 pointer-events-none transition-opacity duration-200 ${scrolledBottom ? 'opacity-0' : 'opacity-100'}`}></div>
        
        <div className="flex justify-between items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleExecute}
                  disabled={executingNode || !operationDetails}
                  className={`flex items-center justify-center w-9 h-9 rounded-full ${
                    executingNode 
                      ? 'bg-gray-700 text-gray-400' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } transition-all duration-200`}
                  type="button"
                >
                  {executingNode ? (
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{executingNode ? 'Executing...' : 'Execute node'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSubmit}
                  disabled={!operationDetails}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-green-600 hover:bg-green-700 text-white transition-all duration-200"
                  type="button"
                >
                  <Save className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save configuration</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export default DynamicNodeSettings;