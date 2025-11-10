// apps/api/routes/time.ts
import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/time/utc - Get current time in UTC timezone
 * 
 * This endpoint is used by the ElevenLabs agent to get the current time
 * before checking availability for the next 7 days.
 */
router.get('/time/utc', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    
    // Also provide the time 7 days from now for convenience
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    res.json({
      success: true,
      currentTime: now.toISOString(),
      currentTimeFormatted: now.toISOString().replace('T', ' ').replace('Z', ' UTC'),
      nextWeekTime: nextWeek.toISOString(),
      timezone: 'UTC',
      timestamp: now.getTime()
    });

  } catch (error: any) {
    console.error('Error getting UTC time:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;