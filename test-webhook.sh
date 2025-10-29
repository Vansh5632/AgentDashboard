#!/bin/bash

echo "🧪 Phase 2 Testing Script"
echo "========================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Creating test user and tenant...${NC}"
echo ""

SIGNUP_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "tenantName": "Test Company"
  }')

echo "Signup response: $SIGNUP_RESPONSE"
echo ""

echo -e "${BLUE}Step 2: Getting agent ID from database...${NC}"
echo ""
echo "Please run this command to get your agent ID:"
echo ""
echo -e "${YELLOW}pnpm -F db exec prisma studio${NC}"
echo ""
echo "Then:"
echo "1. Open http://localhost:5555 in your browser"
echo "2. Click on 'AgentBot' table"
echo "3. Copy the 'id' of any agent (should look like: clxxx...)"
echo ""
read -p "Press Enter after you have the agent ID..."
echo ""

read -p "Enter your Agent ID: " AGENT_ID
echo ""

echo -e "${BLUE}Step 3: Sending test webhook...${NC}"
echo ""

WEBHOOK_RESPONSE=$(curl -s -X POST http://localhost:3001/api/webhooks/elevenlabs/call-ended \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"conversation_id\": \"test-conv-$(date +%s)\",
      \"agent_id\": \"$AGENT_ID\",
      \"transcript\": {
        \"messages\": [
          {\"role\": \"agent\", \"content\": \"Good morning! Thank you for calling Test Company. How can I assist you today?\"},
          {\"role\": \"user\", \"content\": \"Hi, I am interested in learning more about your premium subscription plan. Can you tell me about the features?\"},
          {\"role\": \"agent\", \"content\": \"Absolutely! Our premium plan includes unlimited storage, priority support, advanced analytics, and API access. It's perfect for growing businesses.\"},
          {\"role\": \"user\", \"content\": \"That sounds interesting. What's the pricing and can I get a demo?\"},
          {\"role\": \"agent\", \"content\": \"The premium plan is $99 per month. I'd be happy to schedule a demo for you. Would you prefer a call tomorrow or next week?\"},
          {\"role\": \"user\", \"content\": \"Tomorrow would be great. Can someone call me back at 2 PM?\"},
          {\"role\": \"agent\", \"content\": \"Perfect! I'll schedule a callback for tomorrow at 2 PM. You'll receive a confirmation email shortly. Is there anything else I can help you with today?\"},
          {\"role\": \"user\", \"content\": \"No, that's all. Thank you!\"},
          {\"role\": \"agent\", \"content\": \"You're welcome! Have a great day!\"}
        ]
      }
    }
  }")

echo "Webhook response: $WEBHOOK_RESPONSE"
echo ""

echo -e "${GREEN}✅ Test webhook sent!${NC}"
echo ""
echo -e "${BLUE}Step 4: Monitor the worker logs...${NC}"
echo ""
echo "You should see in the Worker terminal:"
echo "  📞 Processing job..."
echo "  🤖 Step 1: Generating AI summary..."
echo "  🔢 Step 2: Generating embedding vector..."
echo "  📊 Step 3: Storing vector to Pinecone..."
echo "  💾 Step 4: Saving to PostgreSQL database..."
echo "  📞 Step 5: Checking if callback is needed..."
echo "  ✅ Successfully processed job"
echo ""
echo -e "${BLUE}Step 5: Verify results...${NC}"
echo ""
echo "Check the database:"
echo -e "${YELLOW}pnpm -F db exec prisma studio${NC}"
echo ""
echo "Look in the 'CallLog' table for your new entry!"
echo ""
echo -e "${GREEN}🎉 Testing complete!${NC}"
