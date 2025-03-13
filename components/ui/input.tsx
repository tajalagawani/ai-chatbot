import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

// Simple static dropdown component
const CommandDropdown = ({ isOpen, onSelectCommand }) => {
  if (!isOpen) return null;
  
  // Simple static command list
  const commands = [
    "Insert Date",
    "Format as Code",
    "Add Heading",
    "Insert Table",
    "Add List"
  ];
  
  const handleClick = (cmd) => {
    console.log("Command clicked:", cmd);
    onSelectCommand(cmd);
  };
  
  return (
    <div className="absolute z-10 mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-md shadow-lg">
      <ul className="py-1">
        {commands.map((cmd, index) => (
          <li 
            key={index}
            className="px-3 py-2 hover:bg-zinc-800 cursor-pointer text-white text-sm"
            onClick={() => handleClick(cmd)}
          >
            {cmd}
          </li>
        ))}
      </ul>
    </div>
  );
};

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, onChange, ...props }, ref) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const localRef = useRef<HTMLInputElement>(null);
    
    // Track the previous character for "//" detection
    const prevCharRef = useRef<string | null>(null);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      
      // Pass the event to the original onChange if provided
      if (onChange) {
        onChange(e);
      }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Check for keyboard input of '/'
      if (e.key === '/') {
        // If the previous key was also '/', open the dropdown
        if (prevCharRef.current === '/') {
          setShowDropdown(true);
          // Optionally prevent the second slash from appearing
          // e.preventDefault();
          prevCharRef.current = null; // Reset
        } else {
          prevCharRef.current = '/';
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        // Close dropdown when user deletes text
        setShowDropdown(false);
        prevCharRef.current = null;
      } else {
        // Reset if any other key is pressed
        prevCharRef.current = null;
      }
      
      // Close dropdown on escape
      if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    };
    
    const handleSelectCommand = (command: string) => {
      console.log("handleSelectCommand called with:", command);
      
      // Get the current input element and cursor position
      const inputElement = localRef.current;
      if (!inputElement) {
        console.log("Input element reference is null");
        return;
      }
      
      const cursorPosition = inputElement.selectionStart || 0;
      const textBeforeCursor = inputValue.substring(0, cursorPosition);
      const textAfterCursor = inputValue.substring(cursorPosition);
      
      // Find the last "//" before the cursor
      const lastSlashesIndex = textBeforeCursor.lastIndexOf("//");
      
      if (lastSlashesIndex >= 0) {
        // Replace the "//" with the command
        const textBeforeSlashes = textBeforeCursor.substring(0, lastSlashesIndex);
        const newValue = textBeforeSlashes + command + " " + textAfterCursor;
        
        console.log("Replacing // with command:", newValue);
        
        // Update the input value
        setInputValue(newValue);
        
        // If there's an external onChange handler, call it
        if (onChange) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, "value"
          )?.set;
          
          if (nativeInputValueSetter && inputElement) {
            // Set the value directly on the DOM element
            nativeInputValueSetter.call(inputElement, newValue);
            
            // Create and dispatch an input event
            const inputEvent = new Event('input', { bubbles: true });
            inputElement.dispatchEvent(inputEvent);
          } else {
            // Fallback to simulating an event
            const event = {
              target: { value: newValue }
            } as React.ChangeEvent<HTMLInputElement>;
            onChange(event);
          }
        }
        
        // Set focus and cursor position
        setTimeout(() => {
          if (inputElement) {
            inputElement.focus();
            const newCursorPosition = textBeforeSlashes.length + command.length + 1;
            inputElement.setSelectionRange(newCursorPosition, newCursorPosition);
          }
        }, 10);
      } else {
        console.log("Could not find // in text before cursor");
      }
      
      // Close the dropdown
      setShowDropdown(false);
    };
    
    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (localRef.current && !localRef.current.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      };
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    return (
      <div className="relative w-full">
        <input
          type={type}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex h-10 w-full rounded-md border border-zinc-800 bg-[#0f0f10] px-2 py-2 text-base text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:ring-offset-0 hover:border-zinc-700 hover:bg-[#0f0f10] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-gray-200 dark:placeholder-gray-500',
            className,
          )}
          ref={(element) => {
            // Handle both refs
            localRef.current = element;
            if (typeof ref === 'function') ref(element);
            else if (ref) ref.current = element;
          }}
          {...props}
        />
        {showDropdown && (
          <CommandDropdown 
            isOpen={showDropdown} 
            onSelectCommand={handleSelectCommand} 
          />
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input };