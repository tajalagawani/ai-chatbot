// test-neo4j.ts
import { getSession } from './lib/db/neo4j';
import { config } from 'dotenv';

config({ path: '.env.local' });

console.log('Using Neo4j credentials:', {
  uri: process.env.NEO4J_URI,
  username: process.env.NEO4J_USERNAME,
  // Don't log the full password for security
  passwordLength: process.env.NEO4J_PASSWORD?.length
});

// Rest of your test function...