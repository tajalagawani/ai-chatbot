import React from "react";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import VoiceWorkflowAssistant from "@/components/voice/VoiceWorkflowAssistant";

export default function Page() {
  return (
    <TranscriptProvider>
      <EventProvider>
        <VoiceWorkflowAssistant />
      </EventProvider>
    </TranscriptProvider>
  );
}
