#!/bin/bash

# test-ghl-whatsapp.sh
# Test script for GHL WhatsApp notifications in meeting system

set -e # Exit on error

echo "=========================================="
echo "Testing GHL WhatsApp Notification System"
echo "=========================================="
echo ""

# Configuration
API_BASE="http://localhost:3001/api"
TEST_EMAIL="ghl-test-$(date +%s)@example.com"
TEST_PASSWORD="testpassword123"

# Cal.com Configuration (from environment or defaults)
CALCOM_API_KEY="${CALCOM_API_KEY:-cal_live_dd0e492997151d8249276d2b336ecc1e}"
EVENT_TYPE_ID="${EVENT_TYPE_ID:-3140481}"

# GHL Webhook - Your actual GHL webhook URL
GHL_WEBHOOK="${GHL_WEBHOOK:-https://services.leadconnectorhq.com/hooks/SnAzQONG3ot19kWIjRK8/webhook-trigger/e172afdc-89a1-4b4c-929a-52ff9b6680ff}"

# Customer phone number for WhatsApp
CUSTOMER_PHONE="${CUSTOMER_PHONE:-+919050138050}"

echo "📱 WhatsApp will be sent to: $CUSTOMER_PHONE"
echo ""

# === STEP 1: Create User ===
echo "📝 Step 1: Creating test user..."
SIGNUP_RESPONSE=$(curl -s -X POST "$API_BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"tenantName\": \"GHL Test Company\"
  }")

echo "$SIGNUP_RESPONSE" | jq '.'
USER_ID=$(echo "$SIGNUP_RESPONSE" | jq -r '.userId')
TENANT_ID=$(echo "$SIGNUP_RESPONSE" | jq -r '.tenantId')

if [ "$USER_ID" == "null" ] || [ "$TENANT_ID" == "null" ]; then
    echo "❌ Failed to create user"
    exit 1
fi

echo "✅ User created: $USER_ID (Tenant: $TENANT_ID)"
echo ""

# === STEP 2: Login ===
echo "🔐 Step 2: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$JWT_TOKEN" == "null" ]; then
    echo "❌ Failed to login"
    exit 1
fi

echo "✅ Logged in successfully"
echo ""

# === STEP 3: Configure Cal.com + GHL Credentials ===
echo "🔑 Step 3: Configuring Cal.com + GHL credentials..."
CRED_RESPONSE=$(curl -s -X POST "$API_BASE/credentials/calcom" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"calcomApiKey\": \"$CALCOM_API_KEY\",
    \"ghlWhatsappWebhook\": \"$GHL_WEBHOOK\"
  }")

echo "$CRED_RESPONSE" | jq '.'

CALCOM_CONFIGURED=$(echo "$CRED_RESPONSE" | jq -r '.configured.calcomApiKey')
GHL_CONFIGURED=$(echo "$CRED_RESPONSE" | jq -r '.configured.ghlWhatsappWebhook')

if [ "$CALCOM_CONFIGURED" != "true" ]; then
    echo "❌ Failed to configure Cal.com API key"
    exit 1
fi

echo "✅ Cal.com configured: $CALCOM_CONFIGURED"
echo "✅ GHL WhatsApp configured: $GHL_CONFIGURED"
echo ""

# === STEP 4: Check Availability ===
echo "📅 Step 4: Checking available slots..."

# Calculate dates (today + 2 days for safety)
START_DATE=$(date -u -d "+2 days" +"%Y-%m-%d")
END_DATE=$(date -u -d "+5 days" +"%Y-%m-%d")

echo "   Looking for slots between $START_DATE and $END_DATE"

AVAILABILITY_RESPONSE=$(curl -s -X POST "$API_BASE/meetings/check-availability" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"eventTypeId\": $EVENT_TYPE_ID,
    \"startTime\": \"${START_DATE}T00:00:00Z\",
    \"endTime\": \"${END_DATE}T23:59:59Z\",
    \"timeZone\": \"America/New_York\"
  }")

echo "$AVAILABILITY_RESPONSE" | jq '.'

SLOT_COUNT=$(echo "$AVAILABILITY_RESPONSE" | jq '.slots | length')
echo ""
echo "✅ Found $SLOT_COUNT available slots"

if [ "$SLOT_COUNT" -eq 0 ]; then
    echo "❌ No slots available. Try adjusting date range."
    exit 1
fi

# Extract first available slot
FIRST_SLOT=$(echo "$AVAILABILITY_RESPONSE" | jq -r '.slots[0].time')
echo "   First available slot: $FIRST_SLOT"
echo ""

# === STEP 5: Confirm Booking ===
echo "📞 Step 5: Confirming meeting booking..."
BOOKING_RESPONSE=$(curl -s -X POST "$API_BASE/meetings/confirm-booking" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"eventTypeId\": $EVENT_TYPE_ID,
    \"start\": \"$FIRST_SLOT\",
    \"responses\": {
      \"name\": \"John WhatsApp Test\",
      \"email\": \"john.whatsapp@example.com\",
      \"phone\": \"$CUSTOMER_PHONE\",
      \"notes\": \"Testing GHL WhatsApp notification system\"
    },
    \"timeZone\": \"America/New_York\",
    \"language\": \"en\"
  }")

