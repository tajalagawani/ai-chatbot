"use client";

import React, { useEffect, useRef, useState } from "react";
import { createRealtimeConnection } from "@/lib/voice/realtimeConnection";
import { v4 as uuidv4 } from "uuid";

// UI components
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";

interface VoiceControlsProps {
  chatId: string;
  onTranscription?: (text: string) => void;
  sendMessage?: (text: string) => void;
  // Add document context props
  documentId?: string;
  documentTitle?: string; 
  documentContent?: string;
  documentKind?: string;
}

export default function VoiceControls({ 
  chatId,
  onTranscription,
  sendMessage,
  // Document props
  documentId,
  documentTitle,
  documentContent,
  documentKind
}: VoiceControlsProps) {
  const [sessionStatus, setSessionStatus] = useState<"DISCONNECTED" | "CONNECTING" | "CONNECTED">("DISCONNECTED");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(true); 
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(true);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [lastTranscription, setLastTranscription] = useState<string>("");
  
  // Track if the document is being analyzed
  const [isDocumentActive, setIsDocumentActive] = useState<boolean>(!!documentId);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connection constants
  const MAX_RECONNECT_ATTEMPTS = 3;
  const RECONNECT_DELAY = 2000; // 2 seconds
  const CONNECTION_TIMEOUT = 15000; // 15 seconds
  const TRANSCRIPTION_TIMEOUT = 5000; // 5 seconds for waiting for transcription

  // Update document active state when document props change
  useEffect(() => {
    setIsDocumentActive(!!documentId);
  }, [documentId, documentTitle, documentContent]);

  // Create a function to send client events
  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    if (dcRef.current && dcRef.current.readyState === "open") {
      // Add event_id to all events for tracing errors
      const eventWithId = {
        ...eventObj,
        event_id: eventObj.event_id || `evt_${uuidv4().replace(/-/g, '').substring(0, 32)}`
      };
      
      console.log(`Sending event: ${eventWithId.type}${eventNameSuffix ? ` ${eventNameSuffix}` : ''}`, eventWithId);
      
      try {
        dcRef.current.send(JSON.stringify(eventWithId));
        return true;
      } catch (error) {
        console.error("Error sending client event:", error);
        return false;
      }
    } else {
      console.error(
        "Failed to send message - no data channel available",
        eventObj
      );
      return false;
    }
  };

  // Cleanup existing connection
  const cleanupExistingConnection = async () => {
    try {
      // Clear connection check interval
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
        connectionCheckIntervalRef.current = null;
      }
      
      // Clear any session timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Clear transcription timeout
      if (transcriptionTimeoutRef.current) {
        clearTimeout(transcriptionTimeoutRef.current);
        transcriptionTimeoutRef.current = null;
      }
      
      // Close data channel first
      if (dcRef.current) {
        try {
          dcRef.current.close();
        } catch (e) {
          console.warn("Error closing data channel:", e);
        }
        dcRef.current = null;
      }
      
      // Then close peer connection
      if (pcRef.current) {
        try {
          pcRef.current.getSenders().forEach((sender) => {
            if (sender.track) {
              sender.track.stop();
            }
          });
          pcRef.current.close();
        } catch (e) {
          console.warn("Error closing peer connection:", e);
        }
        pcRef.current = null;
      }
      
      // Stop any media stream
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
        } catch (e) {
          console.warn("Error stopping media tracks:", e);
        }
        mediaStreamRef.current = null;
      }
      
      // Clean up audio element
      if (audioElementRef.current && audioElementRef.current.parentNode) {
        try {
          audioElementRef.current.srcObject = null;
          audioElementRef.current.parentNode.removeChild(audioElementRef.current);
        } catch (e) {
          console.warn("Error removing audio element:", e);
        }
        audioElementRef.current = null;
      }
    } catch (error) {
      console.error("Error during connection cleanup:", error);
    }
  };

  // Connect to realtime API
  const connectToRealtime = async () => {
    if (sessionStatus !== "DISCONNECTED") return;
    setSessionStatus("CONNECTING");
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      console.log(`Initializing voice connection... (Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
      
      // Clean up previous connections if needed
      await cleanupExistingConnection();
      
      // Create new audio element
      audioElementRef.current = document.createElement("audio");
      document.body.appendChild(audioElementRef.current);
      audioElementRef.current.autoplay = isAudioPlaybackEnabled;

      // Get ephemeral key for authentication
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) {
        console.error("Failed to get ephemeral key");
        handleConnectionFailure("Failed to obtain authentication token");
        return;
      }

      // Establish connection
      const { pc, dc } = await createRealtimeConnection(
        EPHEMERAL_KEY,
        audioElementRef
      );
      
      pcRef.current = pc;
      dcRef.current = dc;
      
      console.log("Connection established, setting up event handlers");

      // Setup event handlers for data channel
      dc.onopen = () => {
        console.log("Data channel opened");
        setSessionStatus("CONNECTED");
        setReconnectAttempts(0); // Reset reconnect attempts on successful connection
        initializeSessionWithAgent();
        startConnectionMonitoring();
      };
      
      dc.onclose = () => {
        console.log("Data channel closed");
        if (sessionStatus === "CONNECTED") {
          handleConnectionFailure("Data channel closed unexpectedly");
        }
      };
      
      dc.onerror = (error) => {
        console.error("Data channel error:", error);
        
        // Check if it's a User-Initiated Abort
        if (error.error?.message?.includes("User-Initiated Abort")) {
          console.log("Connection aborted by user/system, attempting recovery...");
          
          // Attempt to reconnect after a short delay
          setTimeout(() => {
            if (sessionStatus === "CONNECTED") {
              console.log("Attempting to recover from abort...");
              disconnectFromRealtime();
              
              reconnectTimeoutRef.current = setTimeout(() => {
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                  connectToRealtime();
                }
              }, 1000);
            }
          }, 500);
        }
      };
      
      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleServerEvent(data);
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      };

      // Monitor ICE connection state
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
        if (
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "closed"
        ) {
          console.log("ICE connection lost");
          if (sessionStatus === "CONNECTED") {
            handleConnectionFailure(`ICE connection state changed to ${pc.iceConnectionState}`);
          }
        }
      };

      // Set a connection timeout
      const timeoutId = setTimeout(() => {
        if (sessionStatus === "CONNECTING") {
          console.error("Connection timed out");
          handleConnectionFailure("Connection timed out");
        }
      }, CONNECTION_TIMEOUT);

      // Clear timeout on successful connection
      if (dc.readyState === "open") {
        clearTimeout(timeoutId);
      }

    } catch (err) {
      console.error("Error connecting to realtime API:", err);
      handleConnectionFailure(`Exception: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Handle server events
  const handleServerEvent = (event: any) => {
    const eventType = event.type || "unknown_event";
    
    // Handle audio transcript events
    if (eventType === "conversation.item.input_audio_transcription.completed") {
      if (event.transcript) {
        const transcript = event.transcript === "\n" ? "[inaudible]" : event.transcript;
        
        // Save the transcription
        setLastTranscription(transcript);
        
        // Call the onTranscription callback if provided
        if (onTranscription) {
          onTranscription(transcript);
        }
        
        // Send to chat with document context if available
        if (sendMessage && transcript && transcript !== "[inaudible]") {
          // Track if we informed the user about document context
          if (isDocumentActive && documentTitle) {
            console.log(`Voice message includes document context: ${documentTitle}`);
          }
          
          sendMessage(transcript);
        }
      }
    } else if (eventType === "input_audio_buffer.committed") {
      // Set a timeout for transcription
      if (transcriptionTimeoutRef.current) {
        clearTimeout(transcriptionTimeoutRef.current);
      }
      
      transcriptionTimeoutRef.current = setTimeout(() => {
        // If no transcription received, log an error
        console.log("No transcription received within timeout");
      }, TRANSCRIPTION_TIMEOUT);
    }
    
    // Handle other event types as needed
    console.log(`Received event: ${eventType}`, event);
  };

  // Handle connection failure with reconnect logic
  const handleConnectionFailure = (reason: string = "Unknown reason") => {
    const newAttempts = reconnectAttempts + 1;
    setReconnectAttempts(newAttempts);
    
    console.log(`Connection failed: ${reason}`);
    disconnectFromRealtime();
    
    if (newAttempts < MAX_RECONNECT_ATTEMPTS) {
      console.log(`Connection attempt ${newAttempts} failed. Retrying in ${RECONNECT_DELAY}ms...`);
      reconnectTimeoutRef.current = setTimeout(connectToRealtime, RECONNECT_DELAY);
    } else {
      console.error(`Failed to connect after ${MAX_RECONNECT_ATTEMPTS} attempts.`);
      setReconnectAttempts(0);
    }
  };

  // Start periodic connection monitoring
  const startConnectionMonitoring = () => {
    // Clear any existing interval
    if (connectionCheckIntervalRef.current) {
      clearInterval(connectionCheckIntervalRef.current);
    }
    
    // Set up new interval check
    connectionCheckIntervalRef.current = setInterval(() => {
      if (sessionStatus === "CONNECTED" && dcRef.current) {
        if (dcRef.current.readyState !== "open") {
          console.log("Data channel no longer open during periodic check, reconnecting...");
          handleConnectionFailure("Data channel not open during periodic check");
        }
      } else if (sessionStatus !== "CONNECTED") {
        // Clear interval if we're not connected
        if (connectionCheckIntervalRef.current) {
          clearInterval(connectionCheckIntervalRef.current);
          connectionCheckIntervalRef.current = null;
        }
      }
    }, 5000);
  };

  // Initialize session with agent config
  const initializeSessionWithAgent = () => {
    if (!dcRef.current || dcRef.current.readyState !== "open") {
      console.warn("Cannot initialize session: data channel not open");
      return;
    }
    
    console.log("Initializing session with agent...");
    
    // Create basic instructions with document context if available
    let instructions = "You are a helpful assistant.";
    if (isDocumentActive && documentTitle) {
      instructions = `You are a helpful assistant. The user is working with a document titled "${documentTitle}". The user might ask questions about this document.`;
    }
    
    // Configure the voice session
    sendClientEvent({
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions,
        voice: "alloy", // or whichever voice you prefer
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { model: "whisper-1" },
        // If PTT is active, disable automated turn detection
        turn_detection: isPTTActive ? null : {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200,
          create_response: true,
        },
      },
    });
    
    // Send an initial greeting that includes document context if available
    sendInitialGreeting();
  };
  
  // Send initial greeting to start the conversation
  const sendInitialGreeting = () => {
    // Generate a 32-character ID instead of 36-character UUID
    const id = uuidv4().replace(/-/g, '').substring(0, 32);
    console.log("Sending initial greeting with ID:", id);
    
    // Create the greeting message with document context if available
    let greetingText = "Hello";
    if (isDocumentActive && documentTitle) {
      greetingText = `Hello. I'm looking at the document "${documentTitle}".`;
    }
    
    sendClientEvent(
        {
          type: "conversation.item.create",
          item: {
            id,
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: greetingText }],
          },
        },
        "(initial greeting)"
      );
      
      // Add metadata about document if available
      if (isDocumentActive && documentId && documentContent) {
        sendClientEvent(
          {
            type: "metadata.add",
            item_id: id,
            metadata: {
              document_context: {
                document_id: documentId,
                document_title: documentTitle || "Untitled Document",
                document_kind: documentKind || "unknown",
                document_content_preview: documentContent.substring(0, 500) // Send preview
              }
            }
          },
          "(document context)"
        );
      }
      
      sendClientEvent(
        { type: "response.create" },
        "(trigger initial response)"
      );
    };

