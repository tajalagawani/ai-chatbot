'use client';

import React from 'react';
import { LogsIcon, MessageIcon } from '@/components/icons';

export const toolbar = [
  {
    icon: <MessageIcon />,
    label: 'Add Comments',
    description: 'Add comments to the ACT configuration',
    onClick: ({ appendMessage }) => {
      appendMessage({
        role: 'user',
        content: 'Add comments to the ACT configuration for better understanding',
      });
    },
  },
  {
    icon: <LogsIcon />,
    label: 'Add Documentation',
    description: 'Add node documentation',
    onClick: ({ appendMessage }) => {
      appendMessage({
        role: 'user',
        content: 'Add detailed documentation for each node in the workflow',
      });
    },
  }
];

export default toolbar;