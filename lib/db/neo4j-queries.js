// lib/db/neo4j-queries.js

/**
 * Collection of Cypher queries for interacting with Neo4j database
 */

// Create a new artifact or update an existing one
export const SAVE_ARTIFACT_QUERY = `
MERGE (a:Artifact {artifactId: $artifactId})
ON CREATE SET 
  a.title = $title,
  a.description = $description,
  a.version = $version,
  a.status = $status,
  a.createdAt = $timestamp,
  a.updatedAt = $timestamp,
  a.owner = $owner,
  a.executionCount = 0
ON MATCH SET 
  a.title = $title,
  a.description = $description,
  a.version = $version,
  a.status = $status,
  a.updatedAt = $timestamp,
  a.owner = $owner
  
// Store metadata as JSON
SET a.metadata = $metadataJson
  
// Update executionCount if we have a new execution
WITH a
WHERE $hasExecution = true
SET a.executionCount = coalesce(a.executionCount, 0) + 1,
    a.lastExecutionAt = $timestamp
    
RETURN a
`;

// Create or update a node
export const SAVE_NODE_QUERY = `
MATCH (a:Artifact {artifactId: $artifactId})
MERGE (n:Node {nodeId: $nodeId})
ON CREATE SET 
  n.artifactId = $artifactId,
  n.type = $type,
  n.positionX = $positionX,
  n.positionY = $positionY,
  n.label = $label,
  n.status = $status,
  n.createdAt = $timestamp,
  n.updatedAt = $timestamp,
  n.dataJson = $dataJson,
  n.styleJson = $styleJson
ON MATCH SET 
  n.artifactId = $artifactId,
  n.type = $type,
  n.positionX = $positionX,
  n.positionY = $positionY,
  n.label = $label,
  n.status = $status,
  n.updatedAt = $timestamp,
  n.dataJson = $dataJson,
  n.styleJson = $styleJson
  
// Set optional properties for rich nodes
FOREACH (ignoreMe IN CASE WHEN $description IS NOT NULL THEN [1] ELSE [] END |
  SET n.description = $description)
  
FOREACH (ignoreMe IN CASE WHEN $width IS NOT NULL THEN [1] ELSE [] END |
  SET n.width = $width)
  
FOREACH (ignoreMe IN CASE WHEN $height IS NOT NULL THEN [1] ELSE [] END |
  SET n.height = $height)
  
FOREACH (ignoreMe IN CASE WHEN $backgroundColor IS NOT NULL THEN [1] ELSE [] END |
  SET n.backgroundColor = $backgroundColor)
  
FOREACH (ignoreMe IN CASE WHEN $borderColor IS NOT NULL THEN [1] ELSE [] END |
  SET n.borderColor = $borderColor)
  
FOREACH (ignoreMe IN CASE WHEN $color IS NOT NULL THEN [1] ELSE [] END |
  SET n.color = $color)
  
FOREACH (ignoreMe IN CASE WHEN $inputs IS NOT NULL THEN [1] ELSE [] END |
  SET n.inputs = $inputs)
  
FOREACH (ignoreMe IN CASE WHEN $outputs IS NOT NULL THEN [1] ELSE [] END |
  SET n.outputs = $outputs)
  
FOREACH (ignoreMe IN CASE WHEN $results IS NOT NULL THEN [1] ELSE [] END |
  SET n.results = $results)
  
FOREACH (ignoreMe IN CASE WHEN $config IS NOT NULL THEN [1] ELSE [] END |
  SET n.config = $config)
  
FOREACH (ignoreMe IN CASE WHEN $parameters IS NOT NULL THEN [1] ELSE [] END |
  SET n.parameters = $parameters)

// Set execution properties if available  
FOREACH (ignoreMe IN CASE WHEN $executionStartTime IS NOT NULL THEN [1] ELSE [] END |
  SET n.executionStartTime = $executionStartTime)
  
FOREACH (ignoreMe IN CASE WHEN $executionEndTime IS NOT NULL THEN [1] ELSE [] END |
  SET n.executionEndTime = $executionEndTime)
  
FOREACH (ignoreMe IN CASE WHEN $executionDuration IS NOT NULL THEN [1] ELSE [] END |
  SET n.executionDuration = $executionDuration)
  
FOREACH (ignoreMe IN CASE WHEN $errorMessage IS NOT NULL THEN [1] ELSE [] END |
  SET n.errorMessage = $errorMessage)

// Create relationship to artifact if it doesn't exist
MERGE (n)-[:BELONGS_TO]->(a)

RETURN n
`;

