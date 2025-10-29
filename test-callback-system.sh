#!/bin/bash

echo "🎯 Testing Callback System - Complete Flow"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Creating test user and tenant...${NC}"
echo ""

SIGNUP_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "callback-test@example.com",
    "password": "password123",
    "tenantName": "Callback Test Company"
  }')

echo "Signup response: $SIGNUP_RESPONSE"
echo ""

echo -e "${BLUE}Step 2: Getting agent ID...${NC}"
echo ""
echo "Please get your agent ID from Prisma Studio:"
echo -e "${YELLOW}pnpm -F db exec prisma studio${NC}"
echo ""
read -p "Enter your Agent ID: " AGENT_ID
echo ""

echo -e "${BLUE}Step 3: Testing callback scenarios...${NC}"
echo ""

# Test 1: Specific time callback
echo -e "${GREEN}Test 1: Customer requests callback 'tomorrow at 2 PM'${NC}"
WEBHOOK_RESPONSE_1=$(curl -s -X POST http://localhost:3001/api/webhooks/elevenlabs/call-ended \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"conversation_id\": \"test-callback-specific-$(date +%s)\",
      \"agent_id\": \"$AGENT_ID\",
      \"customer_phone_number\": \"+1234567890\",
      \"agent_phone_number\": \"+18001234567\",
      \"transcript\": {
        \"messages\": [
          {\"role\": \"agent\", \"content\": \"Hello! How can I help you today?\"},
          {\"role\": \"user\", \"content\": \"Hi, I'm interested in your premium plan but I'm busy right now.\"},
          {\"role\": \"agent\", \"content\": \"I'd be happy to help you with that. When would be a good time to call you back?\"},
          {\"role\": \"user\", \"content\": \"Can you call me back tomorrow at 2 PM? I'll have more time then.\"},
          {\"role\": \"agent\", \"content\": \"Absolutely! I'll schedule a callback for tomorrow at 2 PM. You'll hear from us then.\"},
          {\"role\": \"user\", \"content\": \"Perfect, thank you!\"}
        ]
      }
    }
  }")

echo "Response: $WEBHOOK_RESPONSE_1"
echo ""

# Test 2: General callback request
echo -e "${GREEN}Test 2: Customer requests general callback (no specific time)${NC}"
WEBHOOK_RESPONSE_2=$(curl -s -X POST http://localhost:3001/api/webhooks/elevenlabs/call-ended \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"conversation_id\": \"test-callback-general-$(date +%s)\",
      \"agent_id\": \"$AGENT_ID\",
      \"customer_phone_number\": \"+1987654321\",
      \"agent_phone_number\": \"+18009876543\",
      \"transcript\": {
        \"messages\": [
          {\"role\": \"agent\", \"content\": \"Thank you for calling! How can I assist you?\"},
          {\"role\": \"user\", \"content\": \"I have a complex issue with my account that needs detailed discussion.\"},
          {\"role\": \"agent\", \"content\": \"I understand. This sounds like something that would benefit from a more thorough conversation.\"},
          {\"role\": \"user\", \"content\": \"Yes, can someone call me back when you have more time?\"},
          {\"role\": \"agent\", \"content\": \"Absolutely! We'll call you back to resolve this properly.\"},
          {\"role\": \"user\", \"content\": \"Great, I'll wait for your call.\"}
        ]
      }
    }
  }")

echo "Response: $WEBHOOK_RESPONSE_2"
echo ""

# Test 3: No callback needed
echo -e "${GREEN}Test 3: Call resolved completely (no callback needed)${NC}"
WEBHOOK_RESPONSE_3=$(curl -s -X POST http://localhost:3001/api/webhooks/elevenlabs/call-ended \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"conversation_id\": \"test-no-callback-$(date +%s)\",
      \"agent_id\": \"$AGENT_ID\",
      \"customer_phone_number\": \"+1555000111\",
      \"transcript\": {
        \"messages\": [
          {\"role\": \"agent\", \"content\": \"Hello! How can I help you today?\"},
          {\"role\": \"user\", \"content\": \"I just wanted to check my account balance.\"},
          {\"role\": \"agent\", \"content\": \"Sure! Your current balance is $150.00. Is there anything else I can help with?\"},
          {\"role\": \"user\", \"content\": \"No, that's perfect. Thank you!\"},
          {\"role\": \"agent\", \"content\": \"You're welcome! Have a great day!\"}
        ]
      }
    }
  }")

echo "Response: $WEBHOOK_RESPONSE_3"
echo ""

echo -e "${BLUE}Step 4: Monitor the worker logs...${NC}"
echo ""
echo "Watch your worker terminal for:"
echo "  📞 Processing job..."
echo "  🤖 Step 1: Generating AI summary..."
echo "  🔢 Step 2: Generating embedding vector..."
echo "  📊 Step 3: Storing vector to Pinecone..."
echo "  💾 Step 4: Saving to PostgreSQL database..."
echo "  📞 Step 5: Checking if callback is needed..."
echo "  📅 Callback job scheduled for XXXms from now"
echo ""

echo -e "${BLUE}Step 5: Check results in database...${NC}"
echo ""
echo "Open Prisma Studio to see the results:"
echo -e "${YELLOW}pnpm -F db exec prisma studio${NC}"
echo ""
echo "Look in the 'CallLog' table for:"
echo "  ✅ callbackRequested: true/false"
echo "  ✅ callbackScheduledAt: timestamp"
echo "  ✅ callbackReason: extracted reason"
echo "  ✅ customerPhoneNumber: stored phone number"
echo "  ✅ status: CALLBACK_SCHEDULED or COMPLETED"
echo ""

echo -e "${BLUE}Step 6: Test immediate callback (for testing)...${NC}"
echo ""
read -p "Do you want to test an immediate callback? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Testing immediate callback..."
    IMMEDIATE_CALLBACK=$(curl -s -X POST http://localhost:3001/api/webhooks/elevenlabs/call-ended \
      -H "Content-Type: application/json" \
      -d "{
        \"data\": {
          \"conversation_id\": \"test-immediate-$(date +%s)\",
          \"agent_id\": \"$AGENT_ID\",
          \"customer_phone_number\": \"+1999888777\",
          \"transcript\": {
            \"messages\": [
              {\"role\": \"user\", \"content\": \"Can you call me back right now? I need immediate help!\"},
              {\"role\": \"agent\", \"content\": \"Of course! I'll call you back immediately.\"}
            ]
          }
        }
      }")
    
    echo "Response: $IMMEDIATE_CALLBACK"
    echo ""
    echo "⚠️ Note: The system will try to parse 'right now' and may schedule for +2 hours if parsing fails."
fi

echo ""
echo -e "${GREEN}🎉 Callback system testing complete!${NC}"
echo ""
echo -e "${YELLOW}What to expect:${NC}"
echo "1. 📱 Calls with callback requests → CallLog status: 'CALLBACK_SCHEDULED'"
echo "2. 📅 Scheduled jobs in Redis queue for future execution"
echo "3. 📞 At scheduled time → ElevenLabs outbound call initiated"
echo "4. ✅ CallLog status updated to 'CALLBACK_COMPLETED'"
echo ""
echo -e "${YELLOW}To monitor scheduled callbacks:${NC}"
echo "  - Check Redis queue: docker exec -it my-redis redis-cli"
echo "  - List delayed jobs: ZRANGE bull:call-processing:delayed 0 -1"
echo "  - Check worker logs for execution"
echo ""
echo -e "${RED}Important:${NC} Make sure your ElevenLabs agent is configured for outbound calls!"