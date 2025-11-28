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
    const meetingStatus = dataCollection.Meeting_Status?.value; // Check if appointment was booked
    
    // Check if appointment was successfully booked
    const appointmentBooked = !!(
      meetingStatus === 'Booked' ||
      meetingStatus === 'Appointment Booked' ||
      meetingStatus === 'APPOINTMENT_BOOKED' ||
      leadStatus === 'Appointment Booked' ||
      finalState === 'Appointment Booked'
    );
    
    // Determine if callback is requested - NO callback if appointment is booked
    const callbackRequested = !appointmentBooked && !!(
      finalCallbackTime || 
      leadStatus === 'Call Back' ||
      leadStatus === 'Callback' ||
      leadStatus === 'CALLBACK'
    );

    console.log(`📋 Analysis Results:`);
    console.log(`   Meeting Status: ${meetingStatus}`);
    console.log(`   Lead Status: ${leadStatus}`);
    console.log(`   Final State: ${finalState}`);
    console.log(`   Final Callback Time: ${finalCallbackTime}`);
    console.log(`   Appointment Booked: ${appointmentBooked}`);
    console.log(`   Callback Requested: ${callbackRequested}`);
    
    // Get call duration from metadata
    const callDuration = metadata?.call_duration_secs;

    // Look up or create the agent bot
    // First check AgentMapping to determine which tenant this agent belongs to
    console.log(`🔍 Looking up agent mapping for agent_id: ${agentId}`);
    
    const agentMapping = await prisma.agentMapping.findUnique({
      where: { agentId },
    });

    let tenantId: string;
    let agentBot: any;

    if (agentMapping) {
      // Agent is mapped - use the mapped tenant
      tenantId = agentMapping.tenantId;
      console.log(`✅ Found agent mapping: ${agentId} → tenant ${tenantId}`);
      
      // Get or create agent bot for this tenant
      agentBot = await prisma.agentBot.findFirst({
        where: { 
          elevenLabsAgentId: agentId,
          tenantId 
        },
        select: { 
          id: true,
          tenantId: true, 
          name: true,
          agentPhoneNumberId: true 
        }
      });

      if (!agentBot) {
        agentBot = await prisma.agentBot.create({
          data: {
            name: agentMapping.agentName || `Agent ${agentId.slice(-8)}`,
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
        console.log(`✅ Auto-created agent bot for mapped agent ${agentId}`);
      }
    } else {
      // No mapping found - try legacy lookup by elevenLabsAgentId
      console.log(`⚠️ No agent mapping found for ${agentId}, trying legacy lookup...`);
      
      agentBot = await prisma.agentBot.findFirst({
        where: { elevenLabsAgentId: agentId },
        select: { 
          id: true,
          tenantId: true, 
          name: true,
          agentPhoneNumberId: true 
        }
      });

      if (agentBot) {
        tenantId = agentBot.tenantId;
        console.log(`⚠️ Using legacy agent bot: ${agentId} → tenant ${tenantId}`);
        console.log(`💡 Recommendation: Create an AgentMapping for this agent`);
      } else {
        // Agent not found at all - reject webhook
        console.error(`❌ Agent ${agentId} not found in AgentMapping or AgentBot tables`);
        return res.status(404).json({ 
          error: 'Agent not mapped',
          message: `Agent ${agentId} is not mapped to any tenant`,
          hint: 'Create an agent mapping first: POST /api/agent-mappings'
        });
      }
    }

    console.log(`Processing call for tenant: ${tenantId}, agent: ${agentBot.name}`);
    console.log(`Customer phone: ${customerPhoneNumber}, Agent phone: ${agentPhoneNumber}`);
    console.log(`Callback time: ${finalCallbackTime}, Lead status: ${leadStatus}`);

    // 3. Create immediate CallLog entry for reliability
    const initialCallLog = await prisma.callLog.create({
      data: {
        conversationId: conversationId,
        status: 'PROCESSING', // Initial status
        summary: 'Processing...', // Will be updated by worker
        transcript: JSON.stringify(transcript),
        tenantId: tenantId,
        agentId: agentId,
        customerPhoneNumber: customerPhoneNumber,
        agentPhoneNumber: agentPhoneNumber,
        agentPhoneNumberId: agentBot.agentPhoneNumberId,
        callbackRequested: callbackRequested,
        callbackScheduledAt: callbackRequested ? new Date(Date.now() + 2 * 60 * 60 * 1000) : null, // Default +2h
        callbackReason: callbackRequested ? `Customer requested callback. Lead status: ${leadStatus || 'Unknown'}` : null,
        leadStatus: leadStatus,
        finalState: finalState,
        callDuration: callDuration,
      },
    });

    console.log(`✅ Initial CallLog created with ID: ${initialCallLog.id}`);

    // 4. Add a job to the queue for enhanced processing
    await callProcessingQueue.add('process-transcript', {
      callLogId: initialCallLog.id, // Pass the existing call log ID
      tenantId: tenantId,
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

    // 5. Respond immediately!
    res.status(202).json({ 
      message: 'Accepted for processing',
      callLogId: initialCallLog.id 
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Try to log the error even if processing failed
    try {
      if (req.body?.data?.conversation_id) {
        const conversationId = req.body.data.conversation_id;
        const agentId = req.body.data.agent_id;
        
        // Create minimal error log entry
        await prisma.callLog.create({
          data: {
            conversationId: conversationId,
            status: 'WEBHOOK_ERROR',
            summary: `Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            transcript: JSON.stringify(req.body.data.transcript || []),
            tenantId: 'error', // Placeholder - will need manual cleanup
            agentId: agentId,
            leadStatus: 'ERROR',
            finalState: 'ERROR',
          },
        });
        console.log(`❌ Created error CallLog for conversation: ${conversationId}`);
      }
    } catch (logError) {
      console.error('❌ Failed to create error log:', logError);
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;