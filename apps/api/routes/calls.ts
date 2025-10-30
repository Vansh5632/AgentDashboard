// apps/api/routes/calls.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@ai_agent/db';
import { authenticate } from '../middleware/authenticate';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/calls - Fetch all call logs with filters
 * 
 * Query params:
 * - status: Filter by status (COMPLETED, FAILED, CALLBACK_NEEDED, etc.)
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 * - phone: Search by customer phone number
 * - limit: Number of results per page (default: 50)
 * - offset: Pagination offset (default: 0)
 * - search: Search in summary and transcript
 */
router.get('/calls', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { 
      status, 
      startDate, 
      endDate, 
      phone, 
      limit = '50', 
      offset = '0',
      search 
    } = req.query;

    // Build where clause
    const whereClause: any = { tenantId };
    
    if (status && typeof status === 'string') {
      whereClause.status = status;
    }

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    if (phone) {
      whereClause.customerPhoneNumber = {
        contains: phone as string,
      };
    }

    if (search && typeof search === 'string') {
      whereClause.OR = [
        { summary: { contains: search, mode: 'insensitive' } },
        { transcript: { contains: search, mode: 'insensitive' } },
        { callbackReason: { contains: search, mode: 'insensitive' } },
      ];
    }

    const calls = await prisma.callLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      select: {
        id: true,
        conversationId: true,
        status: true,
        summary: true,
        customerPhoneNumber: true,
        callbackRequested: true,
        callbackScheduledAt: true,
        callbackReason: true,
        leadStatus: true,
        finalState: true,
        callDuration: true,
        createdAt: true,
        agentId: true,
        agentPhoneNumber: true,
      },
    });

    const total = await prisma.callLog.count({ where: whereClause });

    // Get stats for the dashboard
    const stats = await prisma.callLog.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
    });

    const totalCalls = await prisma.callLog.count({ where: { tenantId } });
    const callbacksRequested = await prisma.callLog.count({ 
      where: { tenantId, callbackRequested: true } 
    });
    const completedCalls = await prisma.callLog.count({ 
      where: { tenantId, status: 'COMPLETED' } 
    });

    res.json({
      calls,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + parseInt(limit as string),
      },
      stats: {
        total: totalCalls,
        byStatus: stats,
        callbacksRequested,
        completedCalls,
        successRate: totalCalls > 0 ? ((completedCalls / totalCalls) * 100).toFixed(1) : '0',
      },
    });

  } catch (error: any) {
    console.error('Error fetching call logs:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * GET /api/calls/:callId - Fetch single call log with full details
 */
router.get('/calls/:callId', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { callId } = req.params;

    const call = await prisma.callLog.findFirst({
      where: {
        id: callId,
        tenantId, // Ensure tenant isolation
      },
    });

    if (!call) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    res.json({ call });

  } catch (error: any) {
    console.error('Error fetching call log:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * GET /api/calls/stats/overview - Get dashboard overview stats
 */
router.get('/calls/stats/overview', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { days = '7' } = req.query; // Default to last 7 days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    const totalCalls = await prisma.callLog.count({ 
      where: { 
        tenantId,
        createdAt: { gte: startDate }
      } 
    });

    const completedCalls = await prisma.callLog.count({ 
      where: { 
        tenantId, 
        status: 'COMPLETED',
        createdAt: { gte: startDate }
      } 
    });

    const callbacksRequested = await prisma.callLog.count({ 
      where: { 
        tenantId, 
        callbackRequested: true,
        createdAt: { gte: startDate }
      } 
    });

    const callbacksCompleted = await prisma.callLog.count({ 
      where: { 
        tenantId, 
        status: 'CALLBACK_COMPLETED',
        createdAt: { gte: startDate }
      } 
    });

    // Get average call duration
    const avgDuration = await prisma.callLog.aggregate({
      where: { 
        tenantId,
        callDuration: { not: null },
        createdAt: { gte: startDate }
      },
      _avg: {
        callDuration: true,
      },
    });

    // Get daily call volume for chart
    const dailyCalls = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM "CallLog"
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    res.json({
      overview: {
        totalCalls,
        completedCalls,
        callbacksRequested,
        callbacksCompleted,
        successRate: totalCalls > 0 ? ((completedCalls / totalCalls) * 100).toFixed(1) : '0',
        avgCallDuration: avgDuration._avg.callDuration ? Math.round(avgDuration._avg.callDuration) : 0,
      },
      dailyVolume: dailyCalls.map((row: { date: string; count: bigint }) => ({
        date: row.date,
        count: Number(row.count),
      })),
    });

  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;
