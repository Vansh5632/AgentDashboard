# ElevenLabs Agent Setup Guide

This guide explains how to configure your AI agents with ElevenLabs credentials.

## 📋 Prerequisites

Before you start, you need:

1. **ElevenLabs Account**: Sign up at [elevenlabs.io](https://elevenlabs.io)
2. **ElevenLabs API Key**: Get it from your [ElevenLabs API settings](https://elevenlabs.io/app/settings/api)
3. **ElevenLabs Agent ID**: Create a conversational AI agent in the ElevenLabs dashboard

---

## 🔑 Required Information from ElevenLabs

### 1. API Key
- Location: ElevenLabs Dashboard → Settings → API Keys
- Format: `sk_abc123...` (starts with `sk_`)
- Used for: Authenticating API requests to ElevenLabs

### 2. Agent ID
- Location: ElevenLabs Dashboard → Conversational AI → Your Agent → Settings
- Format: `agent_abc123...` or similar
- Used for: Identifying which AI agent handles the calls

### 3. Phone Number (Optional)
- If you want inbound calls, get a phone number from ElevenLabs
- Format: E.164 format (e.g., `+1234567890`)

---

## 🚀 Setup Methods

### Method 1: Configure During Signup (Recommended)

```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "password": "securePassword123",
    "tenantName": "My Company",
    "elevenLabsApiKey": "sk_your_elevenlabs_api_key_here",
    "agents": [
      {
        "name": "Customer Support Agent",
        "elevenLabsAgentId": "agent_abc123xyz",
        "phoneNumber": "+1234567890",
        "persona": "You are a friendly customer support agent. Help customers with their questions politely and professionally."
      },
      {
        "name": "Sales Agent",
        "elevenLabsAgentId": "agent_def456uvw",
        "phoneNumber": "+0987654321",
        "persona": "You are an enthusiastic sales representative. Help customers discover products that meet their needs."
      }
    ]
  }'
```

**Response:**
```json
{
  "message": "User created successfully",
  "userId": "cltz123abc...",
  "tenantId": "cltx456def...",
  "agents": [
    {
      "id": "clua789ghi...",
      "name": "Customer Support Agent",
      "elevenLabsVoiceId": "agent_abc123xyz",
      "phoneNumber": "+1234567890"
    },
    {
      "id": "club012jkl...",
      "name": "Sales Agent",
      "elevenLabsVoiceId": "agent_def456uvw",
      "phoneNumber": "+0987654321"
    }
  ],
  "setupComplete": true
}
```

### Method 2: Add Agent After Signup

#### Step 1: Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "password": "securePassword123"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Step 2: Store ElevenLabs API Key
```bash
curl -X POST http://localhost:5000/api/credentials/elevenlabs \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -d '{
    "apiKey": "sk_your_elevenlabs_api_key_here"
  }'
```

#### Step 3: Create Agent
```bash
curl -X POST http://localhost:5000/api/agents \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -d '{
    "name": "Customer Support Agent",
    "elevenLabsAgentId": "agent_abc123xyz",
    "phoneNumber": "+1234567890",
    "persona": "You are a friendly customer support agent helping customers."
  }'
```

**Response:**
```json
{
  "message": "Agent created successfully",
  "agent": {
    "id": "clua789ghi...",
    "name": "Customer Support Agent",
    "elevenLabsAgentId": "agent_abc123xyz",
    "phoneNumber": "+1234567890",
    "persona": "You are a friendly customer support agent helping customers."
  }
}
```

---

## 🔧 Agent Management APIs

### List All Agents
```bash
GET /api/agents
Headers: x-tenant-id: YOUR_TENANT_ID
```

### Get Single Agent
```bash
GET /api/agents/:agentId
Headers: x-tenant-id: YOUR_TENANT_ID
```

### Update Agent
```bash
PUT /api/agents/:agentId
Headers: 
  x-tenant-id: YOUR_TENANT_ID
  Content-Type: application/json
Body:
{
  "name": "Updated Agent Name",
  "persona": "Updated persona...",
  "elevenLabsAgentId": "new_agent_id",
  "phoneNumber": "+1234567890"
}
```

### Delete Agent
```bash
DELETE /api/agents/:agentId
Headers: x-tenant-id: YOUR_TENANT_ID
```

---

## 📞 How Calls Work

### 1. **Inbound Calls** (Customer calls your agent)

```
Customer dials +1234567890
        ↓
ElevenLabs routes to agent_abc123xyz
        ↓
Call completes
        ↓
ElevenLabs sends webhook to your server:
POST /api/webhooks/elevenlabs/call-ended
{
  "agent_id": "agent_abc123xyz",
  "conversation_id": "conv_xyz789",
  "transcript": "..."
}
        ↓
Worker processes:
  - AI generates summary
  - Creates embeddings
  - Stores in Pinecone
  - Saves to database
  - Checks if callback needed
```

### 2. **Outbound Calls** (System calls customer back)

```
Customer requests callback
        ↓
Worker detects callback request
        ↓
Schedules delayed job
        ↓
Worker initiates call via ElevenLabs API:
POST https://api.elevenlabs.io/v1/convai/conversation
{
  "agent_id": "agent_abc123xyz",
  "customer_phone_number": "+1987654321",
  "agent_phone_number": "+1234567890",
  "conversation_config": {
    "initial_message": "Hello! This is your requested callback...",
    "context": "Previous conversation: ..."
  }
}
```

---

## 🔐 Required Fields Reference

### AgentBot Database Schema
```typescript
{
  id: string                    // Auto-generated (cuid)
  name: string                  // Display name (e.g., "Support Agent")
  persona: string               // System prompt for AI behavior
  elevenLabsVoiceId: string     // ⚠️ This is the AGENT_ID from ElevenLabs
  phoneNumber?: string          // Phone number (E.164 format)
  tenantId: string              // Your organization ID
}
```

### Fields Needed for Making Calls

When making an outbound call, ElevenLabs requires:

```typescript
{
  agent_id: "agent_abc123xyz",           // From AgentBot.elevenLabsVoiceId
  customer_phone_number: "+1987654321",  // Customer to call
  agent_phone_number: "+1234567890",     // Your agent's caller ID (optional)
  conversation_config: {
    initial_message: "Hello!...",        // Opening message
    context: "Previous context...",      // Additional context (optional)
    conversation_id: "unique_id"         // For tracking
  }
}
```

**API Key**: Sent in header as `xi-api-key: sk_your_key_here`

---

## ⚙️ ElevenLabs Dashboard Configuration

### Webhook Setup
1. Go to your ElevenLabs Conversational AI agent settings
2. Set webhook URL: `https://your-domain.com/api/webhooks/elevenlabs/call-ended`
3. Enable webhook events:
   - `conversation.ended`
   - `conversation.failed` (optional)
4. Add custom metadata (optional):
   ```json
   {
     "tenant_id": "your_tenant_id",
     "environment": "production"
   }
   ```

### Agent Configuration
1. Create agent with custom persona/prompt
2. Configure voice (choose from ElevenLabs voice library)
3. Set up phone number (if receiving calls)
4. Copy the **Agent ID** (format: `agent_...`)
5. Test the agent in ElevenLabs playground

---

## 🧪 Testing Your Setup

### Test 1: Create Agent
```bash
# Create a test agent
curl -X POST http://localhost:5000/api/agents \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -d '{
    "name": "Test Agent",
    "elevenLabsAgentId": "agent_test123",
    "persona": "You are a test agent."
  }'
```

### Test 2: List Agents
```bash
curl -X GET http://localhost:5000/api/agents \
  -H "x-tenant-id: YOUR_TENANT_ID"
```

### Test 3: Simulate Webhook
```bash
curl -X POST http://localhost:5000/api/webhooks/elevenlabs/call-ended \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_test123",
    "conversation_id": "test_conv_123",
    "transcript": "User: Hello\nAgent: Hi there!",
    "status": "completed"
  }'
```

Check Redis queue and worker logs to see processing.

---

## 🚨 Common Issues

### Issue 1: "Agent not found"
- **Cause**: `agent_id` in webhook doesn't match any `AgentBot.elevenLabsVoiceId`
- **Fix**: Verify agent was created and copy the exact agent_id from ElevenLabs

### Issue 2: "Phone number already in use"
- **Cause**: Trying to assign same phone number to multiple agents
- **Fix**: Each agent needs a unique phone number or set to `null`

### Issue 3: "Callback failed"
- **Cause**: Invalid phone number format or missing ElevenLabs API key
- **Fix**: 
  - Ensure phone numbers are in E.164 format (`+1234567890`)
  - Check `ELEVENLABS_API_KEY` environment variable is set

### Issue 4: Webhook not receiving data
- **Cause**: ElevenLabs webhook URL not configured correctly
- **Fix**: 
  - Ensure URL is publicly accessible (use ngrok for local testing)
  - Verify webhook is enabled in ElevenLabs dashboard
  - Check server logs for incoming requests

---

## 📝 Example: Complete Setup Flow

```bash
# 1. Sign up with ElevenLabs config
RESPONSE=$(curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@company.com",
    "password": "SecurePass123",
    "tenantName": "ACME Corp",
    "elevenLabsApiKey": "sk_abc123...",
    "agents": [{
      "name": "Support Bot",
      "elevenLabsAgentId": "agent_xyz789",
      "phoneNumber": "+15551234567",
      "persona": "Helpful support agent"
    }]
  }')

echo $RESPONSE
# Extract tenantId and agentId from response

# 2. Login
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@company.com",
    "password": "SecurePass123"
  }' | jq -r '.token')

# 3. List agents (using tenantId from signup response)
curl -X GET http://localhost:5000/api/agents \
  -H "x-tenant-id: YOUR_TENANT_ID"

# 4. Update agent
curl -X PUT http://localhost:5000/api/agents/AGENT_ID \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -d '{
    "persona": "You are an expert technical support agent with deep product knowledge."
  }'
```

---

## 🔒 Security Notes

1. **Never expose API keys** in client-side code
2. **Always use HTTPS** in production
3. **Implement rate limiting** to prevent abuse
4. **Encrypt credentials** before storing (currently TODO)
5. **Verify webhook signatures** from ElevenLabs (currently TODO)
6. **Use environment variables** for sensitive config

---

## 🎯 Next Steps

After setting up your agents:

1. ✅ Configure ElevenLabs webhook URL
2. ✅ Test inbound call to your phone number
3. ✅ Monitor worker logs for webhook processing
4. ✅ Check database for CallLog entries
5. ✅ Query Pinecone to verify embeddings stored
6. ✅ Test callback functionality
7. ✅ Build frontend dashboard to view call logs

---

## 📚 Additional Resources

- [ElevenLabs Conversational AI Docs](https://elevenlabs.io/docs/conversational-ai)
- [ElevenLabs API Reference](https://elevenlabs.io/docs/api-reference)
- [Phone Number Format (E.164)](https://en.wikipedia.org/wiki/E.164)
- Project Docs: `PHASE2_GUIDE.md`, `DEPLOYMENT.md`
