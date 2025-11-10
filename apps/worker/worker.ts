// apps/worker/worker.ts
import { Worker, Job, Queue } from 'bullmq';
import { PrismaClient } from '@ai_agent/db';
import * as dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { generateCallSummary, generateEmbedding, detectCallbackNeeded, parseCallbackTime } from './utils/openai';
import { upsertCallVector, checkPineconeHealth } from './utils/pinecone';
import { initiateCallbackCall, validatePhoneNumber, formatPhoneNumber } from './utils/elevenlabs';
import { sendWhatsAppNotification, validateGHLWebhookUrl } from './utils/gohighlevel';

// Load environment variables with better path resolution
// Try multiple paths to find the .env file
const possibleEnvPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env')
];

for (const envPath of possibleEnvPaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`Environment loaded from: ${envPath}`);
      break;
    }
  } catch (error) {
    // Continue to next path
  }
}

// Helper function for UTC timezone display  
function toUTCTimeString(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

const prisma = new PrismaClient();

// Cal.com API base URL
const CALCOM_API_BASE = process.env.CALCOM_API_BASE_URL || 'https://api.cal.com/v1';

// Redis connection configuration
// Supports both REDIS_URL and individual host/port/password
function getRedisConnection() {
  if (process.env.REDIS_URL) {
    // Parse Redis URL (format: redis://username:password@host:port or redis://host:port)
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      maxRetriesPerRequest: null, // Set to null as recommended by BullMQ
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
    maxRetriesPerRequest: null, // Set to null as recommended by BullMQ
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
          callDuration, fullAnalysis, callLogId } = job.data;

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

      // === STEP 4A: Callback Detection and Time Parsing ===
      let finalCallbackRequested = callbackRequested;
      let finalCallbackTime = callbackTime;
      
      if (!callbackRequested) {
        console.log('\n🔍 Step 4A: ElevenLabs detected no callback request. Running backup OpenAI detection...');
        try {
          const backupDetection = await detectCallbackNeeded(transcript);
          if (backupDetection.needed) {
            console.log(`✅ Backup detection found callback needed! Reason: ${backupDetection.reason}`);
            finalCallbackRequested = true;
            finalCallbackTime = backupDetection.requestedTime || null;
            
            if (backupDetection.suggestedDateTime) {
              finalCallbackTime = backupDetection.suggestedDateTime.toISOString();
            }
          } else {
            console.log('👍 Backup detection confirms no callback needed');
          }
        } catch (error) {
          console.error('⚠️ Backup callback detection failed:', error);
        }
      } else {
        console.log('\n✅ Step 4A: ElevenLabs detected callback request');
        
        // If ElevenLabs detected callback but no time, try to extract time with OpenAI
        if (!finalCallbackTime || finalCallbackTime === null) {
          console.log('🔍 Step 4A: No callback time from ElevenLabs, extracting with OpenAI...');
          try {
            const timeDetection = await detectCallbackNeeded(transcript);
            if (timeDetection.requestedTime) {
              console.log(`✅ OpenAI extracted time: "${timeDetection.requestedTime}"`);
              finalCallbackTime = timeDetection.requestedTime;
              
              if (timeDetection.suggestedDateTime) {
                console.log(`📅 Parsed to datetime: ${timeDetection.suggestedDateTime.toISOString()}`);
                // Store both natural language and parsed datetime
                finalCallbackTime = timeDetection.requestedTime;
              }
            }
          } catch (error) {
            console.error('❌ OpenAI time extraction failed:', error);
          }
        }
      }

      // === STEP 4B: Parse callback time if provided ===
      let parsedCallbackTime: Date | null = null;
      if (finalCallbackTime && finalCallbackRequested) {
        console.log(`\n⏰ Step 4B: Parsing callback time: "${finalCallbackTime}"`);
        parsedCallbackTime = await parseCallbackTime(finalCallbackTime);
        
        if (parsedCallbackTime) {
          console.log(`✅ Callback scheduled for: ${parsedCallbackTime.toISOString()} (${toUTCTimeString(parsedCallbackTime)})`);
        } else {
          console.log('⚠️ Could not parse callback time, will default to +2 hours if needed');
        }
      }

      // === STEP 5: Update existing CallLog in PostgreSQL ===
      console.log('\n💾 Step 5: Updating CallLog in PostgreSQL database...');
      
      // Determine final status based on what happened in the call
      let finalStatus = 'COMPLETED';
      if (fullAnalysis?.data_collection_results) {
        const meetingStatus = fullAnalysis.data_collection_results.Meeting_Status?.value;
        const appointmentBooked = !!(
          meetingStatus === 'Booked' ||
          meetingStatus === 'Appointment Booked' ||
          meetingStatus === 'APPOINTMENT_BOOKED' ||
          leadStatus === 'Appointment Booked' ||
          finalState === 'Appointment Booked'
        );
        
        if (appointmentBooked) {
          finalStatus = 'APPOINTMENT_BOOKED';
          console.log('🎉 Appointment was booked during the call - no callback needed');
        } else if (finalCallbackRequested) {
          finalStatus = 'CALLBACK_SCHEDULED';
        }
      } else if (finalCallbackRequested) {
        finalStatus = 'CALLBACK_SCHEDULED';
      }
      
      let callLog;
      if (callLogId) {
        // Update existing call log
        callLog = await prisma.callLog.update({
          where: { id: callLogId },
          data: {
            status: finalStatus,
            summary: summary,
            callbackScheduledAt: (finalStatus === 'CALLBACK_SCHEDULED' && parsedCallbackTime) ? parsedCallbackTime : 
                               (finalStatus === 'CALLBACK_SCHEDULED' ? new Date(Date.now() + 2 * 60 * 60 * 1000) : null),
            callbackReason: finalStatus === 'CALLBACK_SCHEDULED' ? `Customer requested callback. Lead status: ${leadStatus || 'Unknown'}` : null,
          },
        });
        console.log(`✅ CallLog updated with ID: ${callLog.id} - Status: ${finalStatus}`);
      } else {
        // Fallback: Create new call log (legacy support)
        callLog = await prisma.callLog.create({
          data: {
            conversationId: conversationId,
            status: finalStatus,
            summary: summary,
            transcript: JSON.stringify(transcript),
            tenantId: tenantId,
            agentId: agentId,
            customerPhoneNumber: customerPhoneNumber,
            agentPhoneNumber: agentPhoneNumber,
            agentPhoneNumberId: agentPhoneNumberId,
            callbackRequested: finalStatus === 'CALLBACK_SCHEDULED',
            callbackScheduledAt: (finalStatus === 'CALLBACK_SCHEDULED' && parsedCallbackTime) ? parsedCallbackTime : 
                               (finalStatus === 'CALLBACK_SCHEDULED' ? new Date(Date.now() + 2 * 60 * 60 * 1000) : null),
            callbackReason: finalStatus === 'CALLBACK_SCHEDULED' ? `Customer requested callback. Lead status: ${leadStatus || 'Unknown'}` : null,
            leadStatus: leadStatus,
            finalState: finalState,
            callDuration: callDuration,
          },
        });
        console.log(`✅ CallLog created with ID: ${callLog.id} - Status: ${finalStatus}`);
      }

      // === STEP 6: Schedule callback ONLY if needed (not for appointments) ===
      if (finalStatus === 'CALLBACK_SCHEDULED' && callLog.callbackScheduledAt) {
        console.log(`\n📞 Step 6: Scheduling callback job...`);
        console.log(`🕐 Callback scheduled for: ${callLog.callbackScheduledAt.toISOString()} (${toUTCTimeString(callLog.callbackScheduledAt)})`);
        const delay = callLog.callbackScheduledAt.getTime() - Date.now();
        const delayMinutes = Math.round(delay / 60000);
        console.log(`⏱️  Callback will execute in ${delayMinutes} minutes`);
        
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
        console.log(`\n✅ No callback needed - appointment was booked or call completed successfully`);
      }

      console.log(`\n✅ Successfully processed job ${job.id}`);
      return { 
        success: true, 
        summary,
        callLogId: callLog.id,
        status: finalStatus,
        callbackScheduled: finalStatus === 'CALLBACK_SCHEDULED',
        appointmentBooked: finalStatus === 'APPOINTMENT_BOOKED'
      };

    } catch (error) {
      console.error(`\n❌ Job ${job.id} failed`, error);
      
      // Update call log status to FAILED if we have callLogId
      if (callLogId) {
        try {
          await prisma.callLog.update({
            where: { id: callLogId },
            data: {
              status: 'FAILED',
              summary: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          });
          console.log(`❌ CallLog ${callLogId} marked as FAILED`);
        } catch (updateError) {
          console.error(`❌ Failed to update CallLog status:`, updateError);
        }
      }
      
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
      customerInfo, // This comes from our API endpoint
      timeZone,
      language,
      metadata,
      agentPhone, // Agent's phone number for GHL webhook
    } = job.data;

    try {
      console.log(`\n📅 Processing meeting booking job`);
      console.log(`Meeting ID: ${meetingId}, Tenant: ${tenantId}`);
      console.log(`Customer: ${customerInfo?.name} (${customerInfo?.email})`);
      console.log(`Meeting time: ${start}, Event Type: ${eventTypeId}`);

      // Transform customerInfo to Cal.com responses format
      const responses = {
        name: customerInfo?.name || 'Unknown Customer',
        email: customerInfo?.email || 'unknown@placeholder.local',
        phone: customerInfo?.phone || '',
        notes: customerInfo?.notes || '',
        // Add any additional fields Cal.com might expect
        guests: [],
        metadata: {
          ...metadata,
          customerPhone: customerInfo?.phone,
          source: 'ai-agent-booking'
        }
      };

      console.log(`📦 Transformed responses for Cal.com:`, JSON.stringify(responses, null, 2));

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
      console.log(`✅ Cal.com API call successful (HTTP ${bookingResponse.status})`);
      console.log('📋 Full booking response:', JSON.stringify(booking, null, 2));

      // Validate response structure
      if (!booking) {
        throw new Error('Cal.com returned empty response');
      }

      // Handle Cal.com response - it might return an array or a single object
      let bookingData;
      if (Array.isArray(booking)) {
        if (booking.length === 0) {
          throw new Error('Cal.com returned empty array - no booking created');
        }
        bookingData = booking[0]; // Take the first booking
        console.log('📦 Extracted booking from array:', {
          id: bookingData.id || bookingData.uid,
          status: bookingData.status,
          hasVideoUrl: !!bookingData.videoCallUrl
        });
      } else {
        bookingData = booking;
        console.log('📦 Using single booking object:', {
          id: bookingData.id || bookingData.uid,
          status: bookingData.status,
          hasVideoUrl: !!bookingData.videoCallUrl
        });
      }

      console.log('🔍 Raw bookingData structure:', {
        hasId: !!bookingData.id,
        hasUid: !!bookingData.uid,
        status: bookingData.status,
        hasError: !!bookingData.error,
        hasMessage: !!bookingData.message,
        keys: Object.keys(bookingData || {})
      });

      // IMPROVED: Check if booking was actually successful
      // Cal.com sometimes returns errors even for successful bookings (e.g., user assignment issues)
      // We need to check if a booking ID exists first before treating it as a failure
      
      const hasBookingId = !!(bookingData.id || bookingData.uid);
      const hasErrorMessage = bookingData.error || (bookingData.message && (
        bookingData.message.includes('error') || 
        bookingData.message.includes('failed') || 
        bookingData.message.includes('invalid')
      ));
      
      // If there's a booking ID, the booking was likely successful even if there are secondary errors
      if (hasErrorMessage && !hasBookingId) {
        const errorMsg = bookingData.error || bookingData.message;
        console.error('❌ Cal.com booking failed - No booking ID and has error:', errorMsg);
        
        // Update meeting status to FAILED
        await prisma.meeting.update({
          where: { id: meetingId },
          data: {
            status: 'FAILED',
            errorMessage: errorMsg,
            updatedAt: new Date(),
          },
        });
        
        throw new Error(errorMsg);
      }
      
      // Log warning for errors but proceed if we have a booking ID
      if (hasErrorMessage && hasBookingId) {
        const errorMsg = bookingData.error || bookingData.message;
        console.warn(`⚠️ Cal.com returned error BUT booking was created (ID: ${bookingData.id || bookingData.uid}): ${errorMsg}`);
        console.warn('🔄 Proceeding with booking since Cal.com assigned a booking ID');
      }

      // Check for successful status indicators with enhanced logic
      const hasId = !!(bookingData.id || bookingData.uid);
      const hasAcceptedStatus = bookingData.status === 'ACCEPTED';
      const hasConfirmedStatus = bookingData.status === 'CONFIRMED';
      const hasVideoCallUrl = !!bookingData.videoCallUrl;
      const hasSuccessfulApps = bookingData.appsStatus && 
                               bookingData.appsStatus.some((app: any) => app.success > 0);
      
      // A booking is successful if it has an ID AND (accepted status OR video URL OR successful app integrations)
      const isSuccessful = hasId && (hasAcceptedStatus || hasConfirmedStatus || hasVideoCallUrl || hasSuccessfulApps);

      console.log('🎯 Enhanced success check:', {
        hasId,
        hasAcceptedStatus,
        hasConfirmedStatus,
        hasVideoCallUrl,
        hasSuccessfulApps,
        isSuccessful,
        actualStatus: bookingData.status,
        bookingId: bookingData.id || bookingData.uid
      });

      if (!isSuccessful) {
        const errorMsg = `Cal.com booking validation failed - Status: ${bookingData.status || 'Unknown'}, ID: ${hasId ? 'Present' : 'Missing'}, VideoURL: ${hasVideoCallUrl ? 'Present' : 'Missing'}`;
        console.error('❌', errorMsg);
        
        await prisma.meeting.update({
          where: { id: meetingId },
          data: {
            status: 'FAILED',
            errorMessage: errorMsg,
            updatedAt: new Date(),
          },
        });
        
        throw new Error(errorMsg);
      }

      console.log(`🎉 Cal.com booking validated successfully with ID: ${bookingData.id || bookingData.uid}, Status: ${bookingData.status}`);

      // Extract meeting link from Cal.com response (comprehensive search)
      let meetingLink = null;

      // Priority 1: Direct videoCallUrl (most common)
      if (bookingData.videoCallUrl) {
        meetingLink = bookingData.videoCallUrl;
        console.log('🔗 Meeting link found in videoCallUrl:', meetingLink);
      }
      // Priority 2: In references array
      else if (bookingData.references && Array.isArray(bookingData.references)) {
        for (const ref of bookingData.references) {
          if (ref.meetingUrl) {
            meetingLink = ref.meetingUrl;
            console.log('🔗 Meeting link found in references.meetingUrl:', meetingLink);
            break;
          }
          if (ref.type === 'google_meet_video' && ref.meetingUrl) {
            meetingLink = ref.meetingUrl;
            console.log('🔗 Google Meet link found in references:', meetingLink);
            break;
          }
        }
      }
      // Priority 3: Other possible locations
      else if (bookingData.meetingUrl) {
        meetingLink = bookingData.meetingUrl;
        console.log('🔗 Meeting link found in meetingUrl:', meetingLink);
      }
      else if (bookingData.metadata?.videoCallUrl) {
        meetingLink = bookingData.metadata.videoCallUrl;
        console.log('🔗 Meeting link found in metadata:', meetingLink);
      }
      else if (bookingData.location && bookingData.location.includes('http')) {
        meetingLink = bookingData.location;
        console.log('🔗 Meeting link found in location:', meetingLink);
      }
      
      console.log(`🔗 Final meeting link: ${meetingLink || 'No link found'}`);
      
      if (!meetingLink) {
        console.warn('⚠️ No meeting link extracted from Cal.com response, but booking still successful');
      }

      // Update meeting record with success and store Cal.com response
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          status: 'CONFIRMED',
          calcomEventId: (bookingData.id || bookingData.uid)?.toString(),
          calcomResponse: JSON.stringify(bookingData), // Convert to JSON string
          meetingLink: meetingLink,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Meeting ${meetingId} confirmed successfully with status CONFIRMED`);

      // === STEP 2: Send WhatsApp notification via GHL ===
      let whatsappSuccessful = false;
      if (credentials.ghlWhatsappWebhook) {
        console.log('\n📱 Attempting to send WhatsApp notification...');

        // Validate webhook URL
        const validation = validateGHLWebhookUrl(credentials.ghlWhatsappWebhook);
        
        if (validation.valid) {
          try {
            console.log(`🔍 Agent phone from job data: ${agentPhone}`);
            
            const whatsappResult = await sendWhatsAppNotification(
              credentials.ghlWhatsappWebhook,
              {
                customerName: responses.name,
                customerPhoneNumber: responses.phone || customerInfo?.phone || 'Unknown',
                meetingTime: start,
                meetingLink: meetingLink || undefined,
                duration: 30, // Default duration, can be extracted from eventType if needed
                timezone: timeZone,
                calcomEventId: (bookingData.id || bookingData.uid)?.toString(),
                notes: responses.notes,
                // Additional fields for N8N/GHL workflow format
                ownerPhone: agentPhone || responses.phone, // Use agent's phone as owner phone
                references: bookingData.references, // Pass the full references array from Cal.com
              }
            );

            if (whatsappResult.success) {
              console.log('✅ WhatsApp notification sent successfully');
              whatsappSuccessful = true;
              
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
        bookingId: (bookingData.id || bookingData.uid)?.toString(),
        meetingLink: meetingLink,
        whatsappSent: whatsappSuccessful,
        message: 'Meeting confirmed successfully'
      };

    } catch (error: any) {
      console.error(`\n❌ Meeting job ${job.id} failed:`, error);

      let errorMessage = 'Unknown error occurred';
      let shouldRetry = true; // Default to retry
      let wasBookingCreated = false;
      
      if (error.response) {
        errorMessage = error.response.data?.message || `Cal.com API error: ${error.response.status}`;
        console.error('Cal.com API response:', error.response.data);
        
        // Check if the response contains a booking ID even though it returned an error
        const responseData = error.response.data;
        if (responseData && (responseData.id || responseData.uid || 
            (Array.isArray(responseData) && responseData.length > 0 && (responseData[0].id || responseData[0].uid)))) {
          console.warn('⚠️ Cal.com returned error BUT booking appears to have been created!');
          console.warn('🔄 Will attempt to extract booking details and mark as successful...');
          
          try {
            // Extract booking data from error response
            const bookingData = Array.isArray(responseData) ? responseData[0] : responseData;
            const bookingId = bookingData.id || bookingData.uid;
            
            if (bookingId) {
              // Update meeting as successful even though Cal.com returned an error
              await prisma.meeting.update({
                where: { id: meetingId },
                data: {
                  status: 'CONFIRMED',
                  calcomEventId: bookingId.toString(),
                  calcomResponse: JSON.stringify(bookingData), // Convert to JSON string
                  updatedAt: new Date(),
                  errorMessage: `Warning: ${errorMessage} (but booking was created)`,
                },
              });
              
              console.log('✅ Booking extracted from error response and marked as CONFIRMED');
              wasBookingCreated = true;
              shouldRetry = false;
              
              return { 
                success: true, 
                meetingId,
                bookingId: bookingId.toString(),
                message: 'Booking created successfully despite API error',
                warning: errorMessage
              };
            }
          } catch (extractError) {
            console.error('❌ Failed to extract booking from error response:', extractError);
            // Continue with normal error handling
          }
        }
        
        // Check for permanent errors that should NOT be retried
        const permanentErrors = [
          'no_available_users_found_error',
          'invalid_event_type',
          'event_type_not_found',
          'user_not_found',
          'invalid_time_slot',
          'booking_already_exists',
          'duplicate_booking'
        ];
        
        if (permanentErrors.some(permError => errorMessage.includes(permError))) {
          console.warn(`⚠️ Permanent error detected: ${errorMessage} - Will not retry`);
          shouldRetry = false;
        }
      } else if (error.request) {
        errorMessage = 'Cal.com API did not respond';
        // Network errors can be retried
        shouldRetry = true;
      } else {
        errorMessage = error.message;
        // Other errors can be retried
        shouldRetry = true;
      }

      // Update meeting status to FAILED only if booking wasn't created
      if (!wasBookingCreated) {
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
      }

      // Only re-throw if we should retry, otherwise return failure result
      if (shouldRetry) {
        throw error; // Re-throw to trigger retry mechanism
      } else {
        // Return failure result without retrying
        console.log(`🚫 Job ${job.id} marked as permanently failed - no retries`);
        return { 
          success: false, 
          error: errorMessage,
          permanent: true,
          meetingId
        };
      }
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
