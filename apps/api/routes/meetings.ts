// apps/api/routes/meetings.ts
import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import { PrismaClient } from '@ai_agent/db';
import axios from 'axios';
import { authenticate } from '../middleware/authenticate';

const router = Router();
const prisma = new PrismaClient();

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
 * SYNCHRONOUS ENDPOINT: Check availability (DIRECT CAL.COM API)
 * 
 * This endpoint directly calls Cal.com API and returns available slots immediately.
 * No n8n middleware needed!
 * 
 * POST /api/meetings/check-availability
 * 
 * Body:
 * {
 *   "eventTypeId": 123456,
 *   "startTime": "2025-10-25T00:00:00Z",
 *   "endTime": "2025-10-31T23:59:59Z",
 *   "timeZone": "America/New_York"
 * }
 */
router.post('/meetings/check-availability', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { eventTypeId, startTime, endTime, timeZone = 'UTC' } = req.body;

    // Validation
    if (!eventTypeId || !startTime || !endTime) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['eventTypeId', 'startTime', 'endTime'],
        example: {
          eventTypeId: 123456,
          startTime: '2025-10-25T00:00:00Z',
          endTime: '2025-10-31T23:59:59Z',
          timeZone: 'America/New_York'
        }
      });
    }

    // Get tenant's Cal.com API key
    const credentials = await prisma.meetingCredential.findUnique({
      where: { tenantId },
    });

    if (!credentials || !credentials.calcomApiKey) {
      return res.status(404).json({ 
        error: 'Cal.com API key not configured',
        setupEndpoint: 'POST /api/credentials/calcom',
        hint: 'You only need the calcomApiKey field - n8n webhooks are no longer required'
      });
    }

    console.log(`🔍 Checking availability for tenant: ${tenantId}`);
    console.log(`Event Type: ${eventTypeId}, Time range: ${startTime} to ${endTime}`);

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
 * ASYNCHRONOUS ENDPOINT: Confirm booking (queued for worker)
 * 
 * This endpoint accepts the booking request and immediately returns a job ID.
 * The actual Cal.com booking happens in the background via the worker.
 * The AI agent can confidently tell the user "I'm booking that for you."
 * 
 * POST /api/meetings/confirm-booking
 * 
 * Body:
 * {
 *   "eventTypeId": 123456,
 *   "start": "2025-10-25T14:00:00Z",
 *   "responses": {
 *     "name": "John Doe",
 *     "email": "john@example.com",
 *     "phone": "+1234567890",
 *     "notes": "Interested in enterprise plan"
 *   },
 *   "timeZone": "America/New_York",
 *   "language": "en",
 *   "metadata": {
 *     "conversationId": "conv_123",
 *     "agentId": "agent_456"
 *   }
 * }
 */
router.post('/meetings/confirm-booking', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const {
      eventTypeId,
      start,
      responses,
      timeZone = 'UTC',
      language = 'en',
      metadata = {},
    } = req.body;

    // Validation
    if (!eventTypeId || !start || !responses?.name || !responses?.email) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['eventTypeId', 'start', 'responses.name', 'responses.email'],
        example: {
          eventTypeId: 123456,
          start: '2025-10-25T14:00:00Z',
          responses: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
            notes: 'Interested in product'
          },
          timeZone: 'America/New_York',
          language: 'en',
          metadata: {
            conversationId: 'conv_123',
            agentId: 'agent_456'
          }
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(responses.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Get tenant's Cal.com API key to validate it exists
    const credentials = await prisma.meetingCredential.findUnique({
      where: { tenantId },
    });

    if (!credentials || !credentials.calcomApiKey) {
      return res.status(404).json({
        error: 'Cal.com API key not configured',
        setupEndpoint: 'POST /api/credentials/calcom',
        hint: 'You only need the calcomApiKey field - n8n webhooks are no longer required'
      });
    }

    console.log(`📅 Creating booking request for tenant: ${tenantId}`);
    console.log(`Customer: ${responses.name} (${responses.email})`);
    console.log(`Meeting time: ${start}`);

    // Create a meeting record in the database with PENDING status
    const meeting = await prisma.meeting.create({
      data: {
        tenantId,
        customerName: responses.name,
        customerEmail: responses.email,
        customerPhoneNumber: responses.phone || null,
        meetingTime: new Date(start),
        duration: 30, // Default, can be made dynamic based on eventType
        timezone: timeZone,
        status: 'PENDING',
        notes: responses.notes || null,
        conversationId: metadata.conversationId || null,
        agentId: metadata.agentId || null,
      },
    });

    console.log(`✅ Meeting record created with ID: ${meeting.id}`);

    // Add job to the queue for background processing with Cal.com API
    const job = await meetingQueue.add('confirm-booking', {
      meetingId: meeting.id,
      tenantId,
      eventTypeId,
      start,
      responses,
      timeZone,
      language,
      metadata,
    }, {
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: 'exponential',
        delay: 5000, // Start with 5 second delay
      },
      removeOnComplete: false, // Keep completed jobs for reference
      removeOnFail: false, // Keep failed jobs for debugging
    });

    console.log(`✅ Booking job queued with ID: ${job.id}`);

    // Return immediately with the job ID
    res.status(202).json({
      success: true,
      message: 'Booking request accepted and queued for processing',
      meetingId: meeting.id,
      jobId: job.id,
      status: 'PENDING',
      estimatedCompletionTime: '30-60 seconds',
    });

  } catch (error: any) {
    console.error('Error in confirm-booking endpoint:', error);
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
