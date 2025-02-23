'use client';

import React from 'react';

// Basic Alert Components
export const Alert = ({
  children,
  variant = 'default',
  className = ''
}) => (
  <div className={`p-4 rounded-lg border ${variant === 'destructive' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-gray-50 border-gray-200 text-gray-900'} ${className}`}>
    {children}
  </div>
);

export const AlertTitle = ({ children }) => (
  <div className="font-semibold mb-1">{children}</div>
);

export const AlertDescription = ({ children }) => (
  <div className="text-sm opacity-90">{children}</div>
);