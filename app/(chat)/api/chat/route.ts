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
  getDocumentById,
  getRecentDocumentsByKind,
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
import { executeWorkflow } from '@/lib/ai/tools/execute-workflow';

export const maxDuration = 60;

// Helper to filter out incomplete tool invocations that cause errors
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

// Helper to detect ACT workflow references in a message
function detectActWorkflowReference(message: string): boolean {
  const actRefPatterns = [
    /act\s+workflow/i,
    /act\s+document/i,
    /act\s+file/i,
    /act\s+configuration/i,
    /workflow\s+configuration/i,
    /workflow\s+file/i,
    /autonomous\s+agent/i,
    /agent\s+system/i,
    /workflow\s+system/i,
    /node\s+in\s+the\s+flow/i,
    /nodes\s+in\s+the\s+flow/i,
    /workflow\s+nodes/i,
    /diagram\s+nodes/i,
    /list.*nodes/i,
    /execute.*workflow/i,      // Added pattern to detect execution requests
    /run.*workflow/i,          // Added pattern to detect execution requests
    /trigger.*workflow/i,      // Added pattern to detect execution requests
    /use.*nodes/i,             // Added pattern to detect node usage requests
    /create.*flow/i,           // Added pattern to detect flow creation requests
    /make.*flow/i              // Added pattern to detect flow creation requests
  ];
  
  return actRefPatterns.some(pattern => pattern.test(message));
}

// Helper function to format document content for inclusion in context
function formatDocumentForContext(document: any) {
  if (!document || !document.content) return '';
  
  return `
[Document: ${document.title} (ID: ${document.id}, Type: ${document.kind})]
\`\`\`
${document.content}
\`\`\`
`;
}

export async function POST(request: Request) {
  try {
    const {
      id,
      messages: rawMessages,
      selectedChatModel,
      documentId: explicitDocumentId,
      documentContent: explicitDocumentContent,
      documentKind,
      documentTitle,
    }: { 
      id: string; 
      messages: Array<Message>; 
      selectedChatModel: string;
      documentId?: string;
      documentContent?: string;
      documentKind?: string;
      documentTitle?: string;
    } = await request.json();

    // Filter out incomplete tool invocations to prevent errors
    const messages = filterIncompleteToolInvocations(rawMessages);

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

    // Document context handling
    let documentContent = explicitDocumentContent || '';
    let finalDocumentKind = documentKind;
    let finalDocumentTitle = documentTitle;
    let documentId = explicitDocumentId;
    let document = null;

    // First, try to use an explicitly provided document ID
    if (documentId && !documentContent) {
      try {
        document = await getDocumentById({ id: documentId });
        
        // Only use the document if it belongs to the current user
        if (document && document.userId === session.user.id) {
          documentContent = formatDocumentForContext(document);
          finalDocumentKind = document.kind;
          finalDocumentTitle = document.title;
          console.log(`Using explicit document: ${finalDocumentTitle} (${documentId})`);
        } else {
          console.log(`Document not found or unauthorized: ${documentId}`);
          documentId = null;
        }
      } catch (error) {
        console.error(`Error fetching document with ID ${documentId}:`, error);
        documentId = null;
      }
    }

    // If no explicit document content was provided, check for ACT workflow references
    if (!documentContent && userMessage && detectActWorkflowReference(userMessage.content.toString())) {
      try {
        // Get most recent ACT document of 'code' type
        const recentDocs = await getRecentDocumentsByKind({
          userId: session.user.id,
          kind: 'code',
          limit: 1
        });
        
        if (recentDocs && recentDocs.length > 0) {
          document = recentDocs[0];
          documentId = document.id;
          documentContent = formatDocumentForContext(document);
          finalDocumentKind = document.kind;
          finalDocumentTitle = document.title;
          console.log(`Using detected document: ${finalDocumentTitle} (${documentId})`);
        } else {
          console.log('No recent ACT documents found for auto-detection');
        }
      } catch (error) {
        console.error('Error fetching recent ACT documents:', error);
      }
    }

    return createDataStreamResponse({
      execute: (dataStream) => {
        // Build enhanced system prompt with document context
        const enhancedSystemPrompt = documentContent 
          ? `${systemPrompt({ 
              selectedChatModel, 
              documents: document ? [{ 
                id: document.id, 
                title: document.title, 
                kind: document.kind, 
                content: document.content 
              }] : [] 
            })}\n\nWhen asked about nodes, workflow elements, or specific parts of the document, analyze the document content and provide detailed information. If the user asks to execute operations using nodes from the document, use the executeWorkflow tool.`
          : systemPrompt({ selectedChatModel });

        // Log the document context status
        if (documentContent) {
          console.log(`Including document context: ${finalDocumentTitle || 'Untitled'} (${documentId || 'No ID'})`);
        } else {
          console.log('No document context included in this request');
        }

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: enhancedSystemPrompt,
          messages,
          maxSteps: 5,
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                  'executeWorkflow',  // Added our new tool
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
            executeWorkflow: executeWorkflow({  // Added our new tool
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
                console.error('Failed to save chat:', error);
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
        console.error('Error in chat stream:', error);
        return 'Oops, an error occurred. Please try again.';
      },
    });
  } catch (error) {
    console.error('Unexpected error in POST handler:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(request: Request) {
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

    if (!chat) {
      return new Response('Chat not found', { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}

// Helper endpoint to get document context for the current chat
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');
  
  if (!chatId) {
    return Response.json({ error: 'Missing chatId parameter' }, { status: 400 });
  }
  
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get the most recent user message in this chat
    const chat = await getChatById({ id: chatId });
    
    if (!chat || chat.userId !== session.user.id) {
      return Response.json({ error: 'Chat not found or unauthorized' }, { status: 404 });
    }
    
    // Look for the most recent document reference
    const recentDocs = await getRecentDocumentsByKind({
      userId: session.user.id,
      kind: 'code',
      limit: 1
    });
    
    if (recentDocs && recentDocs.length > 0) {
      return Response.json({ 
        documentId: recentDocs[0].id,
        documentTitle: recentDocs[0].title,
        documentKind: recentDocs[0].kind
      });
    }
    
    return Response.json({ documentId: null });
  } catch (error) {
    console.error('Error fetching document context:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}