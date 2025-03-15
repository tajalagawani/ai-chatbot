import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Save, Play, AlertCircle } from 'lucide-react';
import OperationsDropdown from './OperationsDropdown';
import { FieldRenderer, OperationParameter } from './FieldComponents';

// shadcn components
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

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
  // Extract node type from the data
  const nodeType = useMemo(() => nodeData?.type || 'unknown', [nodeData?.type]);
  
  // Format node type for API calls
  const apiNodeType = useMemo(() => {
    if (!nodeType || nodeType === 'unknown') return 'unknown';
    
    // Handle common patterns
    const commonSuffixes = /(Node|Assistant|Api|Service|Provider|Generator|Processor)$/i;
    let simplified = nodeType.replace(commonSuffixes, '');
    
    // Handle special cases
    if (simplified.toLowerCase() === 'openai') return 'openai';
    if (simplified.toLowerCase() === 'claude') return 'claude';
    
    // Convert camelCase to lowercase
    return simplified.toLowerCase();
  }, [nodeType]);
  
  // State management - with optimized initial states
  const [operations, setOperations] = useState<string[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [currentOperation, setCurrentOperation] = useState<string>('');
  const [operationDetails, setOperationDetails] = useState<Operation | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingOperation, setLoadingOperation] = useState<boolean>(false);
  const [executingNode, setExecutingNode] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiDefinedFields, setApiDefinedFields] = useState<Set<string>>(new Set());
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
  
  // Use a ref to hold the local form values without causing re-renders
  const formValuesRef = useRef<any>({});

  // Extract essential props that should remain separate from operation data
  const essentialProps = useMemo(() => ['id', 'position_x', 'position_y', 'label', 'type'], []);
  
  // Process node data into initial form data - run only once and memoize result
  const initialFormData = useMemo(() => {
    if (!nodeData) return {};
    
    // Extract operation parameters from nodeData
    const operationParams = { ...nodeData };
    essentialProps.forEach(prop => delete operationParams[prop]);
    
    // Remove internal properties
    Object.keys(operationParams).forEach(key => {
      if (key.startsWith('_') || key === 'nodeKind' || key === 'executionResponse' || key === 'status') {
        delete operationParams[key];
      }
    });
    
    console.log("Processed initial form data:", operationParams);
    return operationParams;
  }, [nodeData, essentialProps]);
  
  // Initialize form data from processed initial data - only when component mounts
  useEffect(() => {
    if (!initialLoadComplete) {
      console.log("Initializing form data from:", initialFormData);
      setFormData(initialFormData);
      formValuesRef.current = {...initialFormData};
      
      // Set initial operation if available
      if (initialFormData.operation) {
        setSelectedOperation(initialFormData.operation);
        setCurrentOperation(initialFormData.operation);
      }
      
      setInitialLoadComplete(true);
    }
  }, [initialFormData, initialLoadComplete]);

  // Define fetchOperationDetails before it's used in any dependency arrays
  const fetchOperationDetails = useCallback(async (operation: string) => {
    if (!operation || !apiNodeType || apiNodeType === 'unknown') return;
    
    setLoadingOperation(true);
    setError(null);
    
    try {
      console.log(`Fetching details for operation: ${operation}`);
      const response = await fetch(`${API_BASE_URL}/nodes/${apiNodeType}/operations/${operation}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch operation details (HTTP ${response.status})`);
      }
      
      const data = await response.json();
      
      // Process the API response into our expected format
      const processedOperation: Operation = {
        name: operation,
        description: data.note || data.description || `${operation} operation`,
        type: apiNodeType,
        implemented: true,
        documentation: data.documentation || "",
        parameters: {
          common: {},
          operation_specific: {}
        },
        example: data.example || {}
      };
      
      // Convert parameters from API format
      const parameterFields = new Set<string>();
      parameterFields.add('operation'); // Always include operation
      
      if (Array.isArray(data.parameters)) {
        data.parameters.forEach((param: any) => {
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
          
          processedOperation.parameters.operation_specific[param.name] = processedParam;
          parameterFields.add(param.name);
        });
      }
      
      setOperationDetails(processedOperation);
      setApiDefinedFields(parameterFields);
      
      // If operation changed, reset form data to keep only relevant fields
      const isOperationChange = operation !== currentOperation;
      
      if (isOperationChange) {
        console.log(`Operation changed from ${currentOperation} to ${operation}, updating form data`);
        
        // Create new form data with only the operation field
        const newFormData = { operation };
        
        // For all API-defined parameters:
        // 1. Use value from current node if operation is the same
        // 2. Use API default for new operation
        Object.entries(processedOperation.parameters.operation_specific).forEach(([key, param]) => {
          if (isOperationChange || !formData[key]) {
            // For new operation or missing field, use default
            if (param.default !== null) {
              newFormData[key] = param.default;
            }
          } else {
            // For existing fields in same operation, keep current value
            newFormData[key] = formData[key];
          }
        });
        
        console.log("New form data after operation change:", newFormData);
        setFormData(newFormData);
        formValuesRef.current = {...newFormData};
        setCurrentOperation(operation);
      }
    } catch (err) {
      console.error("Error fetching operation details:", err);
      setError(`Failed to load operation details: ${err.message}`);
    } finally {
      setLoadingOperation(false);
    }
  }, [apiNodeType, currentOperation, formData]);

  // Fetch available operations from API
  useEffect(() => {
    const fetchOperations = async () => {
      if (!apiNodeType || apiNodeType === 'unknown') return;
      
      setLoading(true);
      setError(null);
      
      try {
        const operationsPromise = fetch(`${API_BASE_URL}/nodes/${apiNodeType}/operations`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to fetch operations (HTTP ${response.status})`);
            }
            return response.json();
          });
        
        // Set a timeout to prevent UI freezing
        const timeoutPromise = new Promise(resolve => 
          setTimeout(() => resolve({ timeout: true }), 5000)
        );
        
        // Race between fetching data and timeout
        const result: any = await Promise.race([operationsPromise, timeoutPromise]);
        
        // If timeout occurred, keep loading but don't block UI
        if (result.timeout) {
          console.warn("Operations fetch taking longer than expected, continuing in background");
          
          // Continue fetching in background
          operationsPromise.then(data => {
            processOperationsData(data);
            setLoading(false);
          }).catch(err => {
            console.error("Background operations fetch error:", err);
            setError(`Failed to load operations: ${err.message}`);
            setLoading(false);
          });
          
          return;
        }
        
        processOperationsData(result);
      } catch (err) {
        console.error("Error fetching operations:", err);
        setError(`Failed to load operations: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    // Function to process operations data with consistent handling for different formats
    const processOperationsData = (data: any) => {
      // Extract operations list based on response format
      let operationsList = [];
      
      if (data.operations && typeof data.operations === 'object') {
        operationsList = Object.keys(data.operations);
      } else if (data.operations_count > 0) {
        operationsList = Object.keys(data.operations || {});
      } else if (Array.isArray(data)) {
        operationsList = data;
      } else if (typeof data === 'object' && data !== null) {
        operationsList = Object.keys(data).filter(key => 
          typeof data[key] === 'object' && 
          data[key] !== null && 
          !key.startsWith('_')
        );
      }
      
      console.log(`Available operations:`, operationsList);
      
      if (operationsList.length > 0) {
        setOperations(operationsList);
        
        // Initialize with operation from form data or first available
        const initialOperation = formData.operation || operationsList[0];
        if (initialOperation) {
          setSelectedOperation(initialOperation);
          fetchOperationDetails(initialOperation);
        }
      } else {
        console.warn(`No operations found for ${apiNodeType}`);
        setOperations([]);
      }
    };

    if (apiNodeType && initialLoadComplete) {
      fetchOperations();
    }
  }, [apiNodeType, formData.operation, initialLoadComplete, fetchOperationDetails]);

  // Handle operation change
  const handleOperationChange = (operation: string) => {
    if (operation === selectedOperation) return;
    
    // Confirm if there are unsaved changes
    if (!confirm("Changing operations will reset your changes. Continue?")) {
      return;
    }
    
    console.log(`Changing operation to: ${operation}`);
    setSelectedOperation(operation);
    fetchOperationDetails(operation);
  };

  // Handle form field changes - now using the ref instead of state
  const handleInputChange = (paramName: string, value: any) => {
    formValuesRef.current[paramName] = value;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    // Create an object with just the essential node properties
    const essentialNodeProps = {};
    
    // Copy essential properties from original node data
    essentialProps.forEach(prop => {
      if (nodeData[prop] !== undefined) {
        essentialNodeProps[prop] = nodeData[prop];
      }
    });
    
    // Get the valid parameters for current operation ONLY
    const validParameters = new Set(['operation']);
    if (operationDetails?.parameters?.operation_specific) {
      Object.keys(operationDetails.parameters.operation_specific).forEach(key => {
        validParameters.add(key);
      });
    }
    
    // Create a clean form data object with ONLY valid parameters
    const cleanFormData = {};
    Object.keys(formValuesRef.current).forEach(key => {
      // Only include parameters that are valid for the current operation
      if (validParameters.has(key)) {
        cleanFormData[key] = formValuesRef.current[key];
      }
    });
    
    // Create a COMPLETELY NEW _originalProperties array with ONLY current valid properties
    const newOriginalProperties = [
      ...essentialProps.filter(prop => nodeData[prop] !== undefined),
      ...Object.keys(cleanFormData)
    ];
    
    // Combine essential properties with clean form data
    const completeNodeData = {
      ...essentialNodeProps,
      ...cleanFormData,
      // Add the NEW _originalProperties array 
      _originalProperties: newOriginalProperties
    };
    
    console.log("Saving node with clean data:", completeNodeData);
    console.log("Removed obsolete properties:", 
      Object.keys(formValuesRef.current).filter(key => !validParameters.has(key))
    );
    console.log("New _originalProperties:", newOriginalProperties);
    
    // Update the form data state to match the cleaned data
    setFormData({...cleanFormData});
    
    // Call the parent's save function with completely clean data
    onSave(completeNodeData);
  };

  // Execute the node with current parameters
  const handleExecute = async () => {
    setExecutingNode(true);
    setError(null);
    
    try {
      console.log(`Executing ${apiNodeType} with params:`, formValuesRef.current);
      
      const response = await fetch(`${API_BASE_URL}/execute/${apiNodeType}`, {
        method: 'POST',
        headers: {
          body: JSON.stringify(formValuesRef.current)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to execute node');
        }
        
        const result = await response.json();
        console.log("Execution result:", result);
        
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
  
    // Sort and organize parameters for display - memoized to prevent recalculation
    const organizedFields = useMemo(() => {
      if (!operationDetails?.parameters?.operation_specific) return [];
      
      const fields = [];
      
      // First add all required parameters
      Object.entries(operationDetails.parameters.operation_specific)
        .filter(([key, param]) => param.required && key !== 'operation')
        .forEach(([key, param]) => {
          fields.push({ key, param });
        });
      
      // Then add all optional parameters
      Object.entries(operationDetails.parameters.operation_specific)
        .filter(([key, param]) => !param.required && key !== 'operation')
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([key, param]) => {
          fields.push({ key, param });
        });
      
      return fields;
    }, [operationDetails]);
  
    // Check if current form has obsolete properties - memoized
    const obsoleteProps = useMemo(() => {
      if (!operationDetails) return [];
      
      const validFields = new Set(['operation']);
      Object.keys(operationDetails.parameters.operation_specific).forEach(key => {
        validFields.add(key);
      });
      
      return Object.keys(formValuesRef.current).filter(key => !validFields.has(key));
    }, [operationDetails]);
  
    // Render a skeleton UI while loading initial data
    const renderSkeleton = () => (
      <div>
        <div className="h-6 w-24 bg-gray-700 rounded animate-pulse mb-4"></div>
        <div className="h-10 w-full bg-gray-700 rounded animate-pulse mb-6"></div>
        <div className="space-y-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 bg-gray-700 rounded animate-pulse"></div>
              <div className="h-10 w-full bg-gray-700 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  
    // Early render for loading state with skeleton UI
    if (loading && !initialLoadComplete) {
      return (
        <div className="h-full overflow-auto text-foreground dark:text-white p-4">
          <div className="pb-3">
            <h3 className="text-lg font-medium mb-1">
              {nodeType || 'Node'} Settings
            </h3>
            <p className="text-sm text-muted-foreground dark:text-gray-300">
              Loading parameters...
            </p>
          </div>
          {renderSkeleton()}
        </div>
      );
    }
  
    return (
      <div className="h-full overflow-auto text-foreground dark:text-white">
        <div className="pb-3 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium mb-1">
              {nodeType || 'Node'} Settings
            </h3>
            <p className="text-sm text-muted-foreground dark:text-gray-300">
              Configure node parameters for {selectedOperation || 'this operation'}
            </p>
          </div>
        </div>
        
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {operations.length > 0 && (
          <OperationsDropdown
            operations={operations}
            selectedOperation={selectedOperation}
            onSelect={handleOperationChange}
            label="Available Operations"
            placeholder="Search operations..."
          />
        )}
        
        {loadingOperation ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex justify-start items-center py-2">
              <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
              <span>Loading operation parameters...</span>
            </div>
            {renderSkeleton()}
          </div>
        ) : operationDetails ? (
          <form onSubmit={handleSubmit} className="mt-4">
            {/* Operation description */}
            {operationDetails.description && (
              <div className="bg-muted dark:bg-[#0f0f10] p-3 rounded-md border border-input dark:border-zinc-800 mb-6">
                <p className="text-sm text-muted-foreground dark:text-gray-300">{operationDetails.description}</p>
              </div>
            )}
            
            {/* Required notice */}
            <div className="mb-4 flex items-center">
              <span className="text-red-500 font-bold text-lg mr-1">*</span>
              <span className="text-sm text-gray-300">Required fields</span>
            </div>
            
            {/* Obsolete properties warning */}
            {obsoleteProps.length > 0 && (
              <Alert variant="warning" className="mb-6 bg-amber-900/30 border-amber-600 text-amber-200">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-amber-200">Obsolete Properties Detected</AlertTitle>
                <AlertDescription className="text-amber-300/80">
                  <p className="mb-2">The following properties are not recognized by the current operation and will be removed when saving:</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {obsoleteProps.map(prop => (
                      <Badge key={prop} variant="outline" className="border-amber-500 text-amber-300">{prop}</Badge>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {/* Parameters fields */}
            <div className="space-y-2">
              {organizedFields.map(({ key, param }) => (
                <FieldRenderer 
                  key={key} 
                  param={param} 
                  paramKey={key} 
                  initialValue={formData[key]} 
                  onChange={handleInputChange} 
                />
              ))}
            </div>
            
            {/* Buttons */}
            <div className="flex justify-between pt-4 border-t mt-8 border-input dark:border-zinc-800">
              <Button
                variant="outline"
                onClick={handleExecute}
                disabled={executingNode || !operationDetails}
                className="flex items-center gap-2 px-4 bg-background dark:bg-[#0f0f10] text-foreground dark:text-white 
                        hover:bg-muted dark:hover:bg-zinc-800 border-input dark:border-zinc-800"
                type="button"
              >
                {executingNode ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>Execute</span>
                  </>
                )}
              </Button>
              
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={!operationDetails}
                className="flex items-center gap-2 px-4 bg-green-600 hover:bg-green-700 text-white"
              >
                <Save className="h-4 w-4" />
                <span>Save</span>
              </Button>
            </div>
            
            {/* Parameter validation guidance */}
            {operationDetails.documentation && (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <details className="text-sm">
                  <summary className="cursor-pointer text-blue-400 hover:text-blue-300">Parameter documentation</summary>
                  <div className="mt-2 p-3 bg-gray-900 rounded text-gray-300">
                    <div dangerouslySetInnerHTML={{ __html: operationDetails.documentation }} />
                  </div>
                </details>
              </div>
            )}
          </form>
        ) : (
          <div className="py-4 text-center">
            {operations.length > 0 
              ? 'Select an operation to configure parameters' 
              : `No operations found for node type: ${nodeType}`
            }
          </div>
        )}
        
        {/* Show current node data in debug mode */}
        <div className="mt-6 pt-2 border-t border-gray-700 text-xs">
          <details>
            <summary className="cursor-pointer text-gray-500 hover:text-gray-400">Debug: Current Node Data</summary>
            <div className="mt-2 p-2 bg-gray-900 rounded overflow-auto max-h-40">
              <pre className="text-gray-400">{JSON.stringify(nodeData, null, 2)}</pre>
            </div>
          </details>
          
          <details className="mt-2">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-400">Debug: Current Form Data</summary>
            <div className="mt-2 p-2 bg-gray-900 rounded overflow-auto max-h-40">
              <pre className="text-gray-400">{JSON.stringify(formValuesRef.current, null, 2)}</pre>
            </div>
          </details>
        </div>
      </div>
    );
  };
  
  export default DynamicNodeSettings;