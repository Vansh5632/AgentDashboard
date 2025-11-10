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
 * Verify if agent belongs to a specific ElevenLabs account
 */
async function verifyAgentOwnership(
  agentId: string, 
  apiKey: string
): Promise<boolean> {
  try {
    console.log(`🔍 Verifying agent ${agentId} ownership...`);

    const response = await axios.get(
      'https://api.elevenlabs.io/v1/convai/agents',
      {
        headers: {
          'xi-api-key': apiKey
        },
        timeout: 10000
      }
    );

    const agents = response.data.agents || response.data || [];
    const agentExists = agents.some((agent: any) => agent.agent_id === agentId);
    
    if (agentExists) {
      console.log(`✅ Agent ${agentId} verified for account`);
      return true;
    } else {
      console.log(`❌ Agent ${agentId} not found in account`);
      return false;
    }
  } catch (error: any) {
    console.error('❌ Error verifying agent ownership:', error.message);
    return false;
  }
}

/**
 * Agent Authentication Middleware
 * Authenticates ElevenLabs agents by verifying they belong to a tenant's ElevenLabs account
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

    // First, check if agent exists in our database
    let agentBot = await prisma.agentBot.findFirst({
      where: { elevenLabsAgentId: agentId }
    });

    if (agentBot) {
      // Agent exists in database - verify it still belongs to the tenant
      const credential = await prisma.credential.findFirst({
        where: { 
          serviceName: 'ELEVENLABS',
          user: { tenantId: agentBot.tenantId }
        }
      });

      if (credential) {
        const isValid = await verifyAgentOwnership(agentId, credential.encryptedValue);
        if (isValid) {
          req.agent = {
            id: agentBot.id,
            elevenLabsAgentId: agentBot.elevenLabsAgentId || agentId,
            tenantId: agentBot.tenantId,
            name: agentBot.name
          };
          console.log(`✅ Agent ${agentId} authenticated for tenant ${agentBot.tenantId}`);
          return next();
        }
      }
    }

    // Agent not in database or verification failed - check all ElevenLabs accounts
    console.log(`🔍 Agent not found in database, checking all ElevenLabs accounts...`);
    
    const credentials = await prisma.credential.findMany({
      where: { serviceName: 'ELEVENLABS' },
      include: { user: { include: { tenant: true } } }
    });

    if (credentials.length === 0) {
      return res.status(404).json({
        error: 'No ElevenLabs credentials configured',
        hint: 'Configure ElevenLabs API key first: POST /api/credentials/elevenlabs'
      });
    }

    // Try to find which tenant owns this agent
    for (const credential of credentials) {
      try {
        const isValid = await verifyAgentOwnership(agentId, credential.encryptedValue);
        
        if (isValid) {
          const tenantId = credential.user.tenantId;
          console.log(`✅ Agent ${agentId} verified for tenant ${tenantId}`);
          
          // Get agent details from ElevenLabs
          const response = await axios.get(
            'https://api.elevenlabs.io/v1/convai/agents',
            {
              headers: { 'xi-api-key': credential.encryptedValue }
            }
          );
          
          const agents = response.data.agents || response.data || [];
          const agentData = agents.find((a: any) => a.agent_id === agentId);

          // Create or update agent in database
          if (!agentBot) {
            console.log(`🤖 Auto-creating agent bot for ${agentId}...`);
            agentBot = await prisma.agentBot.create({
              data: {
                name: agentData?.name || `Agent ${agentId.slice(-8)}`,
                elevenLabsAgentId: agentId,
                elevenLabsVoiceId: agentData?.voice_id,
                persona: agentData?.prompt,
                tenantId: tenantId,
              }
            });
          }

          // Set agent info for the request
          req.agent = {
            id: agentBot.id,
            elevenLabsAgentId: agentBot.elevenLabsAgentId || agentId,
            tenantId: agentBot.tenantId,
            name: agentBot.name
          };

          console.log(`✅ Agent ${agentId} authenticated for tenant ${tenantId}`);
          return next();
        }
      } catch (error: any) {
        console.log(`❌ Failed to verify agent for tenant ${credential.user.tenantId}:`, error.message);
        continue;
      }
    }

    // Agent not found in any account
    return res.status(401).json({
      error: 'Agent not authorized',
      message: `Agent ${agentId} not found in any configured ElevenLabs account`,
      hint: 'Ensure the agent exists in your ElevenLabs account and credentials are configured'
    });

  } catch (error: any) {
    console.error('❌ Agent authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed', 
      details: error.message 
    });
  }
}