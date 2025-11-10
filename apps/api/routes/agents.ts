// apps/api/routes/agents.ts
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { agentAuthenticate } from '../middleware/agentAuthenticate';
import { PrismaClient } from '@ai_agent/db';
import axios from 'axios';

const router = Router();
const prisma = new PrismaClient();

/**
 * Fetch all agents from ElevenLabs account
 */
async function fetchElevenLabsAgents(apiKey: string): Promise<any[]> {
  try {
    console.log('🤖 Fetching agents from ElevenLabs...');

    const response = await axios.get(
      'https://api.elevenlabs.io/v1/convai/agents',
      {
        headers: {
          'xi-api-key': apiKey
        },
        timeout: 30000
      }
    );

    const agents = response.data.agents || response.data || [];
    console.log(`✅ Found ${agents.length} agents in ElevenLabs account`);
    
    return agents;

  } catch (error: any) {
    console.error('❌ Failed to fetch ElevenLabs agents:', error);
    throw error;
  }
}

/**
 * GET /api/agents/sync-from-elevenlabs
 * Auto-discover and sync agents from ElevenLabs account
 */
router.get('/agents/sync-from-elevenlabs', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    // Get tenant's ElevenLabs API key
    const credential = await prisma.credential.findFirst({
      where: { 
        serviceName: 'ELEVENLABS',
        user: { tenantId }
      }
    });

    if (!credential) {
      return res.status(404).json({ 
        error: 'ElevenLabs API key not configured',
        hint: 'Add your ElevenLabs API key first via credentials management'
      });
    }

    console.log(`🔍 Syncing agents for tenant ${tenantId}...`);

    // Fetch agents from ElevenLabs
    const elevenLabsAgents = await fetchElevenLabsAgents(credential.encryptedValue);

    // Sync with database
    const syncResults = [];
    for (const agent of elevenLabsAgents) {
      // Check if agent already exists
      let existingAgent = await prisma.agentBot.findFirst({
        where: { 
          elevenLabsAgentId: agent.agent_id,
          tenantId 
        }
      });

      if (existingAgent) {
        // Update existing agent
        existingAgent = await prisma.agentBot.update({
          where: { id: existingAgent.id },
          data: {
            name: agent.name,
            elevenLabsVoiceId: agent.voice_id,
            persona: agent.prompt,
          }
        });
        syncResults.push({ action: 'UPDATED', agent: existingAgent });
      } else {
        // Create new agent
        const newAgent = await prisma.agentBot.create({
          data: {
            name: agent.name,
            elevenLabsAgentId: agent.agent_id,
            elevenLabsVoiceId: agent.voice_id,
            persona: agent.prompt,
            tenantId,
          }
        });
        syncResults.push({ action: 'CREATED', agent: newAgent });
      }
    }

    console.log(`✅ Synced ${syncResults.length} agents for tenant ${tenantId}`);

    res.json({
      message: `Successfully synced ${syncResults.length} agents`,
      results: syncResults,
      totalAgentsInElevenLabs: elevenLabsAgents.length
    });

  } catch (error: any) {
    console.error('Error syncing agents:', error);
    res.status(500).json({ 
      error: 'Failed to sync agents from ElevenLabs',
      details: error.message
    });
  }
});

/**
 * GET /api/agents/elevenlabs-agents
 * List all agents in ElevenLabs account (without syncing to database)
 */
router.get('/agents/elevenlabs-agents', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    // Get tenant's ElevenLabs API key
    const credential = await prisma.credential.findFirst({
      where: { 
        serviceName: 'ELEVENLABS',
        user: { tenantId }
      }
    });

    if (!credential) {
      return res.status(404).json({ 
        error: 'ElevenLabs API key not configured' 
      });
    }

    // Fetch agents from ElevenLabs
    const agents = await fetchElevenLabsAgents(credential.encryptedValue);

    // Check which ones exist in our database
    const agentsWithDbStatus = await Promise.all(
      agents.map(async (agent) => {
        const dbAgent = await prisma.agentBot.findFirst({
          where: { 
            elevenLabsAgentId: agent.agent_id,
            tenantId 
          }
        });

        return {
          ...agent,
          inDatabase: !!dbAgent,
          dbId: dbAgent?.id || null
        };
      })
    );

    res.json({
      agents: agentsWithDbStatus,
      total: agents.length,
      inDatabase: agentsWithDbStatus.filter(a => a.inDatabase).length
    });

  } catch (error: any) {
    console.error('Error fetching ElevenLabs agents:', error);
    res.status(500).json({ 
      error: 'Failed to fetch agents from ElevenLabs',
      details: error.message
    });
  }
});

/**
 * POST /api/agents/test-auth
 * Test agent authentication - useful for debugging
 */
router.post('/agents/test-auth', agentAuthenticate, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'Agent authentication successful!',
      agent: {
        id: req.agent!.id,
        elevenLabsAgentId: req.agent!.elevenLabsAgentId,
        tenantId: req.agent!.tenantId,
        name: req.agent!.name
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Test failed', details: error.message });
  }
});

export default router;