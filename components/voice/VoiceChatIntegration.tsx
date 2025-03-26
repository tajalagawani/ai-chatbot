"use client";

import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useCallback, useEffect } from "react";

// This component will sync transcript messages with the chat UI
export function VoiceChatIntegration({ 
  chatId, 
  append, 
  messages 
}: { 
  chatId: string;
  append: (message: any) => void;
  messages: any[];
}) {
  const { transcriptItems } = useTranscript();
  
  // Function to sync new transcript messages to the chat UI
  const syncTranscriptToChat = useCallback(() => {
    if (!transcriptItems.length) return;
    
    // Find transcript messages that aren't already in the chat
    const existingMessageIds = new Set(messages.map(m => m.id));
    
    transcriptItems.forEach(item => {
      if (
        item.type === "MESSAGE" && 
        item.status === "DONE" && 
        !item.isHidden && 
        !existingMessageIds.has(item.itemId)
      ) {
        // Add the transcript message to the chat
        append({
          id: item.itemId,
          content: item.title || "",
          role: item.role,
          createdAt: new Date(item.createdAtMs || Date.now()),
        });
      }
    });
  }, [transcriptItems, messages, append]);

  // Sync transcript messages when they change
  useEffect(() => {
    syncTranscriptToChat();
  }, [transcriptItems, syncTranscriptToChat]);

  return null; // This is a logic-only component
}