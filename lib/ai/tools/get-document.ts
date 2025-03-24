// lib/ai/tools/get-document.ts
export const getDocument = ({ session }) =>
    tool({
      description: 'Get the content of a document by ID',
      parameters: z.object({
        id: z.string().describe('The ID of the document to retrieve'),
      }),
      execute: async ({ id }) => {
        try {
          const document = await getDocumentById({ id });
          
          if (!document || document.userId !== session.user.id) {
            return { error: 'Document not found or unauthorized' };
          }
          
          return {
            id: document.id,
            title: document.title,
            kind: document.kind,
            content: document.content,
            createdAt: document.createdAt
          };
        } catch (error) {
          console.error('Error retrieving document:', error);
          return { error: 'Failed to retrieve document' };
        }
      },
    });