"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { createRealtimeConnection } from "@/lib/voice/realtimeConnection";

// You may need to adjust these imports based on your project structure
import { Button } from "@/components/ui/button";
import { Mic, MicOff, X } from "lucide-react";

interface VoiceAssistantControlsProps {
  chatId: string;
}

export default function VoiceAssistantControls({ chatId }: VoiceAssistantControlsProps) {
  const { addTranscriptMessage, updateTranscriptMessage, updateTranscriptItemStatus } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [sessionStatus, setSessionStatus] = useState<"DISCONNECTED" | "CONNECTING" | "CONNECTED">("DISCONNECTED");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Connect to realtime API
  const connectToRealtime = async () => {
    if (sessionStatus !== "DISCONNECTED") return;
    setSessionStatus("CONNECTING");

    try {
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) {
        return;
      }

      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement("audio");
      }
      audioElementRef.current.autoplay = isAudioPlaybackEnabled;

      const { pc, dc } = await createRealtimeConnection(
        EPHEMERAL_KEY,
        audioElementRef
      );
      pcRef.current = pc;
      dcRef.current = dc;

      dc.addEventListener("open", () => {
        logClientEvent({}, "data_channel.open");
        setSessionStatus("CONNECTED");
      });
      
      dc.addEventListener("close", () => {
        logClientEvent({}, "data_channel.close");
        setSessionStatus("DISCONNECTED");
      });
      
      dc.addEventListener("error", (err: any) => {
        logClientEvent({ error: err }, "data_channel.error");
        setSessionStatus("DISCONNECTED");
      });
      
      dc.addEventListener("message", (e: MessageEvent) => {
        handleServerEvent(JSON.parse(e.data));
      });

    } catch (err) {
      console.error("Error connecting to realtime:", err);
      setSessionStatus("DISCONNECTED");
    }
  };

  // Fetch ephemeral key for authentication
  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    try {
      const tokenResponse = await fetch("/api/session");
      const data = await tokenResponse.json();
      logServerEvent(data, "fetch_session_token_response");

      if (!data.client_secret?.value) {
        logClientEvent(data, "error.no_ephemeral_key");
        console.error("No ephemeral key provided by the server");
        setSessionStatus("DISCONNECTED");
        return null;
      }

      return data.client_secret.value;
    } catch (error) {
      console.error("Error fetching ephemeral key:", error);
      setSessionStatus("DISCONNECTED");
      return null;
    }
  };

  // Handle messages from the server
  const handleServerEvent = (event: any) => {
    logServerEvent(event);
    
    // Process different event types
    if (event.type === "conversation.item.create") {
      const { id, role, content } = event.item;
      
      if (role === "assistant") {
        // Handle assistant message
        const text = content[0]?.text || "";
        addTranscriptMessage(id, "assistant", text);
      }
    } 
    else if (event.type === "conversation.item.update") {
      const { id, content } = event.item;
      const text = content[0]?.text || "";
      updateTranscriptMessage(id, text, false);
    }
    else if (event.type === "conversation.item.done") {
      updateTranscriptItemStatus(event.item_id, "DONE");
    }
    // Add more event handlers as needed
  };

  // Send event to the server
  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    if (dcRef.current && dcRef.current.readyState === "open") {
      logClientEvent(eventObj, eventNameSuffix);
      dcRef.current.send(JSON.stringify(eventObj));
    } else {
      logClientEvent(
        { attemptedEvent: eventObj.type },
        "error.data_channel_not_open"
      );
      console.error(
        "Failed to send message - no data channel available",
        eventObj
      );
    }
  };

  // Disconnect from realtime API
  const disconnectFromRealtime = () => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });

      pcRef.current.close();
      pcRef.current = null;
    }
    dcRef.current = null;
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);
  };

  // PTT button handlers
  const handleTalkButtonDown = () => {
    if (sessionStatus !== "CONNECTED" || !dcRef.current || dcRef.current.readyState !== "open") return;
    
    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: "input_audio_buffer.clear" }, "clear PTT buffer");
  };

  const handleTalkButtonUp = () => {
    if (
      sessionStatus !== "CONNECTED" ||
      !dcRef.current ||
      dcRef.current.readyState !== "open" ||
      !isPTTUserSpeaking
    ) return;

    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: "input_audio_buffer.commit" }, "commit PTT");
    sendClientEvent({ type: "response.create" }, "trigger response PTT");
  };

  // Load preferences from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPushToTalkUI = localStorage.getItem("pushToTalkUI");
      if (storedPushToTalkUI) {
        setIsPTTActive(storedPushToTalkUI === "true");
      }
      
      const storedAudioPlaybackEnabled = localStorage.getItem("audioPlaybackEnabled");
      if (storedAudioPlaybackEnabled) {
        setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
      }
    }
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("pushToTalkUI", isPTTActive.toString());
    }
  }, [isPTTActive]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("audioPlaybackEnabled", isAudioPlaybackEnabled.toString());
    }
  }, [isAudioPlaybackEnabled]);

  // Update audio element when playback setting changes
  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        audioElementRef.current.pause();
      }
    }
  }, [isAudioPlaybackEnabled]);

  // Render voice controls
  return (
    <div className="fixed bottom-24 right-4 flex flex-col gap-2">
      {sessionStatus === "DISCONNECTED" ? (
        <Button 
          onClick={connectToRealtime}
          variant="outline" 
          size="icon"
          title="Enable voice"
        >
          <Mic className="h-4 w-4" />
        </Button>
      ) : (
        <>
          <Button 
            onClick={disconnectFromRealtime}
            variant="outline" 
            size="icon"
            title="Disable voice"
          >
            <X className="h-4 w-4" />
          </Button>
          
          <Button
            variant={isPTTUserSpeaking ? "default" : "outline"}
            size="icon"
            onMouseDown={handleTalkButtonDown}
            onMouseUp={handleTalkButtonUp}
            onTouchStart={handleTalkButtonDown}
            onTouchEnd={handleTalkButtonUp}
            disabled={sessionStatus !== "CONNECTED"}
            title="Push to talk"
          >
            <Mic className="h-4 w-4" />
          </Button>
          
          <Button
            variant={isAudioPlaybackEnabled ? "default" : "outline"}
            size="icon"
            onClick={() => setIsAudioPlaybackEnabled(!isAudioPlaybackEnabled)}
            title={isAudioPlaybackEnabled ? "Mute audio" : "Unmute audio"}
          >
            {isAudioPlaybackEnabled ? (
              <Mic className="h-4 w-4" />
            ) : (
              <MicOff className="h-4 w-4" />
            )}
          </Button>
        </>
      )}
    </div>
  );
}