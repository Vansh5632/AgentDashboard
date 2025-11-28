// apps/api/routes/agentMappings.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@ai_agent/db';
import { authenticate } from '../middleware/authenticate';
import axios from 'axios';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/agent-mappings
 * List all agent mappings for the authenticated user's tenant
 */
router.get('/agent-mappings', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const mappings = await prisma.agentMapping.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      mappings,
      total: mappings.length,
    });
  } catch (error: any) {
    console.error('Error fetching agent mappings:', error);
    res.status(500).json({ error: 'Failed to fetch agent mappings', details: error.message });
  }
});

/**
 * POST /api/agent-mappings
 * Create a new agent mapping
 * 
 * Body:
 * {
 *   "agentId": "agent_2601k805rvfwe34vxtn6z4ds63x7",
 *   "agentName": "Sales Agent",
 *   "notes": "Handles enterprise sales calls"
 * }
 */
router.post('/agent-mappings', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { agentId, agentName, notes } = req.body;

    // Validation
    if (!agentId) {
      return res.status(400).json({
        error: 'Missing required field: agentId',
        hint: 'Provide the agent_id (e.g., "agent_2601k805...")',
      });
    }

    // Check if agent_id is already mapped
    const existingMapping = await prisma.agentMapping.findUnique({
      where: { agentId },
    });

    if (existingMapping) {
      return res.status(409).json({
        error: 'Agent ID already mapped',
        message: `This agent_id is already mapped to ${existingMapping.tenantId === tenantId ? 'your account' : 'another account'}`,
        existingMapping: {
          agentId: existingMapping.agentId,
          agentName: existingMapping.agentName,
          createdAt: existingMapping.createdAt,
        },
      });
    }

    // Create the mapping
    const mapping = await prisma.agentMapping.create({
      data: {
        agentId,
        agentName: agentName || null,
        notes: notes || null,
        tenantId,
        userId,
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    console.log(`✅ Created agent mapping: ${agentId} → tenant ${tenantId}`);

    // Also create/update the AgentBot entry if it doesn't exist
    const existingBot = await prisma.agentBot.findFirst({
      where: { elevenLabsAgentId: agentId },
    });

    if (!existingBot) {
      await prisma.agentBot.create({
        data: {
          name: agentName || `Agent ${agentId.slice(-8)}`,
          elevenLabsAgentId: agentId,
          tenantId,
        },
      });
      console.log(`✅ Auto-created AgentBot for ${agentId}`);
    }

    res.status(201).json({
      message: 'Agent mapping created successfully',
      mapping,
    });
  } catch (error: any) {
    console.error('Error creating agent mapping:', error);
    res.status(500).json({ error: 'Failed to create agent mapping', details: error.message });
  }
});

/**
 * PUT /api/agent-mappings/:agentId
 * Update an existing agent mapping
 * 
 * Body:
 * {
 *   "agentName": "Updated Name",
 *   "notes": "Updated notes"
 * }
 */
router.put('/agent-mappings/:agentId', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { agentId } = req.params;
    const { agentName, notes } = req.body;

    // Check if mapping exists and belongs to this tenant
    const existingMapping = await prisma.agentMapping.findUnique({
      where: { agentId },
    });

    if (!existingMapping) {
      return res.status(404).json({ error: 'Agent mapping not found' });
    }

    if (existingMapping.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Not authorized to update this agent mapping' });
    }

    // Update the mapping
    const mapping = await prisma.agentMapping.update({
      where: { agentId },
      data: {
        ...(agentName !== undefined && { agentName }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    // Also update the AgentBot name if agentName is provided
    if (agentName) {
      await prisma.agentBot.updateMany({
        where: { 
          elevenLabsAgentId: agentId,
          tenantId,
        },
        data: { name: agentName },
      });
    }

    res.json({
      message: 'Agent mapping updated successfully',
      mapping,
    });
  } catch (error: any) {
    console.error('Error updating agent mapping:', error);
    res.status(500).json({ error: 'Failed to update agent mapping', details: error.message });
  }
});

/**
 * DELETE /api/agent-mappings/:agentId
 * Delete an agent mapping
 */
router.delete('/agent-mappings/:agentId', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { agentId } = req.params;

    // Check if mapping exists and belongs to this tenant
    const existingMapping = await prisma.agentMapping.findUnique({
      where: { agentId },
    });

    if (!existingMapping) {
      return res.status(404).json({ error: 'Agent mapping not found' });
    }

    if (existingMapping.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Not authorized to delete this agent mapping' });
    }

    // Delete the mapping
    await prisma.agentMapping.delete({
      where: { agentId },
    });

    console.log(`✅ Deleted agent mapping: ${agentId}`);

    res.json({ message: 'Agent mapping deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting agent mapping:', error);
    res.status(500).json({ error: 'Failed to delete agent mapping', details: error.message });
  }
});

/**
 * GET /api/agent-mappings/available-agents
 * Fetch all agents (using shared API key) and show which are mapped
 */
router.get('/agent-mappings/available-agents', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    
    // Get API key from environment
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!elevenLabsApiKey) {
      return res.status(503).json({
        error: 'API key not configured',
        hint: 'Set ELEVENLABS_API_KEY in environment variables',
      });
    }

    // Fetch all agents
    console.log('🔍 Fetching agents...');
    const response = await axios.get(
      'https://api.elevenlabs.io/v1/convai/agents',
      {
        headers: {
          'xi-api-key': elevenLabsApiKey,
        },
        timeout: 10000,
      }
    );

    const agents = response.data.agents || response.data || [];
    console.log(`✅ Found ${agents.length} agents`);

    // Get all existing mappings
    const allMappings = await prisma.agentMapping.findMany({
      select: {
        agentId: true,
        agentName: true,
        tenantId: true,
      },
    });

    const mappedAgentIds = new Set(allMappings.map(m => m.agentId));
    const tenantMappedIds = new Set(
      allMappings.filter(m => m.tenantId === tenantId).map(m => m.agentId)
    );

    // Enhance agents with mapping status
    const enhancedAgents = agents.map((agent: any) => ({
      agent_id: agent.agent_id,
      name: agent.name,
      voice_id: agent.voice_id,
      prompt: agent.prompt,
      isMapped: mappedAgentIds.has(agent.agent_id),
      isMappedToCurrentTenant: tenantMappedIds.has(agent.agent_id),
      isMappedToOtherTenant: mappedAgentIds.has(agent.agent_id) && !tenantMappedIds.has(agent.agent_id),
    }));

    res.json({
      agents: enhancedAgents,
      total: enhancedAgents.length,
      available: enhancedAgents.filter((a: any) => !a.isMapped).length,
      mappedToYou: enhancedAgents.filter((a: any) => a.isMappedToCurrentTenant).length,
      mappedToOthers: enhancedAgents.filter((a: any) => a.isMappedToOtherTenant).length,
    });
  } catch (error: any) {
    console.error('Error fetching available agents:', error);
    
    if (error.response) {
      return res.status(502).json({
        error: 'Failed to fetch agents',
        details: error.response.data?.message || 'Unknown error',
        status: error.response.status,
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch available agents', details: error.message });
  }
});

export default router;
