// In your VoiceControlsWrapper.tsx file:

import React from 'react';
import { useEvent } from '../../app/contexts/EventContext';
import VoiceControls from './VoiceControls';
import { useTranscript } from '@/app/contexts/TranscriptContext';

interface VoiceControlsWrapperProps {
  chatId: string;
  onTranscriptionComplete?: (text: string) => void;
  // Add document props
  documentId?: string;
  documentTitle?: string; 
  documentContent?: string;
  documentKind?: string;
}

export default function VoiceControlsWrapper({
  chatId,
  onTranscriptionComplete,
  // Pass document props 
  documentId,
  documentTitle,
  documentContent,
  documentKind
}: VoiceControlsWrapperProps) {
  const { transcript, setTranscript } = useTranscript();
  const { dispatch } = useEvent();
  
  // Handle transcription from voice controls
  const handleTranscription = (text: string) => {
    if (!text) return;
    
    // Update transcript in context
    setTranscript(text);
    
    // Dispatch event if needed
    dispatch({ type: 'transcription', payload: { text } });
    
    // If callback provided, call it
    if (onTranscriptionComplete) {
      onTranscriptionComplete(text);
    }
  };
  
  return (
    <VoiceControls 
      chatId={chatId}
      onTranscription={handleTranscription}
      // Pass document props to VoiceControls
      documentId={documentId}
      documentTitle={documentTitle}
      documentContent={documentContent}
      documentKind={documentKind}
    />
  );
}