// Create or update an edge
export const SAVE_EDGE_QUERY = `
MATCH (a:Artifact {artifactId: $artifactId})
MATCH (source:Node {nodeId: $source})
MATCH (target:Node {nodeId: $target})
MERGE (e:Edge {edgeId: $edgeId})
ON CREATE SET 
  e.artifactId = $artifactId,
  e.sourceHandle = $sourceHandle,
  e.targetHandle = $targetHandle,
  e.createdAt = $timestamp,
  e.updatedAt = $timestamp,
  e.dataJson = $dataJson,
  e.styleJson = $styleJson
ON MATCH SET 
  e.artifactId = $artifactId,
  e.sourceHandle = $sourceHandle,
  e.targetHandle = $targetHandle,
  e.updatedAt = $timestamp,
  e.dataJson = $dataJson,
  e.styleJson = $styleJson
  
// Set optional properties
FOREACH (ignoreMe IN CASE WHEN $label IS NOT NULL THEN [1] ELSE [] END |
  SET e.label = $label)
  
FOREACH (ignoreMe IN CASE WHEN $width IS NOT NULL THEN [1] ELSE [] END |
  SET e.width = $width)
  
FOREACH (ignoreMe IN CASE WHEN $color IS NOT NULL THEN [1] ELSE [] END |
  SET e.color = $color)
  
FOREACH (ignoreMe IN CASE WHEN $animated IS NOT NULL THEN [1] ELSE [] END |
  SET e.animated = $animated)
  
FOREACH (ignoreMe IN CASE WHEN $edgeType IS NOT NULL THEN [1] ELSE [] END |
  SET e.edgeType = $edgeType)

// Create relationships if they don't exist
MERGE (e)-[:BELONGS_TO]->(a)
MERGE (source)-[r:CONNECTS_TO {via: $edgeId}]->(target)

RETURN e
`;

// Get an artifact with all its nodes and edges
export const GET_ARTIFACT_QUERY = `
MATCH (a:Artifact {artifactId: $artifactId})
OPTIONAL MATCH (n:Node)-[:BELONGS_TO]->(a)
OPTIONAL MATCH (e:Edge)-[:BELONGS_TO]->(a)
OPTIONAL MATCH (source:Node)-[conn:CONNECTS_TO]->(target:Node)
WHERE source.artifactId = $artifactId AND target.artifactId = $artifactId AND conn.via IS NOT NULL
RETURN a, collect(distinct n) as nodes, collect(distinct e) as edges, 
       collect(distinct {source: source.nodeId, target: target.nodeId, via: conn.via}) as connections
`;

// Update node statuses for an artifact
export const UPDATE_NODE_STATUS_QUERY = `
MATCH (n:Node {nodeId: $nodeId, artifactId: $artifactId})
SET n.status = $status,
    n.updatedAt = $timestamp
RETURN n.nodeId, n.status
`;

// Delete an artifact and all related nodes and edges
export const DELETE_ARTIFACT_QUERY = `
MATCH (a:Artifact {artifactId: $artifactId})
OPTIONAL MATCH (n:Node)-[:BELONGS_TO]->(a)
OPTIONAL MATCH (e:Edge)-[:BELONGS_TO]->(a)
DETACH DELETE n, e, a
`;

// List artifacts with pagination and filtering
export const LIST_ARTIFACTS_QUERY = `
MATCH (a:Artifact)
WHERE $status IS NULL OR a.status = $status
WITH a
ORDER BY a.updatedAt DESC
SKIP $skip LIMIT $limit
RETURN a
`;

// Search artifacts, nodes, and edges
export const SEARCH_QUERY = `
// Search artifacts
MATCH (a:Artifact)
WHERE a.title =~ $searchPattern OR a.description =~ $searchPattern
WITH collect(a) as artifacts

// Search nodes
MATCH (n:Node)
WHERE n.label =~ $searchPattern OR n.type =~ $searchPattern OR n.description =~ $searchPattern
WITH artifacts, collect({node: n, artifactId: n.artifactId}) as nodes

// Search edges
MATCH (e:Edge)
WHERE e.label =~ $searchPattern
WITH artifacts, nodes, collect({edge: e, artifactId: e.artifactId}) as edges

RETURN artifacts, nodes, edges
`;

// Get workflow analytics
export const WORKFLOW_ANALYTICS_QUERY = `
MATCH (a:Artifact {artifactId: $artifactId})

// Get node statistics
MATCH (n:Node)-[:BELONGS_TO]->(a)
OPTIONAL MATCH (n)-[out:CONNECTS_TO]->()
OPTIONAL MATCH ()-[in:CONNECTS_TO]->(n)
WITH a, n, count(distinct out) as outDegree, count(distinct in) as inDegree

// Calculate overall statistics
WITH a, 
     count(n) as nodeCount,
     sum(outDegree) as totalConnections,
     collect({
       nodeId: n.nodeId, 
       type: n.type, 
       label: n.label,
       status: n.status,
       outDegree: outDegree, 
       inDegree: inDegree, 
       totalConnections: outDegree + inDegree
     }) as nodeStats

// Get edge count
MATCH (e:Edge)-[:BELONGS_TO]->(a)
WITH a, nodeCount, totalConnections, nodeStats, count(e) as edgeCount

RETURN {
  artifactId: a.artifactId,
  title: a.title,
  status: a.status,
  nodeCount: nodeCount,
  edgeCount: edgeCount,
  totalConnections: totalConnections,
  executionCount: a.executionCount,
  lastExecutionAt: a.lastExecutionAt,
  nodeStats: nodeStats
} as analytics
`;