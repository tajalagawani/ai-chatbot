import React from 'react';

interface OperationBadgesProps {
  operations: string[];
  selectedOperation: string;
  onSelect: (operation: string) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'pill' | 'rounded';
}

interface OptionBadgesProps {
  options: string[];
  selectedOption: string | null;
  onSelect: (option: string) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'pill' | 'rounded';
}

// Operations badges component
export const OperationBadges: React.FC<OperationBadgesProps> = ({
  operations,
  selectedOperation,
  onSelect,
  size = 'md',
  variant = 'pill'
}) => {
  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  // Variant classes
  const variantClasses = {
    pill: 'rounded-full',
    rounded: 'rounded-md'
  };

  return (
    <div className="flex flex-wrap gap-2">
      {operations.map((op) => (
        <button
          key={op}
          type="button"
          onClick={() => onSelect(op)}
          className={`${sizeClasses[size]} ${variantClasses[variant]} font-medium transition-colors border
            ${selectedOperation === op 
              ? 'bg-primary text-primary-foreground border-primary shadow-sm dark:bg-blue-600 dark:border-blue-700 dark:text-white' 
              : 'bg-background border-input text-foreground hover:bg-muted dark:bg-[#0f0f10] dark:border-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-800'
            }`}
        >
          {op}
        </button>
      ))}
    </div>
  );
};

// Option badges component for form fields
export const OptionBadges: React.FC<OptionBadgesProps> = ({
  options,
  selectedOption,
  onSelect,
  size = 'sm',
  variant = 'rounded'
}) => {
  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  // Variant classes
  const variantClasses = {
    pill: 'rounded-full',
    rounded: 'rounded-md'
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className={`${sizeClasses[size]} ${variantClasses[variant]} font-medium transition-colors border
            ${selectedOption === option 
              ? 'bg-primary text-primary-foreground border-primary dark:bg-blue-600 dark:border-blue-700 dark:text-white' 
              : 'bg-background border-input text-foreground hover:bg-muted dark:bg-[#0f0f10] dark:border-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-800'
            }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
};

export default { OperationBadges, OptionBadges };