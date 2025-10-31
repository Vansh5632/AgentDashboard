// apps/api/routes/webhooks.ts
import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { PrismaClient } from '@ai_agent/db';

const router = Router();
const prisma = new PrismaClient();

// 1. Create a connection to Redis
// Supports both REDIS_URL (Railway format) and individual host/port/password
function getRedisConnection() {
  if (process.env.REDIS_URL) {
    // Parse Redis URL (format: redis://username:password@host:port or redis://host:port)
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };
  }
  
  // Fall back to individual environment variables
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  };
}

const redisConnection = getRedisConnection();

// 2. Define our queue. The name 'call-processing' is important!
const callProcessingQueue = new Queue('call-processing', { connection: redisConnection });

router.post('/webhooks/elevenlabs/call-ended', async (req: Request, res: Response) => {
  try {
    console.log('Received call-ended webhook:', JSON.stringify(req.body, null, 2));
    
    // Extract data from the ElevenLabs webhook
    const webhookBody = req.body;
    const webhookData = webhookBody.body || webhookBody;
    
    // Check if this is a post_call_transcription event
    if (webhookData.type !== 'post_call_transcription') {
      console.log('Not a post_call_transcription event, ignoring');
      return res.status(200).json({ message: 'Event type not processed' });
    }

    const eventData = webhookData.data;
    const conversationId = eventData.conversation_id;
    const agentId = eventData.agent_id;
    const transcript = eventData.transcript;
    const metadata = eventData.metadata;
    const analysis = eventData.analysis;

    if (!conversationId || !transcript) {
      return res.status(400).json({ error: 'Missing conversation_id or transcript' });
    }

    if (!agentId) {
      return res.status(400).json({ error: 'Missing agent_id' });
    }

    // Extract phone numbers from metadata
    const phoneMetadata = metadata?.phone_call;
    const customerPhoneNumber = phoneMetadata?.external_number; // The customer's phone
    const agentPhoneNumber = phoneMetadata?.agent_number; // The agent's phone

    // Extract callback-related information from analysis
    const dataCollection = analysis?.data_collection_results || {};
    const finalCallbackTime = dataCollection.Final_callback_time?.value; // The callback time requested
    const leadStatus = dataCollection.Lead_Status?.value;
    const finalState = dataCollection.Final_State?.value;
    
    // Get call duration from metadata
    const callDuration = metadata?.call_duration_secs;

    // Look up or create the agent bot
    // First try to find existing agent by elevenLabsAgentId
    let agentBot = await prisma.agentBot.findFirst({
      where: { elevenLabsAgentId: agentId },
      select: { 
        id: true,
        tenantId: true, 
        name: true,
        agentPhoneNumberId: true 
      }
    });

    // If agent not found, we need to find the tenant by matching the agent phone number
    // or create a new entry. For now, let's assume we have a default tenant or 
    // the system should have at least one tenant with credentials
    if (!agentBot) {
      console.log(`Agent bot not found for agent_id: ${agentId}, will auto-create...`);
      
      // Find the tenant - for MVP, we'll use the first tenant with ElevenLabs credentials
      const credential = await prisma.credential.findFirst({
        where: { serviceName: 'ELEVENLABS' },
        include: { user: { include: { tenant: true } } }
      });

      if (!credential) {
        console.error('No ElevenLabs credentials found in system');
        return res.status(404).json({ error: 'No ElevenLabs credentials configured' });
      }

      const tenantId = credential.user.tenantId;
      
      // Auto-create the agent bot entry
      agentBot = await prisma.agentBot.create({
        data: {
          name: `Agent ${agentId.slice(-8)}`, // Use last 8 chars of agent_id as name
          elevenLabsAgentId: agentId,
          phoneNumber: agentPhoneNumber,
          tenantId: tenantId,
        },
        select: {
          id: true,
          tenantId: true,
          name: true,
          agentPhoneNumberId: true
        }
      });
      
      console.log(`✅ Auto-created agent bot: ${agentBot.name} for tenant: ${tenantId}`);
    }

    console.log(`Processing call for tenant: ${agentBot.tenantId}, agent: ${agentBot.name}`);
    console.log(`Customer phone: ${customerPhoneNumber}, Agent phone: ${agentPhoneNumber}`);
    console.log(`Callback time: ${finalCallbackTime}, Lead status: ${leadStatus}`);

    // Determine if callback is requested based on lead status or explicit callback time
    const callbackRequested = !!(
      finalCallbackTime || 
      leadStatus === 'Call Back' ||
      leadStatus === 'Callback' ||
      leadStatus === 'CALLBACK'
    );

    // 3. Add a job to the queue
    await callProcessingQueue.add('process-transcript', {
      tenantId: agentBot.tenantId,
      conversationId: conversationId,
      transcript: transcript,
      agentId: agentId,
      customerPhoneNumber: customerPhoneNumber,
      agentPhoneNumber: agentPhoneNumber,
      agentPhoneNumberId: agentBot.agentPhoneNumberId,
      callbackRequested: callbackRequested,
      callbackTime: finalCallbackTime, // Natural language time like "2 PM tomorrow"
      leadStatus: leadStatus,
      finalState: finalState,
      callDuration: callDuration,
      fullAnalysis: analysis, // Pass full analysis for more context
    });

    // 4. Respond immediately!
    res.status(202).json({ message: 'Accepted for processing' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;