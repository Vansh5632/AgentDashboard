// apps/api/routes/meetings.ts
import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { PrismaClient } from '@ai_agent/db';
import axios from 'axios';
import { authenticate } from '../middleware/authenticate';
import { agentAuthenticate } from '../middleware/agentAuthenticate';

const router = Router();
const prisma = new PrismaClient();

// Helper function to generate placeholder email for backward compatibility
function generatePlaceholderEmail(name?: string, phone?: string): string {
  const cleanPhone = phone?.replace(/[^0-9]/g, '') || 'unknown';
  const cleanName = name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'customer';
  return `${cleanName}.${cleanPhone}@placeholder.ai-agent.local`;
}

// Redis connection for job queue
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

// Create queue for meeting processing
const meetingQueue = new Queue('meeting-processing', { connection: redisConnection });

// Cal.com API base URL
const CALCOM_API_BASE = process.env.CALCOM_API_BASE_URL || 'https://api.cal.com/v1';

/**
 * AGENT-AUTHENTICATED ENDPOINT: Check availability 
 * 
 * This endpoint uses agent authentication - no customer login required!
 * The ElevenLabs agent provides agent_id and system verifies ownership.
 * 
 * POST /api/meetings/agent/check-availability
 * 
 * Body:
 * {
 *   "agent_id": "agent_2601k805rvfwe34vxtn6z4ds63x7",
 *   "eventTypeId": 123456,
 *   "startTime": "2025-10-25T00:00:00Z",
 *   "endTime": "2025-10-31T23:59:59Z",
 *   "timeZone": "UTC"
 * }
 */
