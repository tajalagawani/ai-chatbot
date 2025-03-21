"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

// Enhanced JSON viewer component with line numbers
const JsonOut = ({ code, editable = false, onChange = () => {} }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  // Split code into lines for line numbering
  const codeLines = useMemo(() => {
    return code.split('\n');
  }, [code]);

  return (
    <div className="relative h-full">
      <div className="flex h-full rounded-md overflow-hidden">
        {/* Line numbers column */}
        <div className="py-4 pr-2 text-right bg-[#0f0f10] border-r border-gray-700 select-none">
          {codeLines.map((_, index) => (
            <div key={index} className="text-gray-500 text-xs leading-5 px-2">
              {index + 1}
            </div>
          ))}
        </div>
        
        {/* Code content */}
        <pre className="p-4 rounded-md overflow-auto h-full flex-1 bg-[#0f0f10] text-gray-300">
          <code>
            {codeLines.map((line, index) => (
              <div key={index} className="leading-5">
                {line || ' '}
              </div>
            ))}
          </code>
        </pre>
      </div>
      
      <Button 
        variant="ghost" 
        size="sm" 
        className="absolute top-2 right-2" 
        onClick={copyToClipboard}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </Button>
    </div>
  );
};

export default JsonOut;