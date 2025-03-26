
"use client";

import React from "react";
import VoiceControls from "./../voice/VoiceControls";

export function ClientWrapper({ chatId }: { chatId: string }) {
  return <VoiceControls chatId={chatId} />;
}