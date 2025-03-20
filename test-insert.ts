// test-insert.ts
import { getSession } from './lib/db/neo4j';
import { v4 as uuidv4 } from 'uuid';

async function testInsert() {
  const session = await getSession();
  try {
    console.log('Testing Neo4j insert operation...');
    
    // Create a test user
    const userId = uuidv4();
    const userResult = await session.run(
      `CREATE (u:User {id: $id, email: $email, password: $password}) RETURN u`,
      { id: userId, email: 'test@example.com', password: 'password123' }
    );
    console.log('User created:', userResult.records[0].get('u').properties);
    
    // Create a test document
    const docId = uuidv4();
    const docResult = await session.run(
      `
      MATCH (u:User {id: $userId})
      CREATE (d:Document {
        id: $id, 
        title: $title, 
        kind: $kind, 
        content: $content, 
        createdAt: $createdAt
      })
      CREATE (u)-[:CREATED]->(d)
      RETURN d
      `,
      { 
        id: docId, 
        userId: userId,
        title: 'Test Document', 
        kind: 'text', 
        content: 'This is a test document', 
        createdAt: new Date().toISOString() 
      }
    );
    console.log('Document created:', docResult.records[0].get('d').properties);
    
    // Query to verify data exists
    const queryResult = await session.run('MATCH (n) RETURN count(n) as count');
    console.log('Total nodes in database:', queryResult.records[0].get('count').toNumber());
    
    return true;
  } catch (error) {
    console.error('Insert operation failed:', error);
    return false;
  } finally {
    await session.close();
  }
}

testInsert().then(success => {
  if (success) {
    console.log('Test completed successfully');
  } else {
    console.log('Test failed');
  }
  process.exit(0);
});