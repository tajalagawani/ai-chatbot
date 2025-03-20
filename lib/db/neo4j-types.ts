// lib/db/neo4j-types.ts
import { ArtifactKind } from "@/components/artifact";

export interface Neo4jUser {
  id: string;
  email: string;
  password?: string;
}

export interface Neo4jChat {
  id: string;
  createdAt: Date | string;
  title: string;
  visibility: 'public' | 'private';
  userId: string;
}

export interface Neo4jMessage {
  id: string;
  chatId: string;
  role: string;
  content: any;
  createdAt: Date | string;
}

export interface Neo4jDocument {
  id: string;
  createdAt: Date | string;
  title: string;
  content?: string;
  kind: ArtifactKind;
  userId: string;
}

export interface Neo4jVote {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
}

export interface Neo4jSuggestion {
  id: string;
  documentId: string;
  documentCreatedAt: Date | string;
  originalText: string;
  suggestedText: string;
  description?: string;
  isResolved: boolean;
  userId: string;
  createdAt: Date | string;
}