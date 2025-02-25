import { DataStreamWriter, tool } from 'ai';
import { Session } from 'next-auth';
import { z } from 'zod';
import { getDocumentById, saveDocument } from '@/lib/db/queries';
import { documentHandlersByArtifactKind } from '@/lib/artifacts/server';

interface UpdateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
}

export const updateDocument = ({ session, dataStream }: UpdateDocumentProps) =>
  tool({
    description: 'Update a document with the given description.',
    parameters: z.object({
      id: z.string().describe('The ID of the document to update'),
      description: z
        .string()
        .describe('The description of changes that need to be made'),
    }),
    execute: async ({ id, description }) => {
      console.log(`Executing updateDocument tool for document ID: ${id}`);
      try {
        const document = await getDocumentById({ id });
        
        if (!document) {
          console.error(`Document not found with ID: ${id}`);
          dataStream.writeData({ 
            type: 'finish', 
            content: 'Error: Document not found' 
          });
          return {
            id,
            error: 'Document not found',
            title: 'Unknown Document',
            kind: 'unknown',
            content: 'The document could not be found.'
          };
        }
        
        console.log(`Found document: ${document.title}`);
        
        // Initial state to prevent race conditions
        dataStream.writeData({
          type: 'clear',
          content: document.title,
        });
        
        const documentHandler = documentHandlersByArtifactKind.find(
          (documentHandlerByArtifactKind) =>
            documentHandlerByArtifactKind.kind === document.kind,
        );
        
        if (!documentHandler) {
          const errorMsg = `No document handler found for kind: ${document.kind}`;
          console.error(errorMsg);
          dataStream.writeData({ 
            type: 'finish', 
            content: errorMsg
          });
          return {
            id,
            title: document.title,
            kind: document.kind,
            error: errorMsg,
            content: 'No document handler available.'
          };
        }
        
        console.log(`Found handler for document kind: ${document.kind}`);
        
        // Properly handle the returned content
        let updatedContent;
        try {
          updatedContent = await documentHandler.onUpdateDocument({
            document,
            description,
            dataStream,
            session,
          });
          
          console.log('Document update completed successfully');
          
          // Ensure dataStream receives finish signal
          dataStream.writeData({ type: 'finish', content: '' });
          
          return {
            id,
            title: document.title,
            kind: document.kind,
            content: 'The document has been updated successfully.',
          };
        } catch (error) {
          console.error('Error in document handler:', error);
          dataStream.writeData({ 
            type: 'finish', 
            content: 'Error during document update' 
          });
          return {
            id,
            title: document.title,
            kind: document.kind,
            error: 'Failed to update document',
            content: 'An error occurred while updating the document.',
          };
        }
      } catch (error) {
        console.error('Error updating document:', error);
        // Always ensure we send a finish signal
        dataStream.writeData({ 
          type: 'finish', 
          content: 'Error occurred' 
        });
        // Return a proper result structure to avoid schema validation errors
        return {
          id: id || 'unknown',
          title: 'Error',
          kind: 'unknown',
          error: 'Failed to process update',
          content: 'An unexpected error occurred while updating the document.',
        };
      }
    },
  });

// Helper for the route.ts file to filter incomplete tool invocations
export function filterIncompleteToolInvocations(messages: Array<Message>): Array<Message> {
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