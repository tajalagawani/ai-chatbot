// lib/db/setup-neo4j.ts
import { config } from 'dotenv';
import neo4j from 'neo4j-driver';

// Load environment variables
config({
  path: '.env.local',
});

// Neo4j connection details
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j://localhost:7687';
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

async function setupNeo4j() {
  console.log('Setting up Neo4j database...');
  
  // Connect to Neo4j
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );
  
  const session = driver.session({ database: NEO4J_DATABASE });
  
  try {
    // Set up constraints and indexes
    console.log('Creating constraints and indexes...');
    
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
    
    console.log('Neo4j setup completed successfully!');
  } catch (error) {
    console.error('Error during Neo4j setup:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupNeo4j()
    .then(() => {
      console.log('Setup completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}