// Fetch ephemeral key for authentication
const fetchEphemeralKey = async (): Promise<string | null> => {
  try {
    console.log("Fetching ephemeral key...");
    const response = await fetch("/api/session");
    
    if (!response.ok) {
      throw new Error(`Failed to fetch session token: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data?.client_secret?.value) {
      console.error("No ephemeral key provided by the server");
      return null;
    }
    
    console.log("Ephemeral key obtained successfully");
    return data.client_secret.value;
  } catch (error) {
    console.error("Error fetching ephemeral key:", error);
    return null;
  }
};

// Disconnect from realtime API
const disconnectFromRealtime = () => {
  console.log("Disconnecting from realtime...");
  
  try {
    cleanupExistingConnection();
  } catch (e) {
    console.error("Error during disconnect:", e);
  } finally {
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);
    console.log("Disconnected successfully");
  }
};

// PTT button handlers
const handleTalkButtonDown = () => {
  if (sessionStatus !== "CONNECTED" || !dcRef.current || dcRef.current.readyState !== "open") {
    console.warn("Cannot start speaking: not connected or data channel not open");
    return;
  }
  
  console.log("PTT button down - starting user speech");
  
  // Cancel any ongoing assistant response
  sendClientEvent({ type: "response.cancel" }, "(cancel due to user PTT)");
  
  setIsPTTUserSpeaking(true);
  
  // Clear the input buffer when starting to speak in PTT mode
  sendClientEvent({ type: "input_audio_buffer.clear" }, "(clear audio buffer for PTT)");
};

const handleTalkButtonUp = () => {
  if (
    sessionStatus !== "CONNECTED" ||
    !dcRef.current ||
    dcRef.current.readyState !== "open" ||
    !isPTTUserSpeaking
  ) {
    console.warn("Cannot stop speaking: not connected, not speaking, or data channel not open");
    return;
  }

  console.log("PTT button up - ending user speech");
  
  setIsPTTUserSpeaking(false);
  
  // When VAD is disabled, manually commit the audio buffer
  sendClientEvent({ type: "input_audio_buffer.commit" }, "(commit audio buffer for PTT)");
  
  // Add document context metadata if available
  if (isDocumentActive && documentId && documentContent) {
    // Generate a message ID for the current transcription
    const msgId = uuidv4().replace(/-/g, '').substring(0, 32);
    
    // Add metadata about the document to this message
    sendClientEvent(
      {
        type: "metadata.add",
        item_id: msgId, // This may need adjustment based on how you track message IDs
        metadata: {
          document_context: {
            document_id: documentId,
            document_title: documentTitle || "Untitled Document",
            document_kind: documentKind || "unknown",
            document_content_preview: documentContent.substring(0, 500) // Send preview
          }
        }
      },
      "(document context for voice message)"
    );
  }
  
  // Then manually trigger a response
  sendClientEvent({ type: "response.create" }, "(trigger response for PTT)");
};

// Toggle audio playback
const toggleAudio = () => {
  const newState = !isAudioPlaybackEnabled;
  console.log(`${newState ? 'Enabling' : 'Disabling'} audio playback`);
  setIsAudioPlaybackEnabled(newState);
  
  if (audioElementRef.current) {
    audioElementRef.current.muted = !newState;
    
    if (newState) {
      audioElementRef.current.play().catch(err => {
        console.warn("Could not enable audio playback:", err);
      });
    } else {
      audioElementRef.current.pause();
    }
  }
};

// Handle keyboard shortcuts for PTT
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && sessionStatus === "CONNECTED" && !isPTTUserSpeaking) {
      e.preventDefault(); // Prevent page scrolling
      handleTalkButtonDown();
    }
  };
  
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space' && sessionStatus === "CONNECTED" && isPTTUserSpeaking) {
      e.preventDefault(); // Prevent page scrolling
      handleTalkButtonUp();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, [sessionStatus, isPTTUserSpeaking]);

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
    localStorage.setItem("audioPlaybackEnabled", isAudioPlaybackEnabled.toString());
  }
}, [isPTTActive, isAudioPlaybackEnabled]);

// Clean up resources when component unmounts
useEffect(() => {
  return () => {
    if (sessionStatus !== "DISCONNECTED") {
      disconnectFromRealtime();
    }
  };
}, []);

// Render voice controls
return (
  <div className="fixed bottom-20 right-6 flex flex-col gap-2 z-50">
    {/* Show document indicator if document is active */}
    {isDocumentActive && documentTitle && sessionStatus === "CONNECTED" && (
      <div className="absolute right-full mr-2 p-2 rounded-lg bg-blue-100 text-blue-800 text-xs max-w-48 truncate shadow-sm">
        <span>Document: {documentTitle}</span>
      </div>
    )}
    
    {sessionStatus === "DISCONNECTED" ? (
      <Button 
        onClick={connectToRealtime}
        className="rounded-full h-12 w-12 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
        title="Enable voice"
        disabled={reconnectAttempts >= MAX_RECONNECT_ATTEMPTS}
      >
        <Mic className="h-5 w-5" />
      </Button>
    ) : sessionStatus === "CONNECTING" ? (
      <Button 
        disabled
        className="rounded-full h-12 w-12 bg-gray-400 text-white shadow-lg"
        title="Connecting..."
      >
        <span className="animate-pulse">...</span>
      </Button>
    ) : (
      <>
        <Button
          onClick={toggleAudio}
          className={`rounded-full h-10 w-10 ${
            isAudioPlaybackEnabled 
              ? "bg-green-600 hover:bg-green-700" 
              : "bg-gray-600 hover:bg-gray-700"
          } text-white shadow-lg`}
          title={isAudioPlaybackEnabled ? "Mute audio" : "Unmute audio"}
        >
          {isAudioPlaybackEnabled ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </Button>
        
        <Button
          onClick={disconnectFromRealtime}
          className="rounded-full h-10 w-10 bg-red-600 hover:bg-red-700 text-white shadow-lg"
          title="End voice chat"
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
        
        <Button
          onMouseDown={handleTalkButtonDown}
          onMouseUp={handleTalkButtonUp}
          onTouchStart={handleTalkButtonDown}
          onTouchEnd={handleTalkButtonUp}
          className={`rounded-full h-12 w-12 ${
            isPTTUserSpeaking 
              ? "bg-blue-700 ring-2 ring-offset-2 ring-blue-500" 
              : "bg-blue-600 hover:bg-blue-700"
          } text-white shadow-lg`}
          disabled={sessionStatus !== "CONNECTED"}
          title="Push to talk (or hold Space key)"
        >
          <Mic className="h-5 w-5" />
        </Button>
      </>
    )}
  </div>
);
}