router.post('/agent/check-availability', agentAuthenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.agent!.tenantId;
    const agentId = req.agent!.elevenLabsAgentId;
    const { eventTypeId, startTime, endTime, timeZone = 'Asia/Singapore' } = req.body;

    // Validation
    if (!eventTypeId || !startTime || !endTime) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['eventTypeId', 'startTime', 'endTime'],
        example: {
          agent_id: "agent_2601k805rvfwe34vxtn6z4ds63x7",
          eventTypeId: 123456,
          startTime: '2025-11-25T00:00:00Z',
          endTime: '2025-11-30T23:59:59Z',
          timeZone: 'UTC'
        }
      });
    }

    console.log(`🔍 Agent ${agentId} checking availability for tenant ${tenantId}`);
    console.log(`Event Type: ${eventTypeId}, Time range: ${startTime} to ${endTime}`);

    // Get tenant's Cal.com API key
    const credentials = await prisma.meetingCredential.findUnique({
      where: { tenantId },
    });

    if (!credentials || !credentials.calcomApiKey) {
      return res.status(404).json({ 
        error: 'Cal.com API key not configured for this account',
        hint: 'The account administrator needs to configure Cal.com integration'
      });
    }

    try {
      // Direct Cal.com API call to get availability
      // Cal.com v1 API uses apiKey as query parameter
      const response = await axios.get(
        `${CALCOM_API_BASE}/slots`,
        {
          params: {
            apiKey: credentials.calcomApiKey,
            eventTypeId,
            startTime,
            endTime,
            timeZone,
          },
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      console.log('✅ Cal.com availability check successful');
      
      // Cal.com returns slots grouped by date
      const slots = response.data.slots || {};
      
      // Flatten slots into a simple array
      const availableSlots: string[] = [];
      Object.keys(slots).forEach(date => {
        if (Array.isArray(slots[date])) {
          availableSlots.push(...slots[date].map((slot: any) => slot.time));
        }
      });
      
      return res.json({
        success: true,
        availableSlots,
        count: availableSlots.length,
        timeZone,
        eventTypeId,
        rawSlots: slots, // Include raw response for debugging
      });

    } catch (error: any) {
      console.error('❌ Error calling Cal.com API:', error);
      
      if (error.response) {
        return res.status(502).json({
          error: 'Cal.com API returned an error',
          details: error.response.data?.message || 'Unknown error',
          status: error.response.status,
          hint: 'Check if your Cal.com API key is valid and has proper permissions'
        });
      } else if (error.request) {
        return res.status(503).json({
          error: 'Cal.com API did not respond',
          details: 'Check your internet connection and Cal.com API status'
        });
      } else {
        return res.status(500).json({
          error: 'Failed to check availability',
          details: error.message,
        });
      }
    }

  } catch (error: any) {
    console.error('Error in check-availability endpoint:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * AGENT-AUTHENTICATED ENDPOINT: Confirm booking (queued for worker)
 * 
 * This endpoint accepts booking requests from ElevenLabs agents and processes them asynchronously.
 * No customer authentication required - agent ownership is verified instead.
 * 
 * POST /api/meetings/agent/confirm-booking
 * 
 * Body:
 * {
 *   "agent_id": "agent_2601k805rvfwe34vxtn6z4ds63x7",
 *   "eventTypeId": 123456,
 *   "start": "2025-10-25T14:00:00Z",
 *   "customerInfo": {
 *     "name": "John Doe",
 *     "email": "john@example.com",
 *     "phone": "+65 9123 4567",
 *     "notes": "Interested in enterprise plan"
 *   },
 *   "timeZone": "UTC",
 *   "language": "en",
 *   "metadata": {
 *     "conversationId": "conv_123",
 *     "source": "elevenlabs_agent"
 *   }
 * }
 */
router.post('/agent/confirm-booking', agentAuthenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.agent!.tenantId;
    const agentId = req.agent!.elevenLabsAgentId;
    const agentName = req.agent!.name;
    
    console.log(`📥 Raw request body:`, JSON.stringify(req.body, null, 2));
    
    // Handle both old and new request formats
    let eventTypeId, start, customerInfo, timeZone, language, metadata;
    
    // Check if it's the old format (direct fields) or new format (customerInfo object)
    if (req.body.user_name || req.body.user_phone) {
      // Old format - transform it
      console.log('📦 Converting from agent format to standard format...');
      
      eventTypeId = parseInt(req.body.eventTypeId) || req.body.eventTypeId;
      start = req.body.start;
      timeZone = req.body.timeZone || 'Asia/Singapore';
      language = req.body.language || 'en';
      metadata = req.body.metadata || { source: 'elevenlabs_agent' };
      
      // Transform agent format to customerInfo format
      customerInfo = {
        name: req.body.user_name,
        email: req.body.user_email || generatePlaceholderEmail(req.body.user_name, req.body.user_phone),
        phone: req.body.user_phone,
        notes: req.body.notes || req.body.user_notes || 'Meeting booked via AI agent'
      };
      
      console.log(`🔄 Transformed customerInfo:`, customerInfo);
    } else {
      // New format - use as is
      ({
        eventTypeId,
        start,
        customerInfo,
        timeZone = 'UTC',
        language = 'en',
        metadata = {},
      } = req.body);
    }

    // Ensure eventTypeId is a number
    if (typeof eventTypeId === 'string') {
      eventTypeId = parseInt(eventTypeId);
    }

    // Enhanced validation
    if (!eventTypeId || !start) {
      return res.status(400).json({
        error: 'Missing required fields: eventTypeId and start are required',
        received: {
          eventTypeId: req.body.eventTypeId,
          start: req.body.start,
        },
        formats: {
          current_agent_format: {
            agent_id: "agent_2601k805rvfwe34vxtn6z4ds63x7",
            eventTypeId: "3492202",
            start: "2025-11-10T11:30:00.000+08:00",
            user_name: "Wansh",
            user_phone: "+919050138050",
            user_email: "wansh@example.com", // optional, will be generated if missing
            timeZone: "UTC"
          },
          standard_format: {
            agent_id: "agent_2601k805rvfwe34vxtn6z4ds63x7",
            eventTypeId: 123456,
            start: '2025-11-25T14:00:00Z',
            customerInfo: {
              name: 'John Doe',
              email: 'john@example.com',
              phone: '+65 9123 4567',
              notes: 'Interested in product demo'
            },
            timeZone: 'UTC'
          }
        }
      });
    }

    // Validate customerInfo
    if (!customerInfo?.name) {
      return res.status(400).json({
        error: 'Missing customer name',
        hint: 'Provide either user_name (agent format) or customerInfo.name (standard format)'
      });
    }

    // Generate email if missing (for backward compatibility)
    if (!customerInfo.email) {
      customerInfo.email = generatePlaceholderEmail(customerInfo.name, customerInfo.phone);
      console.log(`📧 Generated placeholder email: ${customerInfo.email}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerInfo.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    console.log(`📅 Agent ${agentName} (${agentId}) booking meeting for tenant ${tenantId}`);
    console.log(`Customer: ${customerInfo.name} (${customerInfo.email})`);
    console.log(`Meeting time: ${start} (${timeZone})`);

    // Get tenant's Cal.com API key to validate it exists
    const credentials = await prisma.meetingCredential.findUnique({
      where: { tenantId },
    });

    if (!credentials || !credentials.calcomApiKey) {
      return res.status(404).json({
        error: 'Cal.com API key not configured for this account',
        hint: 'The account administrator needs to configure Cal.com integration'
      });
    }

    // Check for existing pending meetings to prevent duplicates
    if (metadata.conversationId) {
      const existingMeeting = await prisma.meeting.findFirst({
        where: {
          tenantId,
          conversationId: metadata.conversationId,
          status: {
            in: ['PENDING', 'CONFIRMED']
          }
        }
      });

      if (existingMeeting) {
        console.log(`⚠️ Meeting already exists for conversation ${metadata.conversationId}: ${existingMeeting.id}`);
        return res.status(409).json({
          error: 'Meeting already scheduled for this conversation',
          meetingId: existingMeeting.id,
          status: existingMeeting.status
        });
      }
    }

    // Create a meeting record in the database with PENDING status
    const meeting = await prisma.meeting.create({
      data: {
        tenantId,
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        customerPhoneNumber: customerInfo.phone || null,
        meetingTime: new Date(start),
        duration: 30, // Default, can be made dynamic based on eventType
        timezone: timeZone,
        status: 'PENDING',
        notes: customerInfo.notes || null,
        conversationId: metadata.conversationId || null,
        agentId: req.agent!.id, // Use authenticated agent's database ID
      },
    });

    console.log(`✅ Meeting record created with ID: ${meeting.id}`);

    // Get the full agent data including phone number
    const agentBot = await prisma.agentBot.findFirst({
      where: { id: req.agent!.id }
    });

    // Add job to the queue for background processing with Cal.com API
    const job = await meetingQueue.add('confirm-booking', {
      meetingId: meeting.id,
      tenantId,
      eventTypeId,
      start,
      customerInfo, // Use customerInfo instead of responses
      timeZone,
      language,
      metadata,
      agentPhone: agentBot?.phoneNumber, // Add agent phone number for GHL webhook
    }, {
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: 'exponential',
        delay: 5000, // Start with 5 second delay
      },
      removeOnComplete: 10, // Keep only last 10 completed jobs
      removeOnFail: 20, // Keep last 20 failed jobs for debugging
      // Add job settings to prevent infinite retries
      jobId: `meeting-booking-${meeting.id}`, // Unique job ID to prevent duplicates
    });

    console.log(`✅ Booking job queued with ID: ${job.id}`);

    // Return immediately with the job ID
    res.status(202).json({
      success: true,
      message: `Perfect! I'm booking your meeting for ${customerInfo.name} on ${start}`,
      meetingId: meeting.id,
      jobId: job.id,
      status: 'PENDING',
      customerName: customerInfo.name,
      customerEmail: customerInfo.email,
      bookedBy: `Agent ${agentName}`,
      estimatedCompletionTime: '30-60 seconds',
    });

  } catch (error: any) {
    console.error('Error in agent confirm-booking endpoint:', error);
    res.status(500).json({ error: 'Failed to book meeting', details: error.message });
  }
});

/**
 * AGENT-AUTHENTICATED: Get meeting status
 * 
 * GET /api/meetings/agent/{meetingId}?agent_id=agent_xxx
 */
router.get('/agent/:meetingId', agentAuthenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.agent!.tenantId;
    const { meetingId } = req.params;

    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        tenantId, // Ensure tenant isolation
      },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({
      meeting: {
        id: meeting.id,
        customerName: meeting.customerName,
        customerEmail: meeting.customerEmail,
        customerPhoneNumber: meeting.customerPhoneNumber,
        meetingTime: meeting.meetingTime,
        duration: meeting.duration,
        timezone: meeting.timezone,
        status: meeting.status,
        calcomEventId: meeting.calcomEventId,
        notes: meeting.notes,
        errorMessage: meeting.errorMessage,
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt,
      },
    });

  } catch (error: any) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * GET endpoint to check booking status
 * 
 * GET /api/meetings/:meetingId
 */
router.get('/meetings/:meetingId', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { meetingId } = req.params;

    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        tenantId, // Ensure tenant isolation
      },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({
      meeting: {
        id: meeting.id,
        customerName: meeting.customerName,
        customerEmail: meeting.customerEmail,
        customerPhoneNumber: meeting.customerPhoneNumber,
        meetingTime: meeting.meetingTime,
        duration: meeting.duration,
        timezone: meeting.timezone,
        status: meeting.status,
        calcomEventId: meeting.calcomEventId,
        notes: meeting.notes,
        errorMessage: meeting.errorMessage,
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt,
      },
    });

  } catch (error: any) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * GET endpoint to list all meetings for a tenant
 * 
 * GET /api/meetings?status=CONFIRMED&limit=10
 */
router.get('/meetings', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { status, limit = '50', offset = '0' } = req.query;

    const whereClause: any = { tenantId };
    
    if (status && typeof status === 'string') {
      whereClause.status = status;
    }

    const meetings = await prisma.meeting.findMany({
      where: whereClause,
      orderBy: { meetingTime: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.meeting.count({ where: whereClause });

    res.json({
      meetings,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

  } catch (error: any) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;
