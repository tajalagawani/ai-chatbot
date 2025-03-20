// lib/db/migrate-to-neo4j.ts

import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import neo4j from 'neo4j-driver';
import * as schema from './schema';

// Load environment variables
config({
  path: '.env.local',
});

// Neo4j connection details
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j://localhost:7687';
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

async function migrateData() {
  console.log('Starting data migration from PostgreSQL to Neo4j...');
  
  // Connect to PostgreSQL
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined in your environment variables');
  }
  
  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client);
  
  // Connect to Neo4j
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );
  
  const session = driver.session({ database: NEO4J_DATABASE });
  
  try {
    // 1. Setup constraints first
    console.log('Setting up Neo4j constraints...');
    await setupNeo4jConstraints(session);
    
    // 2. Migrate Users
    console.log('Migrating users...');
    const users = await db.select().from(schema.user);
    
    for (const user of users) {
      console.log(`Migrating user: ${user.email}`);
      await session.run(
        `
        MERGE (u:User {id: $id})
        SET u.email = $email, 
            u.password = $password
        RETURN u
        `,
        { 
          id: user.id, 
          email: user.email, 
          password: user.password || null 
        }
      );
    }
    console.log(`${users.length} users migrated successfully`);
    
    // 3. Migrate Chats
    console.log('Migrating chats...');
    const chats = await db.select().from(schema.chat);
    
    for (const chat of chats) {
      console.log(`Migrating chat: ${chat.title} (${chat.id})`);
      await session.run(
        `
        MATCH (u:User {id: $userId})
        MERGE (c:Chat {id: $id})
        SET c.createdAt = $createdAt,
            c.title = $title,
            c.visibility = $visibility
        MERGE (u)-[:OWNS]->(c)
        RETURN c
        `,
        { 
          id: chat.id, 
          userId: chat.userId, 
          createdAt: chat.createdAt.toISOString(),
          title: chat.title,
          visibility: chat.visibility
        }
      );
    }
    console.log(`${chats.length} chats migrated successfully`);
    
    // 4. Migrate Messages
    console.log('Migrating messages...');
    const messages = await db.select().from(schema.message);
    let migratedCount = 0;
    
    for (const msg of messages) {
      const content = typeof msg.content === 'object' ? JSON.stringify(msg.content) : msg.content;
      
      await session.run(
        `
        MATCH (c:Chat {id: $chatId})
        MERGE (m:Message {id: $id})
        SET m.role = $role,
            m.content = $content,
            m.createdAt = $createdAt
        MERGE (m)-[:BELONGS_TO]->(c)
        RETURN m
        `,
        { 
          id: msg.id, 
          chatId: msg.chatId, 
          role: msg.role,
          content: content,
          createdAt: msg.createdAt.toISOString()
        }
      );
      
      migratedCount++;
      if (migratedCount % 100 === 0) {
        console.log(`Migrated ${migratedCount} messages so far...`);
      }
    }
    console.log(`${messages.length} messages migrated successfully`);
    
    // 5. Migrate Documents
    console.log('Migrating documents...');
    const documents = await db.select().from(schema.document);
    
    for (const doc of documents) {
      console.log(`Migrating document: ${doc.title} (${doc.id})`);
      await session.run(
        `
        MATCH (u:User {id: $userId})
        MERGE (d:Document {id: $id})
        SET d.createdAt = $createdAt,
            d.title = $title,
            d.content = $content,
            d.kind = $kind
        MERGE (u)-[:CREATED]->(d)
        RETURN d
        `,
        { 
          id: doc.id, 
          userId: doc.userId, 
          createdAt: doc.createdAt.toISOString(),
          title: doc.title,
          content: doc.content || '',
          kind: doc.kind
        }
      );
    }
    console.log(`${documents.length} documents migrated successfully`);
    
    // 6. Migrate Votes
    console.log('Migrating votes...');
    const votes = await db.select().from(schema.vote);
    
    for (const vote of votes) {
      // For votes, we need to find a user - let's use the chat owner
      const result = await session.run(
        `
        MATCH (u:User)-[:OWNS]->(c:Chat {id: $chatId})
        RETURN u.id as userId
        `,
        { chatId: vote.chatId }
      );
      
      const userId = result.records[0]?.get('userId');
      if (!userId) {
        console.warn(`Could not find user for vote on message ${vote.messageId}`);
        continue;
      }
      
      await session.run(
        `
        MATCH (u:User {id: $userId})
        MATCH (m:Message {id: $messageId})
        MERGE (u)-[v:VOTES {isUpvoted: $isUpvoted}]->(m)
        RETURN v
        `,
        { 
          userId,
          messageId: vote.messageId, 
          isUpvoted: vote.isUpvoted
        }
      );
    }
    console.log(`${votes.length} votes migrated successfully`);
    
    // 7. Migrate Suggestions
    console.log('Migrating suggestions...');
    const suggestions = await db.select().from(schema.suggestion);
    
    for (const sugg of suggestions) {
      console.log(`Migrating suggestion for document: ${sugg.documentId}`);
      await session.run(
        `
        MATCH (u:User {id: $userId})
        MATCH (d:Document {id: $documentId})
        MERGE (s:Suggestion {id: $id})
        SET s.originalText = $originalText,
            s.suggestedText = $suggestedText,
            s.description = $description,
            s.isResolved = $isResolved,
            s.createdAt = $createdAt,
            s.documentCreatedAt = $documentCreatedAt
        MERGE (s)-[:SUGGESTS_FOR]->(d)
        MERGE (u)-[:CREATED]->(s)
        RETURN s
        `,
        { 
          id: sugg.id, 
          userId: sugg.userId, 
          documentId: sugg.documentId,
          documentCreatedAt: sugg.documentCreatedAt.toISOString(),
          originalText: sugg.originalText,
          suggestedText: sugg.suggestedText,
          description: sugg.description || '',
          isResolved: sugg.isResolved,
          createdAt: sugg.createdAt.toISOString()
        }
      );
    }
    console.log(`${suggestions.length} suggestions migrated successfully`);
    
    console.log('Data migration completed successfully!');
  } catch (error) {
    console.error('Error during data migration:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
    await client.end();
  }
}

async function setupNeo4jConstraints(session) {
  // Create constraints to ensure uniqueness
  const constraints = [
    `CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE`,
    `CREATE CONSTRAINT chat_id IF NOT EXISTS FOR (c:Chat) REQUIRE c.id IS UNIQUE`,
    `CREATE CONSTRAINT message_id IF NOT EXISTS FOR (m:Message) REQUIRE m.id IS UNIQUE`,
    `CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE`,
    `CREATE CONSTRAINT suggestion_id IF NOT EXISTS FOR (s:Suggestion) REQUIRE s.id IS UNIQUE`
  ];
  
  // Create indexes for performance
  const indexes = [
    `CREATE INDEX user_email_idx IF NOT EXISTS FOR (u:User) ON (u.email)`
  ];
  
  for (const constraint of constraints) {
    await session.run(constraint);
  }
  
  for (const index of indexes) {
    await session.run(index);
  }
  
  console.log('Neo4j constraints and indexes set up successfully');
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateData()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}