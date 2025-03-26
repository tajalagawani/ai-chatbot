// components/ClientComponentWrapper.tsx
"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";

const VoiceControls = dynamic(
  () => import('@/components/voice/VoiceControls'),
  { ssr: false }
);

export function ClientWrapper({ chatId }: { chatId: string }) {
  return <VoiceControls chatId={chatId} />;
}