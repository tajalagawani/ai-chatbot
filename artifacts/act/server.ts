import { z } from 'zod';
import { streamObject } from 'ai';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { ActParser } from './parser';

export const actDocumentHandler = createDocumentHandler<'act'>({
  kind: 'act',
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = '';

    const { fullStream } = streamObject({
      model: myProvider.languageModel('artifact-model'),
      system: `Create an ACT workflow configuration based on the title/description.
              Follow the ACT file format requirements including workflow, nodes, edges, and env sections.
            `,
      prompt: title,
      schema: z.object({
        content: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      if (delta.type === 'object') {
        const { object } = delta;
        const { content } = object;

        if (content) {
          // Validate the content is a valid ACT file
          try {
            new ActParser(content).parse();
            dataStream.writeData({
              type: 'act-delta',
              content: content,
            });
            draftContent = content;
          } catch (error) {
            console.error('Invalid ACT file format:', error);
          }
        }
      }
    }

    return draftContent;
  },

  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = '';

    const { fullStream } = streamObject({
      model: myProvider.languageModel('artifact-model'),
      system: `Update the ACT workflow configuration based on the description.
              Maintain existing workflow_id and structure.
              `,
      prompt: `Current configuration:\n${document.content}\n\nUpdate request: ${description}`,
      schema: z.object({
        content: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      if (delta.type === 'object') {
        const { object } = delta;
        const { content } = object;

        if (content) {
          try {
            new ActParser(content).parse();
            dataStream.writeData({
              type: 'act-delta',
              content: content,
            });
            draftContent = content;
          } catch (error) {
            console.error('Invalid ACT file format:', error);
          }
        }
      }
    }

    return draftContent;
  },
});