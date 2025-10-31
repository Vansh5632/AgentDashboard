// apps/worker/worker.ts
import { Worker, Job, Queue } from 'bullmq';
import { PrismaClient } from '@ai_agent/db';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { generateCallSummary, generateEmbedding, detectCallbackNeeded, parseCallbackTime } from './utils/openai';
import { upsertCallVector, checkPineconeHealth } from './utils/pinecone';
import { initiateCallbackCall, validatePhoneNumber, formatPhoneNumber } from './utils/elevenlabs';
import { sendWhatsAppNotification, validateGHLWebhookUrl } from './utils/gohighlevel';

dotenv.config({ path: '../../.env' }); // Adjust path to root .env

const prisma = new PrismaClient();

// Cal.com API base URL
const CALCOM_API_BASE = process.env.CALCOM_API_BASE_URL || 'https://api.cal.com/v1';

// Redis connection configuration
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

console.log('Worker is starting...');
console.log(`Redis connection: ${redisConnection.host}:${redisConnection.port}`);

// Create a queue instance for adding new jobs
const callProcessingQueue = new Queue('call-processing', { connection: redisConnection });
const meetingProcessingQueue = new Queue('meeting-processing', { connection: redisConnection });

// Check Pinecone health on startup
checkPineconeHealth().then(healthy => {
  if (healthy) {
    console.log('✅ Pinecone connection verified');
  } else {
    console.warn('⚠️ Pinecone connection check failed - proceeding anyway');
  }
});

