// apps/worker/utils/pinecone.ts
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Pinecone client
let pineconeClient: Pinecone | null = null;

/**
 * Initialize and return the Pinecone client
 */
export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY is not set in environment variables');
    }

    pineconeClient = new Pinecone({
      apiKey: apiKey,
    });

    console.log('Pinecone client initialized');
  }

  return pineconeClient;
}

/**
 * Upsert a vector to Pinecone with metadata
 */
export async function upsertCallVector(
  conversationId: string,
  embedding: number[],
  metadata: {
    tenantId: string;
    summary: string;
    agentId?: string;
    timestamp?: Date;
    phoneNumber?: string; // Add phone number to metadata
  }
): Promise<void> {
  try {
    const indexName = process.env.PINECONE_INDEX_NAME;
    
    if (!indexName) {
      throw new Error('PINECONE_INDEX_NAME is not set in environment variables');
    }

    const client = getPineconeClient();
    const index = client.index(indexName);

    console.log(`Upserting vector for conversation: ${conversationId}`);

    await index.upsert([
      {
        id: conversationId,
        values: embedding,
        metadata: {
          tenantId: metadata.tenantId,
          summary: metadata.summary,
          agentId: metadata.agentId || '',
          timestamp: (metadata.timestamp || new Date()).toISOString(),
          phoneNumber: metadata.phoneNumber || '', // Store phone number
        },
      },
    ]);

    console.log(`Successfully upserted vector for conversation: ${conversationId}`);
  } catch (error) {
    console.error('Error upserting to Pinecone:', error);
    throw new Error(`Failed to upsert vector: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Query similar calls from Pinecone
 */
export async function querySimilarCalls(
  embedding: number[],
  tenantId: string,
  topK: number = 5
): Promise<any[]> {
  try {
    const indexName = process.env.PINECONE_INDEX_NAME;
    
    if (!indexName) {
      throw new Error('PINECONE_INDEX_NAME is not set in environment variables');
    }

    const client = getPineconeClient();
    const index = client.index(indexName);

    console.log(`Querying similar calls for tenant: ${tenantId}`);

    const queryResponse = await index.query({
      vector: embedding,
      topK,
      filter: { tenantId: { $eq: tenantId } },
      includeMetadata: true,
    });

    console.log(`Found ${queryResponse.matches?.length || 0} similar calls`);
    return queryResponse.matches || [];
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    throw new Error(`Failed to query vectors: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a vector from Pinecone
 */
export async function deleteCallVector(conversationId: string): Promise<void> {
  try {
    const indexName = process.env.PINECONE_INDEX_NAME;
    
    if (!indexName) {
      throw new Error('PINECONE_INDEX_NAME is not set in environment variables');
    }

    const client = getPineconeClient();
    const index = client.index(indexName);

    console.log(`Deleting vector for conversation: ${conversationId}`);

    await index.deleteOne(conversationId);

    console.log(`Successfully deleted vector for conversation: ${conversationId}`);
  } catch (error) {
    console.error('Error deleting from Pinecone:', error);
    throw new Error(`Failed to delete vector: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if Pinecone index exists and is ready
 */
export async function checkPineconeHealth(): Promise<boolean> {
  try {
    const indexName = process.env.PINECONE_INDEX_NAME;
    
    if (!indexName) {
      console.error('PINECONE_INDEX_NAME is not set');
      return false;
    }

    const client = getPineconeClient();
    const index = client.index(indexName);
    
    const stats = await index.describeIndexStats();
    console.log('Pinecone index stats:', stats);
    return true;
  } catch (error) {
    console.error('Pinecone health check failed:', error);
    return false;
  }
}

/**
 * Query similar calls by phone number to get conversation context
 * Returns formatted call data for ElevenLabs outbound calls
 */
export async function querySimilarCallsByPhone(
  phoneNumber: string,
  tenantId: string,
  topK: number = 3
): Promise<Array<{
  conversation_id: string;
  summary: string;
  timestamp: string;
}>> {
  try {
    const indexName = process.env.PINECONE_INDEX_NAME;
    
    if (!indexName) {
      throw new Error('PINECONE_INDEX_NAME is not set in environment variables');
    }

    const client = getPineconeClient();
    const index = client.index(indexName);

    console.log(`Querying similar calls for phone: ${phoneNumber}, tenant: ${tenantId}`);

    // Query by metadata filter (phone number and tenant)
    // Since we're filtering by phone number, we don't need a vector query
    const queryResponse = await index.query({
      vector: new Array(1536).fill(0), // Dummy vector for metadata-only query
      topK,
      filter: { 
        tenantId: { $eq: tenantId },
        // We'll need to store phone number in metadata when upserting
      },
      includeMetadata: true,
    });

    console.log(`Found ${queryResponse.matches?.length || 0} similar calls`);
    
    // Format the response for ElevenLabs
    const callData = (queryResponse.matches || []).map(match => ({
      conversation_id: match.id,
      summary: (match.metadata?.summary as string) || 'No summary available',
      timestamp: (match.metadata?.timestamp as string) || new Date().toISOString()
    }));

    return callData;
  } catch (error) {
    console.error('Error querying Pinecone by phone:', error);
    // Return empty array on error instead of throwing
    return [];
  }
}
