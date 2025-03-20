// lib/db/neo4j.ts
import neo4j, { Driver } from 'neo4j-driver';
import { config } from 'dotenv';

config({
  path: '.env.local',
});

const NEO4J_URI = process.env.NEO4J_URI || 'neo4j://localhost:7687';
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

// Use a global variable to store the driver instance
let globalDriver: Driver | undefined;

export function getDriver(): Driver {
  if (globalDriver) return globalDriver;
  
  console.log('Creating new Neo4j driver instance');
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD),
    {
      disableLosslessIntegers: true,
      maxConnectionLifetime: 60 * 60 * 1000, // 1 hour
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 5000,
      // Disable routing to use direct connections
      routing: false
    }
  );
  
  // Store the driver globally
  globalDriver = driver;
  
  // Handle process termination
  if (typeof process !== 'undefined') {
    process.on('exit', () => {
      if (globalDriver) {
        globalDriver.close();
      }
    });
  }
  
  return driver;
}

export async function getSession() {
  const driver = getDriver();
  return driver.session({ database: NEO4J_DATABASE });
}

export async function closeDriver() {
  if (globalDriver) {
    await globalDriver.close();
    globalDriver = undefined;
  }
}