echo "$BOOKING_RESPONSE" | jq '.'

MEETING_ID=$(echo "$BOOKING_RESPONSE" | jq -r '.meetingId')
STATUS=$(echo "$BOOKING_RESPONSE" | jq -r '.status')

if [ "$MEETING_ID" == "null" ]; then
    echo "❌ Failed to create booking"
    exit 1
fi

echo ""
echo "✅ Meeting queued: $MEETING_ID"
echo "   Status: $STATUS"
echo ""

# === STEP 6: Poll for Worker Processing ===
echo "⏳ Step 6: Waiting for worker to process booking..."
echo "   (Worker will call Cal.com API and send WhatsApp via GHL)"
echo ""

MAX_WAIT=30 # Wait up to 30 seconds
COUNTER=0

while [ $COUNTER -lt $MAX_WAIT ]; do
    sleep 1
    COUNTER=$((COUNTER + 1))
    
    # Check meeting status
    STATUS_RESPONSE=$(curl -s -X GET "$API_BASE/meetings/$MEETING_ID" \
      -H "Authorization: Bearer $JWT_TOKEN")
    
    CURRENT_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.meeting.status')
    WHATSAPP_SENT=$(echo "$STATUS_RESPONSE" | jq -r '.meeting.whatsappSent')
    MEETING_LINK=$(echo "$STATUS_RESPONSE" | jq -r '.meeting.meetingLink')
    
    echo -n "."
    
    if [ "$CURRENT_STATUS" == "CONFIRMED" ]; then
        echo ""
        echo ""
        echo "✅ Meeting confirmed by worker!"
        echo ""
        echo "📊 Final Status:"
        echo "$STATUS_RESPONSE" | jq '{
            meetingId: .meeting.id,
            status: .meeting.status,
            calcomEventId: .meeting.calcomEventId,
            meetingLink: .meeting.meetingLink,
            whatsappSent: .meeting.whatsappSent,
            whatsappSentAt: .meeting.whatsappSentAt,
            whatsappError: .meeting.whatsappError
        }'
        echo ""
        
        if [ "$WHATSAPP_SENT" == "true" ]; then
            echo "✅ WhatsApp notification sent successfully!"
            echo "   Check the customer's phone: $CUSTOMER_PHONE"
            echo ""
        elif [ "$WHATSAPP_SENT" == "false" ]; then
            WHATSAPP_ERROR=$(echo "$STATUS_RESPONSE" | jq -r '.meeting.whatsappError')
            echo "⚠️  WhatsApp notification failed"
            echo "   Error: $WHATSAPP_ERROR"
            echo ""
        else
            echo "ℹ️  WhatsApp notification not attempted (webhook not configured)"
            echo ""
        fi
        
        if [ "$MEETING_LINK" != "null" ]; then
            echo "🔗 Meeting Link: $MEETING_LINK"
            echo ""
        fi
        
        break
    elif [ "$CURRENT_STATUS" == "FAILED" ]; then
        echo ""
        echo ""
        echo "❌ Meeting booking failed"
        ERROR_MSG=$(echo "$STATUS_RESPONSE" | jq -r '.meeting.errorMessage')
        echo "   Error: $ERROR_MSG"
        echo ""
        exit 1
    fi
    
    if [ $COUNTER -eq $MAX_WAIT ]; then
        echo ""
        echo ""
        echo "⚠️  Timeout waiting for worker"
        echo "   Meeting may still be processing"
        echo "   Current status: $CURRENT_STATUS"
        echo ""
        exit 1
    fi
done

# === STEP 7: Show Full Meeting Details ===
echo "📋 Step 7: Full meeting details:"
curl -s -X GET "$API_BASE/meetings/$MEETING_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.'

echo ""
echo "=========================================="
echo "✅ Test Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - User created: $TEST_EMAIL"
echo "  - Meeting ID: $MEETING_ID"
echo "  - Cal.com Event ID: $(curl -s -X GET "$API_BASE/meetings/$MEETING_ID" -H "Authorization: Bearer $JWT_TOKEN" | jq -r '.meeting.calcomEventId')"
echo "  - WhatsApp Sent: $(curl -s -X GET "$API_BASE/meetings/$MEETING_ID" -H "Authorization: Bearer $JWT_TOKEN" | jq -r '.meeting.whatsappSent')"
echo ""
echo "Next Steps:"
echo "  1. Check Cal.com dashboard: https://app.cal.com/bookings"
echo "  2. Check customer's WhatsApp: $CUSTOMER_PHONE"
echo "  3. Check GHL workflow logs: https://app.gohighlevel.com"
echo ""
