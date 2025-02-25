import { fireworks } from '@ai-sdk/fireworks';
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';

// Import the Google Generative AI provider
import { google } from '@ai-sdk/google';

export const DEFAULT_CHAT_MODEL: string = 'chat-model-small';

export const myProvider = customProvider({
  languageModels: {
    // Replace with Gemini 2.0 model
    'chat-model-small': google('gemini-2.0-flash-001'),
    'chat-model-large': google('gemini-1.5-pro'),
    'artifact-model': google('gemini-2.0-flash-lite'),
    'chat-model-reasoning': wrapLanguageModel({
      model: fireworks('accounts/fireworks/models/deepseek-r1'),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    }),
    'title-model': google('gemini-1.5-flash'),
  },
  // No imageModels section as it's not supported in the same way
});

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model-small',
    name: 'Gemini 2.0 Flash',
    description: 'Latest Gemini model for fast, intelligent responses',
  },
  {
    id: 'chat-model-large',
    name: 'Gemini 1.5 Pro',
    description: 'Large model for complex, multi-step tasks',
  },
  {
    id: 'chat-model-reasoning',
    name: 'Reasoning model',
    description: 'Uses advanced reasoning (DeepSeek)',
  },
];