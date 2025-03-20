import 'server-only';
import { genSaltSync, hashSync, compareSync } from 'bcrypt-ts';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from './neo4j';
import { ArtifactKind } from '@/components/artifact';

// User Queries
export async function getUser(email: string): Promise<Array<any>> {
  const session = await getSession();
  try {
    const result = await session.run(
      `MATCH (u:User {email: $email}) RETURN u`,
      { email }
    );
    
    return result.records.map(record => {
      const user = record.get('u').properties;
      return user;
    });
  } catch (error) {
    console.error('Failed to get user from database', error);
    throw error;
  } finally {
    await session.close();
  }
}
// Add this function near the top of your neo4j-queries.ts file with your other utility functions
function isAgentContent(content) {
  try {
    // Check if content is a string and try to parse it if needed
    const parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
    
    // Check for common agent definition properties
    // This will depend on your specific agent format, but might look for things like:
    return (
      parsedContent &&
      typeof parsedContent === 'object' &&
      (
        // Looking for workflow structure
        (parsedContent.workflow_id && parsedContent.nodes) ||
        // Or a simpler structure with just nodes and edges
        (parsedContent.nodes && parsedContent.edges) ||
        // Or look for start_node which seems to be in your format
        (parsedContent.start_node && parsedContent.name)
      )
    );
  } catch (e) {
    // If we can't parse it or it doesn't match the pattern, it's not agent content
    return false;
  }
}
export async function createUser(email: string, password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);
  const id = uuidv4();
  
  const session = await getSession();
  try {
    await session.run(
      `CREATE (u:User {id: $id, email: $email, password: $hash})`,
      { id, email, hash }
    );
    return { id, email };
  } catch (error) {
    console.error('Failed to create user in database', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Chat Queries
export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  const session = await getSession();
  try {
    const createdAt = new Date().toISOString();
    await session.run(
      `
      MATCH (u:User {id: $userId})
      CREATE (c:Chat {id: $id, createdAt: $createdAt, title: $title, visibility: 'private'})
      CREATE (u)-[:OWNS]->(c)
      RETURN c
      `,
      { id, userId, createdAt, title }
    );
    return { id, title };
  } catch (error) {
    console.error('Failed to save chat in database', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function deleteChatById({ id }: { id: string }) {
  const session = await getSession();
  try {
    // Delete all votes related to messages in this chat
    await session.run(
      `
      MATCH (c:Chat {id: $id})<-[:BELONGS_TO]-(m:Message)<-[v:VOTES]-()
      DELETE v
      `,
      { id }
    );
    
    // Delete all messages in this chat
    await session.run(
      `
      MATCH (c:Chat {id: $id})<-[:BELONGS_TO]-(m:Message)
      DETACH DELETE m
      `,
      { id }
    );
    
    // Delete the chat
    await session.run(
      `
      MATCH (c:Chat {id: $id})
      DETACH DELETE c
      `,
      { id }
    );
    
    return { success: true };
  } catch (error) {
    console.error('Failed to delete chat by id from database', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $id})-[:OWNS]->(c:Chat)
      RETURN c
      ORDER BY c.createdAt DESC
      `,
      { id }
    );
    
    return result.records.map(record => {
      return record.get('c').properties;
    });
  } catch (error) {
    console.error('Failed to get chats by user from database', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function getChatById({ id }: { id: string }) {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (c:Chat {id: $id})
      OPTIONAL MATCH (u:User)-[:OWNS]->(c)
      RETURN c, u.id as userId
      `,
      { id }
    );
    
    if (result.records.length === 0) {
      return null;
    }
    
    const chat = result.records[0].get('c').properties;
    chat.userId = result.records[0].get('userId');
    
    return chat;
  } catch (error) {
    console.error('Failed to get chat by id from database', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Message Queries
export async function saveMessages({ messages }: { messages: Array<any> }) {
  const session = await getSession();
  try {
    for (const msg of messages) {
      const messageId = msg.id || uuidv4();
      const content = typeof msg.content === 'object' ? JSON.stringify(msg.content) : msg.content;
      const createdAt = new Date(msg.createdAt).toISOString();
      
      await session.run(
        `
        MATCH (c:Chat {id: $chatId})
        CREATE (m:Message {id: $id, role: $role, content: $content, createdAt: $createdAt})
        CREATE (m)-[:BELONGS_TO]->(c)
        RETURN m
        `,
        { 
          id: messageId, 
          chatId: msg.chatId, 
          role: msg.role, 
          content, 
          createdAt 
        }
      );
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save messages in database', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (m:Message)-[:BELONGS_TO]->(c:Chat {id: $id})
      RETURN m
      ORDER BY m.createdAt ASC
      `,
      { id }
    );
    
    return result.records.map(record => {
      const message = record.get('m').properties;
      // Parse content if it's stored as a string
      try {
        if (typeof message.content === 'string') {
          message.content = JSON.parse(message.content);
        }
      } catch (e) {
        // If parsing fails, keep the original content
      }
      
      // Convert ISO string dates to Date objects
      if (typeof message.createdAt === 'string') {
        message.createdAt = new Date(message.createdAt);
      }
      
      return message;
    });
  } catch (error) {
    console.error('Failed to get messages by chat id from database', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function getMessageById({ id }: { id: string }) {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (m:Message {id: $id})
      MATCH (m)-[:BELONGS_TO]->(c:Chat)
      RETURN m, c.id as chatId
      `,
      { id }
    );
    
    if (result.records.length === 0) {
      return [];
    }
    
    const message = result.records[0].get('m').properties;
    message.chatId = result.records[0].get('chatId');
    
    // Parse content if it's stored as a string
    try {
      if (typeof message.content === 'string') {
        message.content = JSON.parse(message.content);
      }
    } catch (e) {
      // If parsing fails, keep the original content
    }
    
    // Convert ISO string dates to Date objects
    if (typeof message.createdAt === 'string') {
      message.createdAt = new Date(message.createdAt);
    }
    
    return [message];
  } catch (error) {
    console.error('Failed to get message by id from database', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  const session = await getSession();
  try {
    const timestampIso = timestamp.toISOString();
    
    // First, identify messages to delete
    const result = await session.run(
      `
      MATCH (m:Message)-[:BELONGS_TO]->(c:Chat {id: $chatId})
      WHERE m.createdAt >= $timestamp
      RETURN m.id as id
      `,
      { chatId, timestamp: timestampIso }
    );
    
    const messageIds = result.records.map(record => record.get('id'));
    
    if (messageIds.length === 0) {
      return { success: true, count: 0 };
    }
    
    // Delete votes for these messages
    await session.run(
      `
      MATCH (m:Message)<-[v:VOTES]-()
      WHERE m.id IN $messageIds
      DELETE v
      `,
      { messageIds }
    );
    
    // Delete the messages
    const deleteResult = await session.run(
      `
      MATCH (m:Message)-[:BELONGS_TO]->(c:Chat {id: $chatId})
      WHERE m.id IN $messageIds
      DETACH DELETE m
      RETURN count(m) as count
      `,
      { chatId, messageIds }
    );
    
    const count = deleteResult.records[0].get('count').toNumber();
    return { success: true, count };
  } catch (error) {
    console.error('Failed to delete messages by chat id after timestamp from database', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Vote Queries
export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  const session = await getSession();
  try {
    // Get the user who owns the chat
    const userResult = await session.run(
      `
      MATCH (u:User)-[:OWNS]->(c:Chat {id: $chatId})
      RETURN u.id as userId
      `,
      { chatId }
    );
    
    if (userResult.records.length === 0) {
      throw new Error('Chat not found or no owner found');
    }
    
    const userId = userResult.records[0].get('userId');
    
    // Check if a vote already exists
    const voteResult = await session.run(
      `
      MATCH (u:User {id: $userId})-[v:VOTES]->(m:Message {id: $messageId})
      RETURN v
      `,
      { userId, messageId }
    );
    
    if (voteResult.records.length > 0) {
      // Update existing vote
      await session.run(
        `
        MATCH (u:User {id: $userId})-[v:VOTES]->(m:Message {id: $messageId})
        SET v.isUpvoted = $isUpvoted
        RETURN v
        `,
        { userId, messageId, isUpvoted: type === 'up' }
      );
    } else {
      // Create new vote
      await session.run(
        `
        MATCH (u:User {id: $userId})
        MATCH (m:Message {id: $messageId})
        CREATE (u)-[v:VOTES {isUpvoted: $isUpvoted}]->(m)
        RETURN v
        `,
        { userId, messageId, isUpvoted: type === 'up' }
      );
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to vote message in database', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (c:Chat {id: $id})<-[:BELONGS_TO]-(m:Message)<-[v:VOTES]-()
      RETURN m.id as messageId, v.isUpvoted as isUpvoted, c.id as chatId
      `,
      { id }
    );
    
    return result.records.map(record => ({
      messageId: record.get('messageId'),
      isUpvoted: record.get('isUpvoted'),
      chatId: record.get('chatId')
    }));
  } catch (error) {
    console.error('Failed to get votes by chat id from database', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Document Queries
export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  const session = await getSession();
  try {
    const createdAt = new Date().toISOString();
    
    await session.run(
      `
      MATCH (u:User {id: $userId})
      MERGE (d:Document {id: $id})
      ON CREATE SET 
        d.title = $title,
        d.kind = $kind, 
        d.content = $content, 
        d.createdAt = $createdAt
      ON MATCH SET
        d.title = $title,
        d.kind = $kind, 
        d.content = $content
      MERGE (u)-[:CREATED]->(d)
      RETURN d
      `,
      { id, title, kind, content, userId, createdAt }
    );
    
    // If this is a code document and it looks like an agent definition, extract nodes
    if (kind === 'code' && isAgentContent(content)) {
      await parseAndSaveAgentContent({ documentId: id, content, userId });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save document in database', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (d:Document {id: $id})
      OPTIONAL MATCH (d)<-[:CREATED]-(u:User)
      RETURN d, u.id as userId
      ORDER BY d.createdAt ASC
      `,
      { id }
    );
    
    return result.records.map(record => {
      const doc = record.get('d').properties;
      doc.userId = record.get('userId'); // Add the userId from the relationship
      
      // Convert ISO string dates to Date objects
      if (typeof doc.createdAt === 'string') {
        doc.createdAt = new Date(doc.createdAt);
      }
      
      return doc;
    });
  } catch (error) {
    console.error('Failed to get documents by id from database', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function getDocumentById({ id }: { id: string }) {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (d:Document {id: $id})
      RETURN d
      ORDER BY d.createdAt DESC
      LIMIT 1
      `,
      { id }
    );
    
    if (result.records.length === 0) {
      return null;
    }
    
    const doc = result.records[0].get('d').properties;
    
    // Convert ISO string dates to Date objects
    if (typeof doc.createdAt === 'string') {
      doc.createdAt = new Date(doc.createdAt);
    }
    
    return doc;
  } catch (error) {
    console.error('Failed to get document by id from database', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function getDocumentWithAgent({ id }: { id: string }) {
  // First get the document
  const document = await getDocumentById({ id });
  
  if (!document) {
    return null;
  }
  
  // If it's a code document, check if it has agent nodes
  if (document.kind === 'code' && isAgentContent(document.content)) {
    // Get the agent data
    const agentData = await getAgentByDocumentId({ documentId: id });
    
    // Return combined data
    return {
      ...document,
      agent: agentData
    };
  }
  
  return document;
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  const session = await getSession();
  try {
    const timestampIso = timestamp.toISOString();
    
    // Delete related suggestions first
    await session.run(
      `
      MATCH (d:Document {id: $id})<-[:SUGGESTS_FOR]-(s:Suggestion)
      WHERE d.createdAt > $timestamp
      DETACH DELETE s
      `,
      { id, timestamp: timestampIso }
    );
    
    // Delete any agent nodes for this document
    await session.run(
      `
      MATCH (n:AgentNode {documentId: $id})
      OPTIONAL MATCH (n)-[r]-()
      DELETE r, n
      `,
      { id }
    );
    
    // Delete documents
    const result = await session.run(
      `
      MATCH (d:Document {id: $id})
      WHERE d.createdAt > $timestamp
      DETACH DELETE d
      RETURN count(d) as count
      `,
      { id, timestamp: timestampIso }
    );
    
    const count = result.records[0].get('count').toNumber();
    return { success: true, count };
  } catch (error) {
    console.error('Failed to delete documents by id after timestamp from database', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function updateDocumentInPlace({
  id,
  content,
  userId,
}: {
  id: string;
  content: string;
  userId: string;
}) {
  const session = await getSession();
  try {
    // Get the latest document version
    const result = await session.run(
      `
      MATCH (d:Document {id: $id})
      RETURN d
      ORDER BY d.createdAt DESC
      LIMIT 1
      `,
      { id }
    );
    
    if (result.records.length === 0) {
      throw new Error("Document not found");
    }
    
    const document = result.records[0].get('d').properties;
    
    // Update content of the latest document
    await session.run(
      `
      MATCH (d:Document {id: $id})
      WHERE d.createdAt = $createdAt
      SET d.content = $content
      RETURN d
      `,
      { 
        id, 
        content,
        createdAt: document.createdAt
      }
    );
    
    // If this is a code document and it looks like an agent definition, update nodes
    if (document.kind === 'code' && isAgentContent(content)) {
      await parseAndSaveAgentContent({ documentId: id, content, userId });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to update document in place', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Suggestion Queries
export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<any>;
}) {
  const session = await getSession();
  try {
    for (const suggestion of suggestions) {
      const id = suggestion.id || uuidv4();
      const createdAt = new Date(suggestion.createdAt).toISOString();
      const documentCreatedAt = new Date(suggestion.documentCreatedAt).toISOString();
      
      await session.run(
        `
        MATCH (u:User {id: $userId})
        MATCH (d:Document {id: $documentId})
        CREATE (s:Suggestion {
          id: $id,
          originalText: $originalText,
          suggestedText: $suggestedText,
          description: $description,
          isResolved: $isResolved,
          createdAt: $createdAt,
          documentCreatedAt: $documentCreatedAt
        })
        CREATE (s)-[:SUGGESTS_FOR]->(d)
        CREATE (u)-[:CREATED]->(s)
        RETURN s
        `,
        {
          id,
          userId: suggestion.userId,
          documentId: suggestion.documentId,
          originalText: suggestion.originalText,
          suggestedText: suggestion.suggestedText,
          description: suggestion.description || '',
          isResolved: suggestion.isResolved,
          createdAt,
          documentCreatedAt
        }
      );
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save suggestions in database', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (s:Suggestion)-[:SUGGESTS_FOR]->(d:Document {id: $documentId})
      RETURN s
      ORDER BY s.createdAt DESC
      `,
      { documentId }
    );
    
    return result.records.map(record => {
      const suggestion = record.get('s').properties;
      
      // Convert ISO string dates to Date objects
      if (typeof suggestion.createdAt === 'string') {
        suggestion.createdAt = new Date(suggestion.createdAt);
      }
      
      if (typeof suggestion.documentCreatedAt === 'string') {
        suggestion.documentCreatedAt = new Date(suggestion.documentCreatedAt);
      }
      
      return suggestion;
    });
  } catch (error) {
    console.error('Failed to get suggestions by document id from database', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  const session = await getSession();
  try {
    await session.run(
      `
      MATCH (c:Chat {id: $chatId})
      SET c.visibility = $visibility
      RETURN c
      `,
      { chatId, visibility }
    );
    
    return { success: true };
  } catch (error) {
    console.error('Failed to update chat visibility in database', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Agent Node functions
// Interface for agent nodes
export interface AgentNode {
  id: string;
  documentId: string;
  type: string;
  label: string;
  position_x: number;
  position_y: number;
  description?: string;
  operation?: string;
  properties: Record<string, any>; // For additional properties specific to node type
  createdAt: string;
}

// Save an agent node to the database
export async function saveAgentNode({
  id,
  documentId,
  type,
  label,
  position_x,
  position_y,
  description,
  operation,
  properties,
  userId,
}: {
  id: string;
  documentId: string;
  type: string;
  label: string;
  position_x: number;
  position_y: number;
  description?: string;
  operation?: string;
  properties: Record<string, any>;
  userId: string;
}) {
  const session = await getSession();
  try {
    const createdAt = new Date().toISOString();
    
    // Convert properties to JSON string for storage
    const serializedProperties = JSON.stringify(properties || {});

    await session.run(
      `
      MATCH (d:Document {id: $documentId})
      MATCH (u:User {id: $userId})
      MERGE (n:AgentNode {id: $id, documentId: $documentId})
      ON CREATE SET 
        n.type = $type,
        n.label = $label,
        n.position_x = $position_x,
        n.position_y = $position_y,
        n.description = $description,
        n.operation = $operation,
        n.properties = $properties,
        n.createdAt = $createdAt
      ON MATCH SET
        n.type = $type,
        n.label = $label,
        n.position_x = $position_x,
        n.position_y = $position_y,
        n.description = $description,
        n.operation = $operation,
        n.properties = $properties
      MERGE (u)-[:CREATED]->(n)
      MERGE (n)-[:BELONGS_TO]->(d)
      RETURN n
      `,
      { 
        id, 
        documentId, 
        type, 
        label, 
        position_x, 
        position_y, 
        description: description || '', 
        operation: operation || '',
        properties: serializedProperties,
        userId, 
        createdAt 
      }
    );
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save agent node in database', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Create an agent edge between nodes
export async function saveAgentEdge({
  sourceNodeId,
  targetNodeId,
  documentId,
  userId,
}: {
  sourceNodeId: string;
  targetNodeId: string;
  documentId: string;
  userId: string;
}) {
  const session = await getSession();
  try {
    const createdAt = new Date().toISOString();
    const id = uuidv4();
    
    await session.run(
      `
      MATCH (source:AgentNode {id: $sourceNodeId, documentId: $documentId})
      MATCH (target:AgentNode {id: $targetNodeId, documentId: $documentId})
      MATCH (d:Document {id: $documentId})
      MERGE (source)-[e:CONNECTS_TO {id: $id}]->(target)
      ON CREATE SET 
        e.createdAt = $createdAt,
        e.documentId = $documentId
      RETURN e
      `,
      { 
        id,
        sourceNodeId, 
        targetNodeId, 
        documentId,
        createdAt 
      }
    );
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save agent edge in database', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Save an entire agent (nodes and edges)
export async function saveAgent({
  documentId,
  nodes,
  edges,
  userId,
}: {
  documentId: string;
  nodes: Record<string, any>;
  edges: Array<{source: string, target: string}>;
  userId: string;
}) {
  const session = await getSession();
  try {
    // First delete any existing nodes for this document
    await session.run(
      `
      MATCH (n:AgentNode {documentId: $documentId})
      OPTIONAL MATCH (n)-[r]-()
      DELETE r, n
      `,
      { documentId }
    );
    
    // Then create all nodes
    for (const [nodeId, nodeData] of Object.entries(nodes)) {
      // Filter out properties that start with underscore
      const propertiesToStore = Object.entries(nodeData)
        .filter(([key]) => !key.startsWith('_'))
        .reduce((obj, [key, value]) => {
          // Don't duplicate properties we're explicitly saving
          if (!['id', 'label', 'position_x', 'position_y', 'type', 'description', 'operation'].includes(key)) {
            obj[key] = value;
          }
          return obj;
        }, {});
      
      await saveAgentNode({
        id: nodeId,
        documentId,
        type: nodeData.type || 'process',
        label: nodeData.label || nodeId,
        position_x: nodeData.position_x || 0,
        position_y: nodeData.position_y || 0,
        description: nodeData.description || '',
        operation: nodeData.operation || '',
        properties: propertiesToStore,
        userId
      });
    }
    
    // Then create all edges
    for (const edge of edges) {
      await saveAgentEdge({
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        documentId,
        userId
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save agent in database', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Get all nodes for a document
export async function getAgentNodesByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (n:AgentNode {documentId: $documentId})
      RETURN n
      `,
      { documentId }
    );
    
    return result.records.map(record => {
      const node = record.get('n').properties;
      
      // Parse the properties JSON string
      try {
        if (typeof node.properties === 'string') {
          node.properties = JSON.parse(node.properties);
        }
      } catch (e) {
        node.properties = {};
      }
      
      // Convert string coordinates to numbers
      if (typeof node.position_x === 'string') {
        node.position_x = parseFloat(node.position_x);
      }
      if (typeof node.position_y === 'string') {
        node.position_y = parseFloat(node.position_y);
      }
      
      return node;
    });
  } catch (error) {
    console.error('Failed to get agent nodes by document id from database', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Get all edges for a document
export async function getAgentEdgesByDocumentId({
  documentId,
}: {
  documentId: string;
})