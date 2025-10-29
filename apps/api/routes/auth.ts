// apps/api/routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@ai_agent/db';
import { authenticate } from '../middleware/authenticate';

const prisma = new PrismaClient();
const router = express.Router();

// === SIGNUP ROUTE ===
router.post('/auth/signup', async (req, res) => {
    const { 
        email, 
        password, 
        tenantName,
        // Optional: ElevenLabs configuration during signup
        elevenLabsApiKey,
        agents // Array of agent configurations
    } = req.body;

    if (!email || !password || !tenantName) {
        return res.status(400).json({ error: 'Missing required fields: email, password, tenantName' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
        const result = await prisma.$transaction(async (tx: any) => {
            // Create tenant
            const tenant = await tx.tenant.create({ data: { name: tenantName } });
            
            // Create user
            const user = await tx.user.create({
                data: { email, passwordHash, tenantId: tenant.id },
            });

            // Store ElevenLabs API key if provided (encrypted in production)
            if (elevenLabsApiKey) {
                await tx.credential.create({
                    data: {
                        serviceName: 'ELEVENLABS',
                        encryptedValue: elevenLabsApiKey, // TODO: Encrypt this in production
                        userId: user.id,
                    },
                });
            }

            // Create agent bots with provided configuration or defaults
            let createdAgents;
            if (agents && Array.isArray(agents) && agents.length > 0) {
                // User provided custom agent configurations
                const agentData = agents.map((agent: any) => ({
                    name: agent.name || 'Unnamed Agent',
                    persona: agent.persona || 'You are a helpful AI assistant.',
                    elevenLabsVoiceId: agent.elevenLabsVoiceId || agent.elevenLabsAgentId, // Support both naming conventions
                    phoneNumber: agent.phoneNumber || null,
                    tenantId: tenant.id,
                }));
                
                createdAgents = await Promise.all(
                    agentData.map((data: any) => tx.agentBot.create({ data }))
                );
            } else {
                // Create default placeholder agents
                createdAgents = await Promise.all([
                    tx.agentBot.create({
                        data: {
                            name: 'Default Agent',
                            persona: 'You are a helpful AI assistant ready to assist customers with their inquiries.',
                            elevenLabsVoiceId: 'PLACEHOLDER', // User needs to configure this
                            tenantId: tenant.id,
                        }
                    })
                ]);
            }

            return { user, tenant, agents: createdAgents };
        });

        res.status(201).json({ 
            message: 'User created successfully',
            userId: result.user.id,
            tenantId: result.tenant.id,
            agents: result.agents.map((agent: any) => ({
                id: agent.id,
                name: agent.name,
                elevenLabsVoiceId: agent.elevenLabsVoiceId,
                phoneNumber: agent.phoneNumber,
            })),
            setupComplete: !!elevenLabsApiKey && result.agents.some((a: any) => a.elevenLabsVoiceId !== 'PLACEHOLDER'),
        });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return res.status(409).json({ error: 'User with this email already exists' });
        }
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// === LOGIN ROUTE ===
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Validate JWT_SECRET exists
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('JWT_SECRET is not defined in environment variables');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // Generate JWT token
    const token = jwt.sign(
        { userId: user.id, tenantId: user.tenantId },
        jwtSecret,
        { expiresIn: '1d' } // Token expires in 1 day
    );

    res.json({ token });
});

// === AGENT MANAGEMENT ROUTES ===

// Get all agents for the authenticated user
router.get('/agents', authenticate, async (req, res) => {
    try {
        const tenantId = req.user!.tenantId; // Extract from JWT token
        
        const agents = await prisma.agentBot.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ agents });
    } catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({ error: 'Failed to fetch agents' });
    }
});