// The worker listens to the 'call-processing' queue
const worker = new Worker('call-processing', async (job: Job) => {
  console.log(`\n📞 Processing job ${job.id} of type ${job.name}`);
  console.log('Job data:', job.data);

  const { tenantId, conversationId, transcript, agentId, customerPhoneNumber, agentPhoneNumber, 
          agentPhoneNumberId, callbackRequested, callbackTime, leadStatus, finalState, 
          callDuration, fullAnalysis } = job.data;

  if (job.name === 'process-transcript') {
    try {
      // === STEP 1: Generate AI Summary ===
      console.log('\n🤖 Step 1: Generating AI summary...');
      const summary = await generateCallSummary(transcript);
      console.log('Summary:', summary.substring(0, 100) + '...');

      // === STEP 2: Generate Embedding ===
      console.log('\n🔢 Step 2: Generating embedding vector...');
      const embedding = await generateEmbedding(summary);
      console.log(`Embedding dimensions: ${embedding.length}`);

      // === STEP 3: Store to Pinecone ===
      console.log('\n📊 Step 3: Storing vector to Pinecone...');
      await upsertCallVector(conversationId, embedding, {
        tenantId,
        summary,
        agentId,
        timestamp: new Date(),
        phoneNumber: customerPhoneNumber, // Store phone number for context retrieval
      });

      // === STEP 4: Parse callback time if provided ===
      let parsedCallbackTime: Date | null = null;
      if (callbackTime && callbackRequested) {
        console.log(`\n⏰ Step 4: Parsing callback time: "${callbackTime}"`);
        parsedCallbackTime = await parseCallbackTime(callbackTime);
        
        if (parsedCallbackTime) {
          console.log(`✅ Callback scheduled for: ${parsedCallbackTime.toISOString()}`);
        } else {
          console.log('⚠️ Could not parse callback time, will default to +2 hours if needed');
        }
      }

      // === STEP 5: Save to PostgreSQL ===
      console.log('\n💾 Step 5: Saving to PostgreSQL database...');
      const callLog = await prisma.callLog.create({
        data: {
          conversationId: conversationId,
          status: callbackRequested ? 'CALLBACK_SCHEDULED' : 'COMPLETED',
          summary: summary,
          transcript: JSON.stringify(transcript),
          tenantId: tenantId,
          agentId: agentId,
          customerPhoneNumber: customerPhoneNumber,
          agentPhoneNumber: agentPhoneNumber,
          agentPhoneNumberId: agentPhoneNumberId,
          callbackRequested: callbackRequested,
          callbackScheduledAt: parsedCallbackTime || (callbackRequested ? new Date(Date.now() + 2 * 60 * 60 * 1000) : null),
          callbackReason: callbackRequested ? `Customer requested callback. Lead status: ${leadStatus || 'Unknown'}` : null,
          leadStatus: leadStatus,
          finalState: finalState,
          callDuration: callDuration,
        },
      });
      console.log(`CallLog created with ID: ${callLog.id}`);

      // === STEP 6: Schedule callback if needed ===
      if (callbackRequested && callLog.callbackScheduledAt) {
        console.log(`\n📞 Step 6: Scheduling callback job...`);
        const delay = callLog.callbackScheduledAt.getTime() - Date.now();
        
        if (delay > 0) {
          await callProcessingQueue.add('execute-callback', {
            callLogId: callLog.id,
            tenantId,
            conversationId,
            agentId,
          }, {
            delay: delay,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 60000, // 1 minute initial delay for retries
            },
          });
          console.log(`✅ Callback job scheduled for ${new Date(Date.now() + delay).toISOString()}`);
        } else {
          // If scheduled time is in the past, schedule for 2 hours from now
          const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
          await prisma.callLog.update({
            where: { id: callLog.id },
            data: { callbackScheduledAt: futureTime },
          });
          
          await callProcessingQueue.add('execute-callback', {
            callLogId: callLog.id,
            tenantId,
            conversationId,
            agentId,
          }, {
            delay: 2 * 60 * 60 * 1000,
            attempts: 3,
          });
          console.log('⚠️ Scheduled time was in past, rescheduled for +2 hours');
        }
      } else {
        console.log('\n❌ No callback requested by customer');
      }

      console.log(`\n✅ Successfully processed job ${job.id}`);
      return { 
        success: true, 
        summary,
        callLogId: callLog.id,
        callbackScheduled: callbackRequested 
      };

    } catch (error) {
      console.error(`\n❌ Job ${job.id} failed`, error);
      throw error;
    }
  } else if (job.name === 'execute-callback') {
    // === Handle callback execution ===
    console.log('\n📞 Processing callback execution...');
    const { callLogId, tenantId, conversationId, agentId } = job.data;
    
    try {
      // Get the CallLog with callback information
      const callLog = await prisma.callLog.findUnique({
        where: { id: callLogId },
        include: { tenant: true }
      });

      if (!callLog) {
        throw new Error(`CallLog not found: ${callLogId}`);
      }

      if (!callLog.callbackRequested) {
        console.log('❌ Callback not requested for this call log');
        return { success: false, error: 'Callback not requested' };
      }

      if (!callLog.customerPhoneNumber) {
        console.error('❌ No customer phone number available for callback');
        await prisma.callLog.update({
          where: { id: callLogId },
          data: { 
            status: 'CALLBACK_FAILED',
            callbackAttempts: callLog.callbackAttempts + 1
          },
        });
        throw new Error('No customer phone number available');
      }

      // Validate phone number
      if (!validatePhoneNumber(callLog.customerPhoneNumber)) {
        console.error('❌ Invalid phone number format:', callLog.customerPhoneNumber);
        await prisma.callLog.update({
          where: { id: callLogId },
          data: { 
            status: 'CALLBACK_FAILED',
            callbackAttempts: callLog.callbackAttempts + 1
          },
        });
        throw new Error('Invalid phone number format');
      }

      const formattedPhoneNumber = formatPhoneNumber(callLog.customerPhoneNumber);
      console.log(`📞 Initiating callback to: ${formattedPhoneNumber}`);
      console.log(`👤 Customer: ${callLog.tenant.name}`);
      console.log(`🤖 Agent: ${agentId}`);
      console.log(`📝 Reason: ${callLog.callbackReason}`);

      // Increment attempt counter
      await prisma.callLog.update({
        where: { id: callLogId },
        data: { 
          callbackAttempts: callLog.callbackAttempts + 1,
          status: 'CALLBACK_IN_PROGRESS'
        },
      });

      // Initiate the callback using ElevenLabs
      const callbackResponse = await initiateCallbackCall({
        customerPhoneNumber: formattedPhoneNumber,
        agentId: agentId,
        agentPhoneNumber: callLog.agentPhoneNumber || undefined,
        agentPhoneNumberId: callLog.agentPhoneNumberId || undefined,
        callbackReason: callLog.callbackReason || 'Follow-up call as requested',
        conversationId: conversationId,
        tenantId: tenantId
      });

      // Update CallLog with successful callback
      await prisma.callLog.update({
        where: { id: callLogId },
        data: {
          status: 'CALLBACK_COMPLETED',
          callbackCompletedAt: new Date(),
        },
      });

      console.log('✅ Callback initiated successfully');
      console.log('ElevenLabs Response:', callbackResponse);

      return { 
        success: true, 
        callbackConversationId: callbackResponse.conversation_id,
        phoneNumber: formattedPhoneNumber
      };

    } catch (error) {
      console.error('❌ Failed to execute callback:', error);
      
      // Update the CallLog with failure status
      await prisma.callLog.update({
        where: { id: callLogId },
        data: { status: 'CALLBACK_FAILED' },
      });

      throw error;
    }
  } else if (job.name === 'schedule-callback') {
    // === Legacy callback scheduling (for backward compatibility) ===
    console.log('\n📅 Processing legacy callback scheduling...');
    const { tenantId, conversationId, callLogId, reason } = job.data;
    
    try {
      // Update the CallLog to mark that a callback is needed
      await prisma.callLog.update({
        where: { id: callLogId },
        data: {
          status: 'CALLBACK_NEEDED',
          callbackRequested: true,
          callbackReason: reason,
          // Default to 2 hours from now if using legacy system
          callbackScheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
      });

      console.log('✅ Legacy callback scheduled successfully');
      return { success: true, callbackScheduled: true };
    } catch (error) {
      console.error('❌ Failed to schedule legacy callback:', error);
      throw error;
    }
  } else if (job.name === 'schedule-callback') {
    // === Handle callback scheduling ===
    console.log('\n📅 Processing callback scheduling...');
    const { tenantId, conversationId, callLogId, reason } = job.data;
    
    try {
      // TODO: Integrate with Cal.com or your scheduling system
      // For now, we'll just log it
      console.log(`Callback needed for conversation: ${conversationId}`);
      console.log(`Reason: ${reason}`);
      console.log(`Tenant: ${tenantId}`);
      
      // You can update the CallLog to mark that a callback is needed
      await prisma.callLog.update({
        where: { id: callLogId },
        data: {
          status: 'CALLBACK_NEEDED',
          // You could add a callbackReason field to the schema
        },
      });

      console.log('✅ Callback scheduled successfully');
      return { success: true, callbackScheduled: true };
    } catch (error) {
      console.error('❌ Failed to schedule callback:', error);
      throw error;
    }
  }

  // Unknown job type
  console.warn(`⚠️ Unknown job type: ${job.name}`);
  return { success: false, error: 'Unknown job type' };

}, { 
  connection: redisConnection,
  concurrency: 5, // Process up to 5 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs
    duration: 1000, // per 1 second
  },
});

