// lib/ai/actDocumentQueryService.ts
import { myProvider } from '@/lib/ai/models';
import { getDocumentWithAccessCheck } from '@/lib/db/queries';

export async function queryActDocument({
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

  // Verify this is a code artifact of ACT type
  if (document.kind !== 'code') {
    return { error: 'Only ACT documents can be queried with this service', answer: null };
  }

  try {
    // Use the large model for better comprehension of code
    const model = myProvider.languageModel('chat-model-large');
    
    // Create specialized system prompt for ACT files
    const systemPrompt = `You are an expert in Autonomous Agent Toolkit (ACT) configurations. 
You're analyzing an ACT configuration file titled "${document.title}". 
Answer technical questions about this document based only on its content.
Focus on explaining agent nodes, connections, operations, and overall workflow structure.
Be technical, precise, and helpful.`;

    // Send to AI with specialized prompt
    const completion = await model.complete({
      system: systemPrompt,
      prompt: `ACT Configuration:
${document.content}

User question: ${question}

Provide a direct, technical answer to the user's question based only on this ACT configuration file.
Explain concepts clearly and reference specific parts of the configuration when relevant.`,
      maxTokens: 1500,
      temperature: 0.1,
    });

    return { 
      answer: completion.output, 
      error: null,
      documentTitle: document.title,
    };
  } catch (error) {
    console.error('Error querying ACT document with AI:', error);
    return { error: 'Failed to analyze ACT document', answer: null };
  }
}