// Get single agent by ID
router.get('/agents/:agentId', authenticate, async (req, res) => {
    try {
        const { agentId } = req.params;
        const tenantId = req.user!.tenantId;

        const agent = await prisma.agentBot.findFirst({
            where: { 
                id: agentId,
                tenantId // Ensure tenant isolation
            }
        });

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        res.json({ agent });
    } catch (error) {
        console.error('Error fetching agent:', error);
        res.status(500).json({ error: 'Failed to fetch agent' });
    }
});

// Create a new agent
router.post('/agents', authenticate, async (req, res) => {
    try {
        const tenantId = req.user!.tenantId;

        const { name, persona, elevenLabsAgentId, phoneNumber } = req.body;

        if (!name || !elevenLabsAgentId) {
            return res.status(400).json({ 
                error: 'Missing required fields: name and elevenLabsAgentId are required',
                requiredFields: {
                    name: 'Display name for the agent',
                    elevenLabsAgentId: 'The agent_id from ElevenLabs dashboard (e.g., "agt_abc123...")',
                    persona: '(Optional) Custom system prompt for the agent',
                    phoneNumber: '(Optional) Phone number assigned to this agent'
                }
            });
        }

        const agent = await prisma.agentBot.create({
            data: {
                name,
                persona: persona || 'You are a helpful AI assistant ready to assist customers with their inquiries.',
                elevenLabsVoiceId: elevenLabsAgentId, // This is actually the agent_id from ElevenLabs
                phoneNumber: phoneNumber || null,
                tenantId
            }
        });

        res.status(201).json({ 
            message: 'Agent created successfully',
            agent: {
                id: agent.id,
                name: agent.name,
                elevenLabsAgentId: agent.elevenLabsVoiceId,
                phoneNumber: agent.phoneNumber,
                persona: agent.persona
            }
        });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return res.status(409).json({ error: 'Phone number already in use' });
        }
        console.error('Error creating agent:', error);
        res.status(500).json({ error: 'Failed to create agent' });
    }
});

// Update an existing agent
router.put('/agents/:agentId', authenticate, async (req, res) => {
    try {
        const { agentId } = req.params;
        const tenantId = req.user!.tenantId;

        const { name, persona, elevenLabsAgentId, phoneNumber } = req.body;

        // Verify agent belongs to tenant
        const existingAgent = await prisma.agentBot.findFirst({
            where: { id: agentId, tenantId }
        });

        if (!existingAgent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const updatedAgent = await prisma.agentBot.update({
            where: { id: agentId },
            data: {
                ...(name && { name }),
                ...(persona && { persona }),
                ...(elevenLabsAgentId && { elevenLabsVoiceId: elevenLabsAgentId }),
                ...(phoneNumber !== undefined && { phoneNumber })
            }
        });

        res.json({ 
            message: 'Agent updated successfully',
            agent: {
                id: updatedAgent.id,
                name: updatedAgent.name,
                elevenLabsAgentId: updatedAgent.elevenLabsVoiceId,
                phoneNumber: updatedAgent.phoneNumber,
                persona: updatedAgent.persona
            }
        });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return res.status(409).json({ error: 'Phone number already in use' });
        }
        console.error('Error updating agent:', error);
        res.status(500).json({ error: 'Failed to update agent' });
    }
});

