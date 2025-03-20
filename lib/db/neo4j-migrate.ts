import { getSession } from './neo4j';

async function runMigrations() {
  const session = await getSession();
  
  try {
    console.log('⏳ Running Neo4j schema migrations...');
    
    // Create constraints (equivalent to primary keys)
    await session.run(`
      CREATE CONSTRAINT user_id IF NOT EXISTS
      FOR (u:User) REQUIRE u.id IS UNIQUE
    `);
    
    await session.run(`
      CREATE CONSTRAINT chat_id IF NOT EXISTS
      FOR (c:Chat) REQUIRE c.id IS UNIQUE
    `);
    
    await session.run(`
      CREATE CONSTRAINT message_id IF NOT EXISTS
      FOR (m:Message) REQUIRE m.id IS UNIQUE
    `);
    
    await session.run(`
      CREATE CONSTRAINT document_id IF NOT EXISTS
      FOR (d:Document) REQUIRE d.id IS UNIQUE
    `);
    
    await session.run(`
      CREATE CONSTRAINT suggestion_id IF NOT EXISTS
      FOR (s:Suggestion) REQUIRE s.id IS UNIQUE
    `);
    
    // Create indexes for performance
    await session.run(`
      CREATE INDEX user_email_idx IF NOT EXISTS
      FOR (u:User) ON (u.email)
    `);
    
    console.log('✅ Neo4j schema migrations completed successfully');
  } catch (error) {
    console.error('❌ Neo4j schema migration failed', error);
    throw error;
  } finally {
    await session.close();
  }
}

export async function runNeo4jMigrations() {
  try {
    await runMigrations();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runNeo4jMigrations();
}