// === MEETING PROCESSING WORKER ===
// This worker handles meeting booking confirmations asynchronously
const meetingWorker = new Worker('meeting-processing', async (job: Job) => {
  console.log(`\n📅 Processing meeting job ${job.id} of type ${job.name}`);
  console.log('Job data:', job.data);

  if (job.name === 'confirm-booking') {
    const {
      meetingId,
      tenantId,
      eventTypeId,
      start,
      responses,
      timeZone,
      language,
      metadata,
    } = job.data;

    try {
      console.log(`\n📅 Confirming meeting booking for: ${responses.email}`);
      console.log(`Meeting time: ${start}, Event Type: ${eventTypeId}`);

      // Get tenant's Cal.com API key
      const credentials = await prisma.meetingCredential.findUnique({
        where: { tenantId },
      });

      if (!credentials || !credentials.calcomApiKey) {
        console.error('❌ Cal.com API key not configured for tenant');
        
        // Update meeting status to FAILED
        await prisma.meeting.update({
          where: { id: meetingId },
          data: {
            status: 'FAILED',
            errorMessage: 'Cal.com API key not configured.',
          },
        });

        throw new Error('Cal.com API key not configured');
      }

      // Direct Cal.com API call to create booking
      // Cal.com v1 API uses apiKey as query parameter
      console.log('📞 Calling Cal.com API to create booking...');
      const bookingResponse = await axios.post(
        `${CALCOM_API_BASE}/bookings?apiKey=${credentials.calcomApiKey}`,
        {
          eventTypeId,
          start,
          responses,
          timeZone,
          language,
          metadata: metadata || {},
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const booking = bookingResponse.data;
      console.log(`✅ Cal.com booking created successfully: ${booking.id || booking.uid}`);
      console.log('Booking response:', JSON.stringify(booking, null, 2));

      // Extract meeting link from Cal.com response
      const meetingLink = booking.meetingUrl || 
                         booking.metadata?.videoCallUrl || 
                         booking.location ||
                         null;
      
      console.log(`🔗 Meeting link: ${meetingLink || 'No link provided'}`);

      // Update meeting record with success and store Cal.com response
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          status: 'CONFIRMED',
          calcomEventId: booking.id?.toString() || booking.uid?.toString(),
          calcomResponse: booking, // Store full Cal.com response
          meetingLink: meetingLink,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Meeting ${meetingId} confirmed successfully`);

      // === STEP 2: Send WhatsApp notification via GHL ===
      if (credentials.ghlWhatsappWebhook) {
        console.log('\n📱 Attempting to send WhatsApp notification...');

        // Validate webhook URL
        const validation = validateGHLWebhookUrl(credentials.ghlWhatsappWebhook);
        
        if (validation.valid) {
          try {
            const whatsappResult = await sendWhatsAppNotification(
              credentials.ghlWhatsappWebhook,
              {
                customerName: responses.name,
                customerPhoneNumber: responses.phone || responses.phoneNumber || 'Unknown',
                meetingTime: start,
                meetingLink: meetingLink || undefined,
                duration: 30, // Default duration, can be extracted from eventType if needed
                timezone: timeZone,
                calcomEventId: booking.id?.toString() || booking.uid?.toString(),
                notes: responses.notes,
              }
            );

            if (whatsappResult.success) {
              console.log('✅ WhatsApp notification sent successfully');
              
              // Update meeting with WhatsApp success
              await prisma.meeting.update({
                where: { id: meetingId },
                data: {
                  whatsappSent: true,
                  whatsappSentAt: new Date(),
                },
              });
            } else {
              console.error('❌ WhatsApp notification failed:', whatsappResult.error);
              
              // Update meeting with WhatsApp error
              await prisma.meeting.update({
                where: { id: meetingId },
                data: {
                  whatsappSent: false,
                  whatsappError: whatsappResult.error,
                },
              });
            }
          } catch (whatsappError: any) {
            console.error('❌ Exception while sending WhatsApp:', whatsappError.message);
            
            // Update meeting with WhatsApp error
            await prisma.meeting.update({
              where: { id: meetingId },
              data: {
                whatsappSent: false,
                whatsappError: whatsappError.message,
              },
            });
          }
        } else {
          console.warn(`⚠️ GHL webhook URL validation failed: ${validation.error}`);
          
          await prisma.meeting.update({
            where: { id: meetingId },
            data: {
              whatsappSent: false,
              whatsappError: validation.error,
            },
          });
        }
      } else {
        console.log('ℹ️ No GHL webhook configured, skipping WhatsApp notification');
      }

      return { 
        success: true, 
        meetingId,
        bookingId: booking.id || booking.uid,
        meetingLink: meetingLink,
        whatsappSent: credentials.ghlWhatsappWebhook ? true : false,
        message: 'Meeting confirmed successfully'
      };

    } catch (error: any) {
      console.error(`\n❌ Meeting job ${job.id} failed:`, error);

      let errorMessage = 'Unknown error occurred';
      
      if (error.response) {
        errorMessage = error.response.data?.message || `Cal.com API error: ${error.response.status}`;
        console.error('Cal.com API response:', error.response.data);
      } else if (error.request) {
        errorMessage = 'Cal.com API did not respond';
      } else {
        errorMessage = error.message;
      }

      // Update meeting status to FAILED
      try {
        await prisma.meeting.update({
          where: { id: meetingId },
          data: {
            status: 'FAILED',
            errorMessage,
            updatedAt: new Date(),
          },
        });
      } catch (updateError) {
        console.error('Failed to update meeting status:', updateError);
      }

      throw error; // Re-throw to trigger retry mechanism
    }
  }

  // Unknown job type
  console.warn(`⚠️ Unknown meeting job type: ${job.name}`);
  return { success: false, error: 'Unknown job type' };

}, {
  connection: redisConnection,
  concurrency: 3, // Process up to 3 meeting bookings concurrently
});

// Meeting worker event handlers
meetingWorker.on('completed', (job: Job, result: any) => {
  console.log(`\n✅ Meeting job ${job.id} completed! Result:`, result);
});

meetingWorker.on('failed', (job: Job | undefined, err: Error) => {
  if (job) {
    console.error(`\n❌ Meeting job ${job.id} failed with error: ${err.message}`);
    console.error('Stack trace:', err.stack);
  } else {
    console.error(`\n❌ A meeting job failed with error: ${err.message}`);
  }
});

// Event handlers for better monitoring
worker.on('completed', (job: Job, result: any) => {
  console.log(`\n✅ Job ${job.id} completed! Result:`, result);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  if (job) {
    console.error(`\n❌ Job ${job.id} failed with error: ${err.message}`);
    console.error('Stack trace:', err.stack);
  } else {
    console.error(`\n❌ A job failed with error: ${err.message}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⚠️ SIGTERM received, shutting down gracefully...');
  await worker.close();
  await meetingWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️ SIGINT received, shutting down gracefully...');
  await worker.close();
  await meetingWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('✅ Workers are running and listening for jobs...');
console.log('   - Call processing worker (queue: call-processing)');
console.log('   - Meeting processing worker (queue: meeting-processing)');
