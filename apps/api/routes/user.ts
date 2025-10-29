// apps/api/routes/user.ts
import express, { Request, Response, Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { PrismaClient } from '@ai_agent/db';

const prisma = new PrismaClient();
const router: Router = express.Router();

router.get('/me', authenticate, async (req: Request, res: Response) => {
  // Thanks to our type declaration, TypeScript knows `req.user` exists!
  const userId = req.user?.userId;

  if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
  }

  try {
    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, tenantId: true },
    });
    res.json(userProfile);
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

export default router;