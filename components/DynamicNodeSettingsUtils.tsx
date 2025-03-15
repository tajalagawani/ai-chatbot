import React from 'react';
import { OperationParameter } from './DynamicNodeSettingsTypes';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { OptionBadges } from './OperationBadges';

// Format node type - convert camelCase to lowercase simple name
export const formatNodeType = (type: string): string => {
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

// Helper function to get all fields for the current operation
export const getAllFields = (operationDetails: any) => {
  if (!operationDetails) return [];
  
  const fields = [];
  
  // First add all required parameters
  if (operationDetails.parameters.operation_specific) {
    Object.entries(operationDetails.parameters.operation_specific)
      .filter(([key, param]) => (param as OperationParameter).required && key !== 'operation')
      .forEach(([key, param]) => {
        fields.push({ key, param });
      });
  }
  
  // Then add all optional parameters
  if (operationDetails.parameters.operation_specific) {
    Object.entries(operationDetails.parameters.operation_specific)
      .filter(([key, param]) => !(param as OperationParameter).required && key !== 'operation')
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

// Render form fields based on parameter type
export const renderField = (
  param: OperationParameter, 
  key: string, 
  formData: any, 
  handleInputChange: (paramName: string, value: any) => void
) => {
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

// Initialize form data from nodeData
export const initializeFormData = (nodeData: any, nodeType: string) => {
  if (!nodeData) return {};
  
  // First, initialize with formData if present
  if (nodeData.formData) {
    console.log("Initializing form from nodeData.formData:", nodeData.formData);
    return nodeData.formData;
  } else {
    // If no formData, create one from node properties
    const initialFormData: any = { 
      operation: nodeData.operation || '',
      type: nodeData.type || nodeType 
    };
    
    // Add all non-internal properties from node data
    Object.entries(nodeData).forEach(([key, value]) => {
      if (!key.startsWith('_') && 
          key !== 'id' && 
          key !== 'data' && 
          key !== 'position' && 
          key !== 'connectedInputNodes' &&
          key !== 'connectedOutputNodes' &&
          key !== 'executionResponse' &&
          key !== 'status' &&
          value !== undefined && 
          value !== null) {
        initialFormData[key] = value;
      }
    });
    
    console.log("Created initial form data from node properties:", initialFormData);
    return initialFormData;
  }
};