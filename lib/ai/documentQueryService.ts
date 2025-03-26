import { myProvider } from '@/lib/ai/models';
import { getDocumentWithAccessCheck } from '@/lib/db/queries';

export async function queryDocumentContent({
  documentId,
  question,
  userId,
}: {
  documentId: string;
  question: string;
  userId: string;
}) {
  // Get document with access check
  const { document, error } = await getDocumentWithAccessCheck({
    id: documentId,
    userId,
  });

  if (error || !document) {
    return { error, answer: null };
  }

  try {
    // Use the appropriate model from your provider
    const model = myProvider.languageModel('chat-model-large');
    
    // Create system prompt based on document type
    const systemPrompt = `You are analyzing a ${document.kind} document titled "${document.title}". 
Answer questions about this document based only on its content. Be specific and concise.`;

    // Send to AI
    const completion = await model.complete({
      system: systemPrompt,
      prompt: `Document content:
${document.content}

User question: ${question}

Provide a direct answer to the user's question based only on the document content.`,
      maxTokens: 50000,
      temperature: 0.2,
    });

    return { 
      answer: completion.output, 
      error: null,
      documentTitle: document.title,
      documentKind: document.kind
    };
  } catch (error) {
    console.error('Error querying document with AI:', error);
    return { error: 'Failed to analyze document', answer: null };
  }
}