// Delete an agent
router.delete('/agents/:agentId', authenticate, async (req, res) => {
    try {
        const { agentId } = req.params;
        const tenantId = req.user!.tenantId;

        // Verify agent belongs to tenant
        const existingAgent = await prisma.agentBot.findFirst({
            where: { id: agentId, tenantId }
        });

        if (!existingAgent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        await prisma.agentBot.delete({
            where: { id: agentId }
        });

        res.json({ message: 'Agent deleted successfully' });
    } catch (error) {
        console.error('Error deleting agent:', error);
        res.status(500).json({ error: 'Failed to delete agent' });
    }
});

// === CREDENTIAL MANAGEMENT ROUTES ===

// Store or update ElevenLabs API key
router.post('/credentials/elevenlabs', authenticate, async (req, res) => {
    try {
        const userId = req.user!.userId;

        const { apiKey } = req.body;

        if (!apiKey) {
            return res.status(400).json({ error: 'Missing required field: apiKey' });
        }

        // Check if credential already exists
        const existing = await prisma.credential.findFirst({
            where: { 
                userId,
                serviceName: 'ELEVENLABS'
            }
        });

        let credential;
        if (existing) {
            // Update existing credential
            credential = await prisma.credential.update({
                where: { id: existing.id },
                data: { encryptedValue: apiKey } // TODO: Encrypt this in production
            });
        } else {
            // Create new credential
            credential = await prisma.credential.create({
                data: {
                    serviceName: 'ELEVENLABS',
                    encryptedValue: apiKey, // TODO: Encrypt this in production
                    userId
                }
            });
        }

        res.json({ 
            message: 'ElevenLabs API key saved successfully',
            credentialId: credential.id
        });
    } catch (error) {
        console.error('Error saving credential:', error);
        res.status(500).json({ error: 'Failed to save API key' });
    }
});

// Get credential status (without exposing the actual key)
router.get('/credentials/elevenlabs', authenticate, async (req, res) => {
    try {
        const userId = req.user!.userId;

        const credential = await prisma.credential.findFirst({
            where: { 
                userId,
                serviceName: 'ELEVENLABS'
            },
            select: {
                id: true,
                serviceName: true,
                createdAt: true
                // DO NOT select encryptedValue
            }
        });

        res.json({ 
            configured: !!credential,
            credential: credential ? {
                id: credential.id,
                createdAt: credential.createdAt
            } : null
        });
    } catch (error) {
        console.error('Error fetching credential status:', error);
        res.status(500).json({ error: 'Failed to fetch credential status' });
    }
});

// === CAL.COM / MEETING CREDENTIAL MANAGEMENT ===

/**
 * Store or update Cal.com and GHL credentials
 * POST /api/credentials/calcom
 * 
 * Body:
 * {
 *   "calcomApiKey": "cal_live_xxxxx",
 *   "ghlWhatsappWebhook": "https://services.leadconnectorhq.com/hooks/xxxxx"
 * }
 * 
 * Optional (for backward compatibility):
 * {
 *   "n8nAvailabilityWebhook": "https://your-n8n.com/webhook/availability",
 *   "n8nBookingWebhook": "https://your-n8n.com/webhook/booking"
 * }
 */
router.post('/credentials/calcom', authenticate, async (req, res) => {
    try {
        const tenantId = req.user!.tenantId;
        const { calcomApiKey, ghlWhatsappWebhook, n8nAvailabilityWebhook, n8nBookingWebhook } = req.body;

        // Validation - at least one credential field is required
        if (!calcomApiKey && !ghlWhatsappWebhook && !n8nAvailabilityWebhook && !n8nBookingWebhook) {
            return res.status(400).json({ 
                error: 'At least one credential field is required',
                recommended: ['calcomApiKey', 'ghlWhatsappWebhook'],
                fields: {
                    calcomApiKey: 'Cal.com API key (e.g., cal_live_xxxxx) - REQUIRED for meeting booking',
                    ghlWhatsappWebhook: 'GoHighLevel workflow webhook URL for WhatsApp notifications',
                    n8nAvailabilityWebhook: '(Optional) n8n webhook URL for checking availability - deprecated',
                    n8nBookingWebhook: '(Optional) n8n webhook URL for confirming bookings - deprecated'
                },
                note: 'The system uses direct Cal.com API calls for booking and GHL webhooks for WhatsApp.'
            });
        }

        // Validate webhook URLs if provided
        if (ghlWhatsappWebhook && !ghlWhatsappWebhook.startsWith('http')) {
            return res.status(400).json({ error: 'ghlWhatsappWebhook must be a valid HTTP/HTTPS URL' });
        }
        if (n8nAvailabilityWebhook && !n8nAvailabilityWebhook.startsWith('http')) {
            return res.status(400).json({ error: 'n8nAvailabilityWebhook must be a valid HTTP/HTTPS URL' });
        }
        if (n8nBookingWebhook && !n8nBookingWebhook.startsWith('http')) {
            return res.status(400).json({ error: 'n8nBookingWebhook must be a valid HTTP/HTTPS URL' });
        }

        // Check if credentials already exist for this tenant
        const existing = await prisma.meetingCredential.findUnique({
            where: { tenantId }
        });

        let credential;
        if (existing) {
            // Update existing credentials (only update fields that are provided)
            const updateData: any = {};
            if (calcomApiKey !== undefined) updateData.calcomApiKey = calcomApiKey; // TODO: Encrypt in production
            if (ghlWhatsappWebhook !== undefined) updateData.ghlWhatsappWebhook = ghlWhatsappWebhook;
            if (n8nAvailabilityWebhook !== undefined) updateData.n8nAvailabilityWebhook = n8nAvailabilityWebhook;
            if (n8nBookingWebhook !== undefined) updateData.n8nBookingWebhook = n8nBookingWebhook;

            credential = await prisma.meetingCredential.update({
                where: { tenantId },
                data: updateData
            });

            console.log(`✅ Updated meeting credentials for tenant: ${tenantId}`);
        } else {
            // Create new credentials
            credential = await prisma.meetingCredential.create({
                data: {
                    tenantId,
                    calcomApiKey: calcomApiKey || null, // TODO: Encrypt in production
                    ghlWhatsappWebhook: ghlWhatsappWebhook || null,
                    n8nAvailabilityWebhook: n8nAvailabilityWebhook || null,
                    n8nBookingWebhook: n8nBookingWebhook || null
                }
            });

            console.log(`✅ Created meeting credentials for tenant: ${tenantId}`);
        }

        res.json({ 
            message: 'Meeting credentials saved successfully',
            credentialId: credential.id,
            configured: {
                calcomApiKey: !!credential.calcomApiKey,
                ghlWhatsappWebhook: !!credential.ghlWhatsappWebhook,
                n8nAvailabilityWebhook: !!credential.n8nAvailabilityWebhook,
                n8nBookingWebhook: !!credential.n8nBookingWebhook
            }
        });
    } catch (error) {
        console.error('Error saving meeting credentials:', error);
        res.status(500).json({ error: 'Failed to save credentials' });
    }
});

/**
 * Get Cal.com and GHL credential status (without exposing the actual keys)
 * GET /api/credentials/calcom
 */
router.get('/credentials/calcom', authenticate, async (req, res) => {
    try {
        const tenantId = req.user!.tenantId;

        const credential = await prisma.meetingCredential.findUnique({
            where: { tenantId },
            select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                // Check if fields are configured without exposing values
                calcomApiKey: true,
                ghlWhatsappWebhook: true,
                n8nAvailabilityWebhook: true,
                n8nBookingWebhook: true
            }
        });

        if (!credential) {
            return res.json({ 
                configured: false,
                message: 'No meeting credentials configured',
                setupEndpoint: 'POST /api/credentials/calcom'
            });
        }

        res.json({ 
            configured: true,
            credentialId: credential.id,
            createdAt: credential.createdAt,
            updatedAt: credential.updatedAt,
            fields: {
                calcomApiKey: !!credential.calcomApiKey,
                ghlWhatsappWebhook: !!credential.ghlWhatsappWebhook,
                n8nAvailabilityWebhook: !!credential.n8nAvailabilityWebhook,
                n8nBookingWebhook: !!credential.n8nBookingWebhook
            },
            // Show webhook URLs (not sensitive - webhooks don't expose data)
            webhooks: {
                ghlWhatsapp: credential.ghlWhatsappWebhook,
                availability: credential.n8nAvailabilityWebhook,
                booking: credential.n8nBookingWebhook
            }
        });
    } catch (error) {
        console.error('Error fetching meeting credential status:', error);
        res.status(500).json({ error: 'Failed to fetch credential status' });
    }
});

export default router;
