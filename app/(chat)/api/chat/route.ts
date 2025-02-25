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
} from '@/lib/db/queries';
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

// Define the filterIncompleteToolInvocations function directly in this file
function filterIncompleteToolInvocations(messages: Array<Message>): Array<Message> {
  return messages.map(message => {
    // Skip messages without toolInvocations
    if (!message.toolInvocations || message.toolInvocations.length === 0) {
      return message;
    }
    
    // Filter out tool invocations that are in 'call' state without results
    const validToolInvocations = message.toolInvocations.filter(
      invocation => invocation.state !== 'call' || 'result' in invocation
    );
    
    return {
      ...message,
      toolInvocations: validToolInvocations
    };
  });
}

export async function POST(request: Request) {
  console.log('POST request received at:', new Date().toISOString());
  
  try {
    const requestBody = await request.json();
    console.log('Request body received, processing...');
    
    const {
      id,
      messages: originalMessages,
      selectedChatModel,
    }: { id: string; messages: Array<Message>; selectedChatModel: string } = requestBody;

    console.log(`Processing chat id: ${id}, model: ${selectedChatModel}`);
    console.log(`Total original messages: ${originalMessages.length}`);

    // Filter out incomplete tool invocations to prevent errors
    const messages = filterIncompleteToolInvocations(originalMessages);
    console.log(`Messages after filtering incomplete tool invocations: ${messages.length}`);

    // Rest of your POST handler code...
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({ message: userMessage });
      await saveChat({ id, userId: session.user.id, title });
    }

    await saveMessages({
      messages: [{ ...userMessage, createdAt: new Date(), chatId: id }],
    });

    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel }),
          messages, // Use filtered messages
          maxSteps: 5,
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
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
            if (session.user?.id) {
              try {
                const sanitizedResponseMessages = sanitizeResponseMessages({
                  messages: response.messages,
                  reasoning,
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
              } catch (error) {
                console.error('Failed to save chat');
              }
            }
          },
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'stream-text',
          },
        });

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: (error) => {
        console.error('Error in data stream:', error);
        return 'Oops, an error occured!';
      },
    });
  } catch (error) {
    console.error('Unexpected error in POST handler:', error);
    return new Response('Server error', { status: 500 });
  }
}

export async function DELETE(request: Request) {
  // Your existing DELETE handler code...
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}