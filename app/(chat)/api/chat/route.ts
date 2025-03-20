import {
  type Message,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';

import { auth } from '@/app/(auth)/auth';
import { myProvider } from '@/lib/ai/models';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/neo4j-queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';

import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';

export const maxDuration = 60;

export async function POST(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Chat POST request initiated`);
  
  try {
    const requestData = await request.json();
    const {
      id,
      messages,
      selectedChatModel,
    }: { id: string; messages: Array<Message>; selectedChatModel: string } = requestData;

    console.log(`[${startTime}] Chat POST params:`, { 
      chatId: id, 
      messageCount: messages.length, 
      selectedChatModel 
    });

    const session = await auth();
    console.log(`[${startTime}] Auth for chat POST:`, { 
      chatId: id,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user || !session.user.id) {
      console.error(`[${startTime}] Chat POST unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    const userMessage = getMostRecentUserMessage(messages);
    console.log(`[${startTime}] Most recent user message:`, {
      exists: !!userMessage,
      messageId: userMessage?.id
    });

    if (!userMessage) {
      console.error(`[${startTime}] Chat POST error: No user message found`);
      return new Response('No user message found', { status: 400 });
    }

    console.log(`[${startTime}] Retrieving chat with ID: ${id}`);
    const chat = await getChatById({ id });
    console.log(`[${startTime}] Chat retrieval result:`, {
      exists: !!chat,
      userId: chat?.userId
    });

    if (!chat) {
      console.log(`[${startTime}] Chat not found, creating new chat with ID: ${id}`);
      try {
        const title = await generateTitleFromUserMessage({ message: userMessage });
        console.log(`[${startTime}] Generated title for new chat:`, { title });
        
        await saveChat({ id, userId: session.user.id, title });
        console.log(`[${startTime}] New chat created successfully`);
      } catch (error) {
        console.error(`[${startTime}] Error creating new chat:`, error);
        // Continue execution even if title generation fails
      }
    }

    console.log(`[${startTime}] Saving user message to chat`);
    try {
      await saveMessages({
        messages: [{ ...userMessage, createdAt: new Date(), chatId: id }],
      });
      console.log(`[${startTime}] User message saved successfully`);
    } catch (error) {
      console.error(`[${startTime}] Error saving user message:`, error);
      // We'll continue anyway to try to generate a response
    }

    console.log(`[${startTime}] Setting up data stream response`);
    return createDataStreamResponse({
      execute: (dataStream) => {
        console.log(`[${startTime}] Initializing AI stream with model: ${selectedChatModel}`);
        
        const activeTools = selectedChatModel === 'chat-model-reasoning'
          ? []
          : ['getWeather', 'createDocument', 'updateDocument', 'requestSuggestions'];
        
        console.log(`[${startTime}] Active tools:`, activeTools);
        
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel }),
          messages,
          maxSteps: 5,
          experimental_activeTools: activeTools,
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          onFinish: async ({ response, reasoning }) => {
            const finishTime = new Date().toISOString();
            console.log(`[${finishTime}] AI stream completed, saving response messages`);
            
            if (session.user?.id) {
              try {
                const sanitizedResponseMessages = sanitizeResponseMessages({
                  messages: response.messages,
                  reasoning,
                });
                
                console.log(`[${finishTime}] Sanitized response messages:`, {
                  count: sanitizedResponseMessages.length,
                  messageIds: sanitizedResponseMessages.map(m => m.id)
                });

                await saveMessages({
                  messages: sanitizedResponseMessages.map((message) => {
                    return {
                      id: message.id,
                      chatId: id,
                      role: message.role,
                      content: message.content,
                      createdAt: new Date(),
                    };
                  }),
                });
                console.log(`[${finishTime}] Response messages saved successfully`);
              } catch (error) {
                console.error(`[${finishTime}] Failed to save chat response messages:`, error);
              }
            } else {
              console.warn(`[${finishTime}] No user ID available, skipping message save`);
            }
          },
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'stream-text',
          },
        });

        console.log(`[${startTime}] Merging AI stream into data stream`);
        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: (error) => {
        const errorTime = new Date().toISOString();
        console.error(`[${errorTime}] Error in data stream:`, error);
        return 'Oops, an error occurred!';
      },
    });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Chat POST:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Chat DELETE request initiated`);
  
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    console.log(`[${startTime}] Chat DELETE params:`, { id });

    if (!id) {
      console.error(`[${startTime}] Chat DELETE error: Missing ID parameter`);
      return new Response('Not Found', { status: 404 });
    }

    const session = await auth();
    console.log(`[${startTime}] Auth for chat DELETE:`, { 
      chatId: id,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user) {
      console.error(`[${startTime}] Chat DELETE unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    console.log(`[${startTime}] Retrieving chat with ID: ${id}`);
    const chat = await getChatById({ id });
    
    if (!chat) {
      console.error(`[${startTime}] Chat DELETE error: Chat not found`);
      return new Response('Not Found', { status: 404 });
    }
    
    console.log(`[${startTime}] Chat owner check:`, {
      chatUserId: chat.userId,
      sessionUserId: session.user.id,
      match: chat.userId === session.user.id
    });

    if (chat.userId !== session.user.id) {
      console.error(`[${startTime}] Chat DELETE unauthorized: User does not own chat`);
      return new Response('Unauthorized', { status: 401 });
    }

    console.log(`[${startTime}] Deleting chat with ID: ${id}`);
    await deleteChatById({ id });
    
    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Chat DELETE completed successfully`);
    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Chat DELETE:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}