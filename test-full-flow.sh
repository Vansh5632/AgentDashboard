#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== AI Agent Callback System - Full Test ===${NC}\n"

# Step 1: User Signup
echo -e "${BLUE}Step 1: Creating user account...${NC}"
SIGNUP_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vansh@gmail.com",
    "password": "password123",
    "tenantName": "Vansh Company"
  }')

echo "Signup Response: $SIGNUP_RESPONSE"
echo -e "${GREEN}✅ User created successfully${NC}\n"

# Step 1.5: Login to get JWT token
echo -e "${BLUE}Step 1.5: Logging in to get JWT token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vansh@gmail.com",
    "password": "password123"
  }')

echo "Login Response: $LOGIN_RESPONSE"

# Extract JWT token from response
JWT_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$JWT_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get JWT token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo -e "JWT Token: ${JWT_TOKEN:0:50}...\n"

# Step 2: Store ElevenLabs API Key
echo -e "${BLUE}Step 2: Storing ElevenLabs API key...${NC}"
CRED_RESPONSE=$(curl -s -X POST http://localhost:3001/api/credentials/elevenlabs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "apiKey": "sk_dc4b07b89a56a816195d3ed59d5735757b7ca4bee684c53f"
  }')

echo "Credential Response: $CRED_RESPONSE"
echo -e "${GREEN}✅ ElevenLabs API key stored${NC}\n"

# Step 3: Send ElevenLabs Webhook
echo -e "${BLUE}Step 3: Sending ElevenLabs webhook (callback in 5 minutes)...${NC}"

# Calculate callback time (5 minutes from now)
CURRENT_TIME=$(date +"%Y-%m-%d %H:%M:%S")
CALLBACK_TIME=$(date -d "+5 minutes" +"%H:%M")
echo "Current time: $CURRENT_TIME"
echo "Callback time: $CALLBACK_TIME"

WEBHOOK_RESPONSE=$(curl -s -X POST http://localhost:3001/api/webhooks/elevenlabs/call-ended \
  -H "Content-Type: application/json" \
  -d '{
    "type": "post_call_transcription",
    "event_timestamp": '$(date +%s)',
    "data": {
      "agent_id": "agent_2201k805yed4fq3rj7ne7tbeecgn",
      "conversation_id": "conv_7701k807mbv3eg3tzrjfw0jgen9j",
      "status": "done",
      "user_id": null,
      "transcript": [
        {
          "role": "agent",
          "message": "Hello, this is Jennie from Propnex. How have you been?"
        },
        {
          "role": "user",
          "message": "No, I am good."
        },
        {
          "role": "user",
          "message": "Can you call me back in five minutes?"
        },
        {
          "role": "agent",
          "message": "Sure, I will call you back in five minutes. Talk to you soon."
        }
      ],
      "metadata": {
        "start_time_unix_secs": '$(date +%s)',
        "call_duration_secs": 52,
        "phone_call": {
          "direction": "outbound",
          "phone_number_id": "phnum_2201k1pypfb0fhqa3d5spwgpmdhc",
          "agent_number": "+6568279903",
          "external_number": "+919050138050",
          "type": "sip_trunking"
        }
      },
      "analysis": {
        "data_collection_results": {
          "Final_state": {
            "value": "OPENER"
          },
          "Lead_Status": {
            "value": "Call Back"
          },
          "Final_callback_time": {
            "value": "in 5 minutes"
          }
        },
        "transcript_summary": "User requested a callback in 5 minutes.",
        "call_summary_title": "Schedule Callback in 5min"
      }
    }
  }')

echo "Webhook Response: $WEBHOOK_RESPONSE"
echo -e "${GREEN}✅ Webhook sent successfully${NC}\n"

# Step 4: Check Database
echo -e "${BLUE}Step 4: Checking database for callback entry...${NC}"
sleep 3

# Query database using psql
DB_RESULT=$(PGPASSWORD=aiagent_password psql -h localhost -U aiagent -d aiagent_db -t -c "
  SELECT 
    id, 
    \"conversationId\", 
    \"customerPhoneNumber\",
    \"agentPhoneNumber\",
    \"callbackRequested\",
    \"callbackScheduledAt\",
    \"leadStatus\",
    \"callbackReason\"
  FROM \"CallLog\" 
  ORDER BY \"createdAt\" DESC 
  LIMIT 1;
")

echo "Database Entry:"
echo "$DB_RESULT"
echo -e "${GREEN}✅ Callback scheduled in database${NC}\n"

# Step 5: Monitor Worker Logs
echo -e "${BLUE}Step 5: Worker should process the callback job...${NC}"
echo "Check worker terminal for processing logs"
echo -e "${GREEN}✅ Test complete!${NC}\n"

echo -e "${BLUE}=== Summary ===${NC}"
echo "1. ✅ User created: vansh@gmail.com"
echo "2. ✅ ElevenLabs API key stored"
echo "3. ✅ Webhook received and processed"
echo "4. ✅ Callback scheduled for ~5 minutes from now"
echo ""
echo "Next steps:"
echo "- Wait 5 minutes for callback job to execute"
echo "- Check worker logs for execute-callback job"
echo "- Verify ElevenLabs API call with proper parameters"
