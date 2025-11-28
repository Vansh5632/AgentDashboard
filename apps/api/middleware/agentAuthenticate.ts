// apps/api/middleware/agentAuthenticate.ts
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@ai_agent/db';
import axios from 'axios';

const prisma = new PrismaClient();

// Extend Express Request type for agent authentication
declare global {
  namespace Express {
    interface Request {
      agent?: {
        id: string;
        elevenLabsAgentId: string;
        tenantId: string;
        name: string;
      };
    }
  }
}

/**
 * Verify if agent exists using shared API key
 */
async function verifyAgentExists(agentId: string): Promise<{ exists: boolean; agentData?: any }> {
  try {
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!elevenLabsApiKey) {
      console.warn('⚠️ ELEVENLABS_API_KEY not set in environment');
      return { exists: false };
    }

    console.log(`🔍 Verifying agent ${agentId} exists...`);

    const response = await axios.get(
      'https://api.elevenlabs.io/v1/convai/agents',
      {
        headers: {
          'xi-api-key': elevenLabsApiKey
        },
        timeout: 10000
      }
    );

    const agents = response.data.agents || response.data || [];
    const agentData = agents.find((agent: any) => agent.agent_id === agentId);
    
    if (agentData) {
      console.log(`✅ Agent ${agentId} found`);
      return { exists: true, agentData };
    } else {
      console.log(`❌ Agent ${agentId} not found`);
      return { exists: false };
    }
  } catch (error: any) {
    console.error('❌ Error verifying agent:', error.message);
    return { exists: false };
  }
}

/**
 * Agent Authentication Middleware
 * Authenticates agents using AgentMapping table (agent_id → tenant mapping)
 * Uses shared API key from environment for verification
 */
export async function agentAuthenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract agent_id from request body or query parameters
    const agentId = req.body.agent_id || req.query.agent_id || req.headers['x-agent-id'];
    
    if (!agentId) {
      return res.status(400).json({ 
        error: 'Missing agent_id',
        hint: 'Include agent_id in request body, query param, or X-Agent-Id header',
        example: {
          agent_id: "agent_2601k805rvfwe34vxtn6z4ds63x7"
        }
      });
    }

    console.log(`🤖 Authenticating agent: ${agentId}`);

    // STEP 1: Check AgentMapping table (primary authentication method)
    const mapping = await prisma.agentMapping.findUnique({
      where: { agentId },
      include: {
        tenant: { select: { name: true } },
        user: { select: { email: true } }
      }
    });

    if (mapping) {
      console.log(`✅ Found agent mapping: ${agentId} → tenant ${mapping.tenantId}`);
      
      // Get or create AgentBot entry
      let agentBot = await prisma.agentBot.findFirst({
        where: { 
          elevenLabsAgentId: agentId,
          tenantId: mapping.tenantId 
        }
      });

      if (!agentBot) {
        // Auto-create AgentBot if not exists
        agentBot = await prisma.agentBot.create({
          data: {
            name: mapping.agentName || `Agent ${agentId.slice(-8)}`,
            elevenLabsAgentId: agentId,
            tenantId: mapping.tenantId,
          }
        });
        console.log(`🤖 Auto-created AgentBot for mapped agent ${agentId}`);
      }

      req.agent = {
        id: agentBot.id,
        elevenLabsAgentId: agentId,
        tenantId: mapping.tenantId,
        name: agentBot.name
      };

      console.log(`✅ Agent ${agentId} authenticated via AgentMapping`);
      return next();
    }

    // STEP 2: Fallback - check if agent exists in AgentBot table (legacy support)
    console.log(`🔍 No mapping found, checking AgentBot table...`);
    
    let agentBot = await prisma.agentBot.findFirst({
      where: { elevenLabsAgentId: agentId }
    });

    if (agentBot) {
      console.log(`✅ Found agent in AgentBot table (legacy): ${agentId} → tenant ${agentBot.tenantId}`);
      
      req.agent = {
        id: agentBot.id,
        elevenLabsAgentId: agentId,
        tenantId: agentBot.tenantId,
        name: agentBot.name
      };

      console.log(`⚠️ Warning: Agent ${agentId} authenticated via legacy method. Consider creating an AgentMapping.`);
      return next();
    }

    // STEP 3: Agent not mapped - reject with helpful error
    console.log(`❌ Agent ${agentId} not mapped to any tenant`);
    
    // Optionally verify if agent exists in ElevenLabs to give better error message
    const { exists, agentData } = await verifyAgentExists(agentId);
    
    if (exists) {
      return res.status(401).json({
        error: 'Agent not mapped',
        message: `Agent ${agentId} exists but is not mapped to any tenant`,
        hint: 'An administrator needs to create an agent mapping for this agent_id',
        agentInfo: {
          agent_id: agentData.agent_id,
          name: agentData.name,
        }
      });
    } else {
      return res.status(404).json({
        error: 'Agent not found',
        message: `Agent ${agentId} not found in agent mappings`,
        hint: 'Verify the agent_id is correct and exists'
      });
    }

  } catch (error: any) {
    console.error('❌ Agent authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed', 
      details: error.message 
    });
  }
}