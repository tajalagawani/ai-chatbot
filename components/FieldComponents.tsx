import React, { useState } from 'react';
import { OptionBadges } from './OperationBadges';

// shadcn components
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Type definitions
export interface OperationParameter {
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

export interface FormFieldProps {
  param: OperationParameter;
  paramKey: string;
  initialValue: any;
  onChange: (key: string, value: any) => void;
}

// Separate components for each field type
export const StringField: React.FC<FormFieldProps> = ({ param, paramKey, initialValue, onChange }) => {
  const [value, setValue] = useState(initialValue !== undefined ? initialValue : param.default);
  
  const handleChange = (newValue: string) => {
    setValue(newValue);
    onChange(paramKey, newValue);
  };
  
  return (
    <div className="space-y-2 mb-6">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor={paramKey} className="flex items-center text-base">
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
          id={paramKey}
          type="text"
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={param.description}
          required={param.required}
          className="bg-background dark:bg-[#0f0f10] text-foreground dark:text-white hover:bg-background dark:hover:bg-[#0f0f10] 
                   focus:bg-background dark:focus:bg-[#0f0f10] border-input dark:border-zinc-800 transition-colors duration-200 p-1 mr-1"
        />
      </div>
    </div>
  );
};


export const EnumField: React.FC<FormFieldProps> = ({ param, paramKey, initialValue, onChange }) => {
  const [value, setValue] = useState(initialValue !== undefined ? initialValue : param.default);
  
  const handleChange = (newValue: string) => {
    setValue(newValue);
    onChange(paramKey, newValue);
  };
  
  return (
    <div className="space-y-2 mb-6">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor={paramKey} className="flex items-center text-base">
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
          onSelect={(option) => handleChange(option)}
          size="sm"
          variant="rounded"
        />
      </div>
    </div>
  );
};

export const TextareaField: React.FC<FormFieldProps> = ({ param, paramKey, initialValue, onChange }) => {
  const [value, setValue] = useState(initialValue !== undefined ? initialValue : param.default);
  
  const handleChange = (newValue: string) => {
    setValue(newValue);
    onChange(paramKey, newValue);
  };
  
  return (
    <div className="space-y-2 mb-6">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor={paramKey} className="flex items-center text-base">
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
          id={paramKey}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={param.description}
          rows={5}
          className="w-full bg-background dark:bg-[#0f0f10] text-foreground dark:text-white hover:bg-background dark:hover:bg-[#0f0f10] 
                  focus:bg-background dark:focus:bg-[#0f0f10] border-input dark:border-zinc-800 transition-colors duration-200"
        />
      </div>
    </div>
  );
};

export const SliderField: React.FC<FormFieldProps> = ({ param, paramKey, initialValue, onChange }) => {
  const [value, setValue] = useState(initialValue !== undefined ? initialValue : param.default);
  
  const handleChange = (newValue: number) => {
    setValue(newValue);
    onChange(paramKey, newValue);
  };
  
  return (
    <div className="space-y-2 mb-6">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor={paramKey} className="flex items-center justify-between text-base">
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
          id={paramKey}
          min={param.min_value}
          max={param.max_value}
          step={param.name === 'temperature' || param.name === 'top_p' ? 0.1 : 1}
          value={[value !== undefined && value !== null ? value : param.default]}
          onValueChange={(vals) => handleChange(vals[0])}
        />
      </div>
    </div>
  );
};

export const NumberField: React.FC<FormFieldProps> = ({ param, paramKey, initialValue, onChange }) => {
  const [value, setValue] = useState(initialValue !== undefined ? initialValue : param.default);
  
  const handleChange = (newValue: number | '') => {
    setValue(newValue);
    onChange(paramKey, newValue);
  };
  
  return (
    <div className="space-y-2 mb-6">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor={paramKey} className="flex items-center text-base">
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
          id={paramKey}
          type="number"
          value={value !== undefined && value !== null ? value : ''}
          onChange={(e) => {
            const val = e.target.value === '' ? '' : Number(e.target.value);
            handleChange(val);
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
};

export const BooleanField: React.FC<FormFieldProps> = ({ param, paramKey, initialValue, onChange }) => {
  const [value, setValue] = useState(initialValue || false);
  
  const handleChange = (newValue: boolean) => {
    setValue(newValue);
    onChange(paramKey, newValue);
  };
  
  return (
    <div className="flex items-center justify-between mb-6">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor={paramKey} className="flex items-center text-base">
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
        id={paramKey}
        checked={value}
        onCheckedChange={handleChange}
      />
    </div>
  );
};

export const ArrayField: React.FC<FormFieldProps> = ({ param, paramKey, initialValue, onChange }) => {
  const [value, setValue] = useState(initialValue !== undefined ? initialValue : []);
  const [textValue, setTextValue] = useState(JSON.stringify(initialValue || [], null, 2));
  
  const handleChange = (newValue: string) => {
    setTextValue(newValue);
    try {
      const parsed = newValue ? JSON.parse(newValue) : [];
      setValue(parsed);
      onChange(paramKey, parsed);
    } catch (err) {
      console.warn("Invalid JSON for array input:", err);
    }
  };
  
  return (
    <div className="space-y-2 mb-6">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor={paramKey} className="flex items-center text-base">
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
          id={paramKey}
          value={textValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Enter JSON array: ${param.description}`}
          rows={3}
          className="font-mono text-sm bg-background dark:bg-[#0f0f10] text-foreground dark:text-white 
                    hover:bg-background dark:hover:bg-[#0f0f10] focus:bg-background dark:focus:bg-[#0f0f10] 
                    border-input dark:border-zinc-800 transition-colors duration-200"
        />
      </div>
    </div>
  );
};

export const ObjectField: React.FC<FormFieldProps> = ({ param, paramKey, initialValue, onChange }) => {
  const [value, setValue] = useState(initialValue !== undefined ? initialValue : {});
  const [textValue, setTextValue] = useState(JSON.stringify(initialValue || {}, null, 2));
  
  const handleChange = (newValue: string) => {
    setTextValue(newValue);
    try {
      const parsed = newValue ? JSON.parse(newValue) : {};
      setValue(parsed);
      onChange(paramKey, parsed);
    } catch (err) {
      console.warn("Invalid JSON for object input:", err);
    }
  };
  
  return (
    <div className="space-y-2 mb-6">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor={paramKey} className="flex items-center text-base">
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
          id={paramKey}
          value={textValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Enter JSON object: ${param.description}`}
          rows={3}
          className="font-mono text-sm bg-background dark:bg-[#0f0f10] text-foreground dark:text-white 
                    hover:bg-background dark:hover:bg-[#0f0f10] focus:bg-background dark:focus:bg-[#0f0f10] 
                    border-input dark:border-zinc-800 transition-colors duration-200"
        />
      </div>
    </div>
  );
};

// Field renderer component that selects the appropriate field component
export const FieldRenderer: React.FC<FormFieldProps> = ({ param, paramKey, initialValue, onChange }) => {
  if (param.type === 'string') {
    if (param.enum) {
      return <EnumField param={param} paramKey={paramKey} initialValue={initialValue} onChange={onChange} />;
    } else if (paramKey === 'system' || paramKey === 'prompt' || (param.name && param.name.toLowerCase().includes('prompt'))) {
      return <TextareaField param={param} paramKey={paramKey} initialValue={initialValue} onChange={onChange} />;
    } else {
      return <StringField param={param} paramKey={paramKey} initialValue={initialValue} onChange={onChange} />;
    }
  } else if (param.type === 'number') {
    if (param.min_value !== null && param.max_value !== null) {
      return <SliderField param={param} paramKey={paramKey} initialValue={initialValue} onChange={onChange} />;
    } else {
      return <NumberField param={param} paramKey={paramKey} initialValue={initialValue} onChange={onChange} />;
    }
  } else if (param.type === 'boolean') {
    return <BooleanField param={param} paramKey={paramKey} initialValue={initialValue} onChange={onChange} />;
  } else if (param.type === 'array') {
    return <ArrayField param={param} paramKey={paramKey} initialValue={initialValue} onChange={onChange} />;
  } else if (param.type === 'object') {
    return <ObjectField param={param} paramKey={paramKey} initialValue={initialValue} onChange={onChange} />;
  } else {
    return <StringField param={param} paramKey={paramKey} initialValue={initialValue} onChange={onChange} />;
  }
};