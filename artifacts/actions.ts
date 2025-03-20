'use server';

import { getSuggestionsByDocumentId } from '@/lib/db/neo4j-queries';

export async function getSuggestions({ documentId }: { documentId: string }) {
  const suggestions = await getSuggestionsByDocumentId({ documentId });
  return suggestions ?? [];
}
