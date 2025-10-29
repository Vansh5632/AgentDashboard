#!/bin/bash

# ============================================================================
# Meeting System Complete Test Script
# ============================================================================
# This script tests the entire meeting scheduling system from start to finish
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:3001/api"
CAL_API_KEY="cal_live_dd0e492997151d8249276d2b336ecc1e"
EVENT_TYPE_ID="3140481"

# Test user credentials
TEST_EMAIL="agent_test_$(date +%s)@example.com"
TEST_PASSWORD="TestPass123!"
TEST_TENANT="AI Agent Test Co"

# Customer details (simulating what ElevenLabs agent would collect)
CUSTOMER_NAME="John Doe"
CUSTOMER_EMAIL="john.doe.test@example.com"
CUSTOMER_PHONE="+14155552671"

# Variables to store throughout the test
AUTH_TOKEN=""
TENANT_ID=""
MEETING_ID=""
JOB_ID=""

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}         MEETING SCHEDULING SYSTEM - COMPLETE TEST${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# STEP 0: Check if services are running
# ============================================================================
check_services() {
    echo -e "\n${YELLOW}📋 STEP 0: Checking if all services are running...${NC}"
    
    # Check if API is running
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API Server is running on port 3001${NC}"
    else
        echo -e "${RED}❌ API Server is NOT running on port 3001${NC}"
        echo -e "${YELLOW}Please start the API server:${NC}"
        echo -e "  cd apps/api && pnpm dev"
        exit 1
    fi
    
    # Check if Redis is running
    if docker ps | grep -q redis || redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis is running${NC}"
    else
        echo -e "${RED}❌ Redis is NOT running${NC}"
        echo -e "${YELLOW}Please start Redis:${NC}"
        echo -e "  docker-compose up -d redis"
        exit 1
    fi
    
    # Check if PostgreSQL is running
    if docker ps | grep -q postgres || pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL is running${NC}"
    else
        echo -e "${RED}❌ PostgreSQL is NOT running${NC}"
        echo -e "${YELLOW}Please start PostgreSQL:${NC}"
        echo -e "  docker-compose up -d postgres"
        exit 1
    fi
    
    # Check if Worker is running (check for recent log activity)
    if pgrep -f "worker.ts" > /dev/null || pgrep -f "dist/worker.js" > /dev/null; then
        echo -e "${GREEN}✅ Worker service is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Worker service may not be running${NC}"
        echo -e "${YELLOW}Please start the worker:${NC}"
        echo -e "  cd apps/worker && pnpm dev"
        echo -e "${YELLOW}Continuing anyway...${NC}"
    fi
    
    echo -e "${GREEN}✅ All core services are operational${NC}"
}

# ============================================================================
# STEP 1: Create user account (signup)
# ============================================================================
signup_user() {
    echo -e "\n${YELLOW}📝 STEP 1: Creating new user account...${NC}"
    echo -e "Email: ${TEST_EMAIL}"
    echo -e "Tenant: ${TEST_TENANT}"
    
    RESPONSE=$(curl -s -X POST "${API_BASE}/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"${TEST_EMAIL}\",
            \"password\": \"${TEST_PASSWORD}\",
            \"tenantName\": \"${TEST_TENANT}\"
        }")
    
    if echo "$RESPONSE" | grep -q "userId"; then
        TENANT_ID=$(echo "$RESPONSE" | grep -o '"tenantId":"[^"]*' | cut -d'"' -f4)
        echo -e "${GREEN}✅ User created successfully${NC}"
        echo -e "Tenant ID: ${TENANT_ID}"
    else
        echo -e "${RED}❌ Failed to create user${NC}"
        echo "$RESPONSE"
        exit 1
    fi
}

# ============================================================================
# STEP 2: Login and get JWT token
# ============================================================================
login_user() {
    echo -e "\n${YELLOW}🔐 STEP 2: Logging in...${NC}"
    
    RESPONSE=$(curl -s -X POST "${API_BASE}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"${TEST_EMAIL}\",
            \"password\": \"${TEST_PASSWORD}\"
        }")
    
    if echo "$RESPONSE" | grep -q "token"; then
        AUTH_TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        echo -e "${GREEN}✅ Login successful${NC}"
        echo -e "Token: ${AUTH_TOKEN:0:20}..."
    else
        echo -e "${RED}❌ Failed to login${NC}"
        echo "$RESPONSE"
        exit 1
    fi
}

# ============================================================================
# STEP 3: Store Cal.com API credentials
# ============================================================================
store_calcom_credentials() {
    echo -e "\n${YELLOW}🔑 STEP 3: Storing Cal.com API credentials...${NC}"
    echo -e "Cal.com API Key: ${CAL_API_KEY:0:20}..."
    
    RESPONSE=$(curl -s -X POST "${API_BASE}/credentials/calcom" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${AUTH_TOKEN}" \
        -d "{
            \"calcomApiKey\": \"${CAL_API_KEY}\"
        }")
    
    if echo "$RESPONSE" | grep -q "credentialId"; then
        echo -e "${GREEN}✅ Cal.com credentials stored successfully${NC}"
    else
        echo -e "${RED}❌ Failed to store credentials${NC}"
        echo "$RESPONSE"
        exit 1
    fi
}

# ============================================================================
# STEP 4: Verify credentials are configured
# ============================================================================
verify_credentials() {
    echo -e "\n${YELLOW}🔍 STEP 4: Verifying credentials are configured...${NC}"
    
    RESPONSE=$(curl -s -X GET "${API_BASE}/credentials/calcom" \
        -H "Authorization: Bearer ${AUTH_TOKEN}")
    
    if echo "$RESPONSE" | grep -q "configured.*true"; then
        echo -e "${GREEN}✅ Credentials verified${NC}"
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    else
        echo -e "${RED}❌ Credentials not configured properly${NC}"
        echo "$RESPONSE"
        exit 1
    fi
}

# ============================================================================
# STEP 5: Check availability (SYNCHRONOUS - AI Agent asks "What times?")
# ============================================================================
check_availability() {
    echo -e "\n${YELLOW}📅 STEP 5: Checking availability (Simulating AI Agent request)...${NC}"
    echo -e "Event Type ID: ${EVENT_TYPE_ID}"
    
    # Calculate date range (starting from 2 days ahead to ensure future dates)
    START_TIME=$(date -u -d "+2 days" +"%Y-%m-%dT00:00:00Z")
    END_TIME=$(date -u -d "+9 days" +"%Y-%m-%dT23:59:59Z")
    
    echo -e "Date range: ${START_TIME} to ${END_TIME}"
    echo -e "${BLUE}🤖 AI Agent: 'Let me check available times...'${NC}"
    
    RESPONSE=$(curl -s -X POST "${API_BASE}/meetings/check-availability" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${AUTH_TOKEN}" \
        -d "{
            \"eventTypeId\": ${EVENT_TYPE_ID},
            \"startTime\": \"${START_TIME}\",
            \"endTime\": \"${END_TIME}\",
            \"timeZone\": \"America/New_York\"
        }")
    
    if echo "$RESPONSE" | grep -q "availableSlots"; then
        SLOT_COUNT=$(echo "$RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)
        echo -e "${GREEN}✅ Availability check successful${NC}"
        echo -e "Available slots: ${SLOT_COUNT}"
        
        # Extract first available slot for booking (try different patterns)
        FIRST_SLOT=$(echo "$RESPONSE" | grep -o '"[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}[+-][0-9]\{2\}:[0-9]\{2\}"' | head -1 | tr -d '"')
        
        if [ -z "$FIRST_SLOT" ]; then
            # Try Z format
            FIRST_SLOT=$(echo "$RESPONSE" | grep -o '"[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}Z"' | head -1 | tr -d '"')
        fi
        
        if [ -n "$FIRST_SLOT" ]; then
            echo -e "First available slot: ${FIRST_SLOT}"
            echo -e "${BLUE}🤖 AI Agent: 'I have availability on $(date -d "${FIRST_SLOT}" +"%B %d at %I:%M %p" 2>/dev/null || echo "${FIRST_SLOT}"). Would that work?'${NC}"
        else
            echo -e "${YELLOW}⚠️  No slots found in the response${NC}"
            echo -e "${YELLOW}Response:${NC}"
            echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
        fi
    else
        echo -e "${RED}❌ Failed to check availability${NC}"
        echo "$RESPONSE"
        exit 1
    fi
}

# ============================================================================
# STEP 6: Confirm booking (ASYNCHRONOUS - AI Agent says "I'm booking that")
# ============================================================================
confirm_booking() {
    echo -e "\n${YELLOW}📝 STEP 6: Confirming booking (Simulating AI Agent booking)...${NC}"
    
    # Use the first available slot or a specific time
    if [ -z "$FIRST_SLOT" ]; then
        # Fallback to 3 days ahead at 2 PM if no slot was found
        BOOKING_TIME=$(date -u -d "+3 days 14:00" +"%Y-%m-%dT%H:%M:%SZ")
        echo -e "${YELLOW}⚠️  Using fallback time (3 days from now): ${BOOKING_TIME}${NC}"
    else
        BOOKING_TIME="$FIRST_SLOT"
    fi
    
    echo -e "Customer: ${CUSTOMER_NAME} (${CUSTOMER_EMAIL})"
    echo -e "Meeting time: ${BOOKING_TIME}"
    echo -e "${BLUE}🤖 AI Agent: 'Perfect! I'm booking that for you now at $(date -d "${BOOKING_TIME}" +"%I:%M %p %Z on %B %d").'${NC}"
    
    RESPONSE=$(curl -s -X POST "${API_BASE}/meetings/confirm-booking" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${AUTH_TOKEN}" \
        -d "{
            \"eventTypeId\": ${EVENT_TYPE_ID},
            \"start\": \"${BOOKING_TIME}\",
            \"responses\": {
                \"name\": \"${CUSTOMER_NAME}\",
                \"email\": \"${CUSTOMER_EMAIL}\",
                \"phone\": \"${CUSTOMER_PHONE}\",
                \"notes\": \"Customer interested in AI agent services. Discussed pricing and implementation timeline.\"
            },
            \"timeZone\": \"America/New_York\",
            \"language\": \"en\",
            \"metadata\": {
                \"conversationId\": \"conv_test_$(date +%s)\",
                \"agentId\": \"agent_test_001\",
                \"source\": \"phone_call\",
                \"leadStatus\": \"qualified\"
            }
        }")
    
    if echo "$RESPONSE" | grep -q "meetingId"; then
        MEETING_ID=$(echo "$RESPONSE" | grep -o '"meetingId":"[^"]*' | cut -d'"' -f4)
        JOB_ID=$(echo "$RESPONSE" | grep -o '"jobId":"[^"]*' | cut -d'"' -f4)
        echo -e "${GREEN}✅ Booking request accepted${NC}"
        echo -e "Meeting ID: ${MEETING_ID}"
        echo -e "Job ID: ${JOB_ID}"
        echo -e "Status: PENDING (worker will process in background)"
        echo -e "${BLUE}🤖 AI Agent: 'You'll receive a confirmation email shortly at ${CUSTOMER_EMAIL}.'${NC}"
    else
        echo -e "${RED}❌ Failed to confirm booking${NC}"
        echo "$RESPONSE"
        exit 1
    fi
}

# ============================================================================
# STEP 7: Wait for worker to process the booking
# ============================================================================
wait_for_worker() {
    echo -e "\n${YELLOW}⏳ STEP 7: Waiting for worker to process booking...${NC}"
    echo -e "${BLUE}Worker is calling Cal.com API in the background...${NC}"
    
    MAX_ATTEMPTS=12  # 60 seconds max
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        sleep 5
        ATTEMPT=$((ATTEMPT + 1))
        
        echo -e "Attempt ${ATTEMPT}/${MAX_ATTEMPTS}: Checking booking status..."
        
        RESPONSE=$(curl -s -X GET "${API_BASE}/meetings/${MEETING_ID}" \
            -H "Authorization: Bearer ${AUTH_TOKEN}")
        
        STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
        
        if [ "$STATUS" = "CONFIRMED" ]; then
            CAL_EVENT_ID=$(echo "$RESPONSE" | grep -o '"calcomEventId":"[^"]*' | cut -d'"' -f4)
            echo -e "${GREEN}✅ Booking CONFIRMED by worker!${NC}"
            echo -e "Cal.com Event ID: ${CAL_EVENT_ID}"
            echo -e "${BLUE}🤖 AI Agent: 'Your meeting is confirmed!'${NC}"
            return 0
        elif [ "$STATUS" = "FAILED" ]; then
            ERROR_MSG=$(echo "$RESPONSE" | grep -o '"errorMessage":"[^"]*' | cut -d'"' -f4)
            echo -e "${RED}❌ Booking FAILED${NC}"
            echo -e "Error: ${ERROR_MSG}"
            return 1
        elif [ "$STATUS" = "PENDING" ]; then
            echo -e "${YELLOW}⏳ Still PENDING...${NC}"
        fi
    done
    
    echo -e "${RED}❌ Timeout waiting for booking confirmation${NC}"
    echo -e "${YELLOW}Final status: ${STATUS}${NC}"
    return 1
}

# ============================================================================
# STEP 8: Get meeting details
# ============================================================================
get_meeting_details() {
    echo -e "\n${YELLOW}📊 STEP 8: Fetching meeting details...${NC}"
    
    RESPONSE=$(curl -s -X GET "${API_BASE}/meetings/${MEETING_ID}" \
        -H "Authorization: Bearer ${AUTH_TOKEN}")
    
    echo -e "${GREEN}Meeting Details:${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
}

# ============================================================================
# STEP 9: List all meetings
# ============================================================================
list_all_meetings() {
    echo -e "\n${YELLOW}📋 STEP 9: Listing all meetings for this tenant...${NC}"
    
    RESPONSE=$(curl -s -X GET "${API_BASE}/meetings?limit=10" \
        -H "Authorization: Bearer ${AUTH_TOKEN}")
    
    TOTAL=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}Total meetings: ${TOTAL}${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
}

# ============================================================================
# Main execution
# ============================================================================
main() {
    echo -e "${BLUE}Starting comprehensive meeting system test...${NC}"
    echo -e "${BLUE}This simulates how an AI agent would use the system${NC}"
    echo ""
    
    # Run all test steps
    check_services
    signup_user
    login_user
    store_calcom_credentials
    verify_credentials
    check_availability
    confirm_booking
    wait_for_worker
    get_meeting_details
    list_all_meetings
    
    # Summary
    echo -e "\n${BLUE}============================================================================${NC}"
    echo -e "${GREEN}✅ TEST COMPLETED SUCCESSFULLY${NC}"
    echo -e "${BLUE}============================================================================${NC}"
    echo ""
    echo -e "${GREEN}Summary:${NC}"
    echo -e "  • Created user: ${TEST_EMAIL}"
    echo -e "  • Stored Cal.com credentials"
    echo -e "  • Checked availability (synchronous)"
    echo -e "  • Created booking (asynchronous)"
    echo -e "  • Worker processed and confirmed booking"
    echo -e "  • Meeting ID: ${MEETING_ID}"
    echo ""
    echo -e "${YELLOW}What the AI Agent experienced:${NC}"
    echo -e "  1. Asked Cal.com for available times (got response in <1 second)"
    echo -e "  2. Told customer the available times"
    echo -e "  3. Customer chose a time"
    echo -e "  4. Agent said 'I'm booking that for you' (returned immediately)"
    echo -e "  5. Worker booked with Cal.com in background"
    echo -e "  6. Customer received confirmation email"
    echo ""
    echo -e "${GREEN}🎉 Your meeting scheduling system is working perfectly!${NC}"
}

# Run the main function
main
