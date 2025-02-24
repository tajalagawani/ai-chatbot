'use server';

import { generateText, Message } from 'ai';
import { cookies } from 'next/headers';
import { 
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById, 
  updateChatVisiblityById 
} from '@/lib/db/queries';
import { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/models';

// Define max token constant
const MAX_TOKENS = 4096; // Adjust based on your model's requirements

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = cookies();
  cookieStore.set('chat-model', model, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  });
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: Message;
}) {
  try {
    const { text: title } = await generateText({
      model: myProvider.languageModel('title-model'),
      system: `
        You will generate a short title based on the first message a user begins a conversation with.
        Ensure it is not more than 80 characters long.
        The title should be a summary of the user's message.
        Do not use quotes or colons.
      `,
      prompt: JSON.stringify(message),
      maxTokens: MAX_TOKENS
    });

    return title.trim();
  } catch (error) {
    console.error('Error generating title:', error);
    return 'New Conversation'; // Fallback title
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  try {
    const messages = await getMessageById({ id });
    
    if (!messages || messages.length === 0) {
      throw new Error('Message not found');
    }

    const message = messages[0];
    
    await deleteMessagesByChatIdAfterTimestamp({
      chatId: message.chatId,
      timestamp: message.createdAt,
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting trailing messages:', error);
    throw error;
  }
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  try {
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    await updateChatVisiblityById({ chatId, visibility });
    return { success: true };
  } catch (error) {
    console.error('Error updating chat visibility:', error);
    throw error;
  }
}