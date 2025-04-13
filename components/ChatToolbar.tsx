// ChatToolbar.tsx
'use client';

import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Copy, 
  MessageSquarePlus, 
  Download, 
  Share2, 
  RefreshCw, 
  Trash2, 
  ThumbsUp, 
  ThumbsDown,
  SlidersHorizontal
} from 'lucide-react';
import { type Message } from 'ai';

interface ChatToolbarProps {
  messages: Message[];
  isLoading: boolean;
  onClearChat: () => void;
  onCopyChat: () => void;
  onDownloadChat: () => void;
  onShareChat: () => void;
  onNewChat: () => void;
  onRefreshChat: () => void;
  onVoteUp: (messageId: string) => void;
  onVoteDown: (messageId: string) => void;
  onToggleSettings: () => void;
}

const ChatToolbar = ({
  messages,
  isLoading,
  onClearChat,
  onCopyChat,
  onDownloadChat,
  onShareChat,
  onNewChat,
  onRefreshChat,
  onVoteUp,
  onVoteDown,
  onToggleSettings
}: ChatToolbarProps) => {
  const hasMessages = messages.length > 0;
  
  return (
    <div className="px-2 py-1 flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center space-x-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                onClick={onNewChat}
                disabled={isLoading}
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                onClick={onRefreshChat}
                disabled={isLoading || !hasMessages}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                onClick={onClearChat}
                disabled={isLoading || !hasMessages}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear Chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {hasMessages ? `${messages.length} message${messages.length > 1 ? 's' : ''}` : 'No messages'}
      </div>
      
      <div className="flex items-center space-x-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                onClick={onCopyChat}
                disabled={isLoading || !hasMessages}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy Chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                onClick={onDownloadChat}
                disabled={isLoading || !hasMessages}
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download Chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                onClick={onToggleSettings}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default memo(ChatToolbar);