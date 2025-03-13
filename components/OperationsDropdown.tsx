import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useDebounce from './useDebounce';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OperationsDropdownProps {
  operations: string[];
  selectedOperation: string;
  onSelect: (operation: string) => void;
  label?: string;
  placeholder?: string;
}

const OperationsDropdown: React.FC<OperationsDropdownProps> = ({
  operations,
  selectedOperation,
  onSelect,
  label = 'Operations',
  placeholder = 'Search operations...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 200);
  const [filteredOperations, setFilteredOperations] = useState<string[]>(operations);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter operations based on search query
  useEffect(() => {
    if (!debouncedQuery) {
      setFilteredOperations(operations);
      return;
    }

    const normalizedQuery = debouncedQuery.toLowerCase().trim();
    const filtered = operations.filter(op => 
      op.toLowerCase().includes(normalizedQuery)
    );
    
    setFilteredOperations(filtered);
  }, [debouncedQuery, operations]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Animation variants
  const container = {
    hidden: { opacity: 0, height: 0 },
    show: {
      opacity: 1,
      height: 'auto',
      transition: {
        height: { duration: 0.3 },
        opacity: { duration: 0.2 }
      }
    },
    exit: {
      opacity: 0,
      height: 0,
      transition: {
        height: { duration: 0.2 },
        opacity: { duration: 0.1 }
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 5 },
    show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -5, transition: { duration: 0.1 } }
  };

  const handleSelect = (operation: string) => {
    onSelect(operation);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="w-full space-y-2 mb-6" ref={dropdownRef}>
      {label && (
        <Label htmlFor="operations-dropdown" className="text-sm font-medium">
          {label}
        </Label>
      )}
      
      <div className="relative">
        {/* Selected operation display / dropdown toggle */}
        <div 
          className="flex items-center justify-between w-full p-2 border border-input dark:border-zinc-800 rounded-md 
                   cursor-pointer hover:bg-muted/50 dark:hover:bg-zinc-800/50 bg-background dark:bg-[#0f0f10] text-foreground dark:text-white"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="text-sm truncate">
            {selectedOperation || 'Select an operation'}
          </span>
          <span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
        </div>
        
        {/* Dropdown content */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="absolute z-50 w-full mt-1 bg-background dark:bg-zinc-900 border border-input 
                       dark:border-zinc-800 rounded-md shadow-lg overflow-hidden"
              variants={container}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {/* Search input */}
              <div className="p-2 border-b border-input dark:border-zinc-800">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder={placeholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="pl-8 pr-2 py-1 h-8 text-sm focus-visible:ring-offset-0 bg-background dark:bg-[#0f0f10] 
                              border-input dark:border-zinc-800 text-foreground dark:text-white"
                  />
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>
              
              {/* Operations list */}
              <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-zinc-700 
                            scrollbar-track-gray-100 dark:scrollbar-track-zinc-800">
                <motion.ul className="py-1">
                  {filteredOperations.length > 0 ? (
                    filteredOperations.map((operation) => (
                      <motion.li
                        key={operation}
                        variants={item}
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 dark:hover:bg-zinc-800 dark:text-gray-200
                                  ${selectedOperation === operation ? 'bg-muted dark:bg-zinc-700 font-medium' : ''}`}
                        onClick={() => handleSelect(operation)}
                      >
                        {operation}
                      </motion.li>
                    ))
                  ) : (
                    <motion.li 
                      variants={item} 
                      className="px-3 py-2 text-sm text-muted-foreground dark:text-gray-400 text-center"
                    >
                      No matching operations
                    </motion.li>
                  )}
                </motion.ul>
              </div>
              
              {operations.length > 10 && (
                <div className="p-2 border-t border-input dark:border-zinc-800 text-xs text-muted-foreground dark:text-gray-400">
                  {filteredOperations.length} of {operations.length} operations
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OperationsDropdown;