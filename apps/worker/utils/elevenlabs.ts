// apps/worker/utils/elevenlabs.ts
import axios from 'axios';
import { PrismaClient } from '@ai_agent/db';
import { querySimilarCallsByPhone } from './pinecone';

const prisma = new PrismaClient();

interface CallbackRequest {
  customerPhoneNumber: string;
  agentId: string;
  agentPhoneNumber?: string; // Original agent phone number for consistent caller ID
  agentPhoneNumberId?: string; // ElevenLabs phone number ID
  callbackReason?: string;
  conversationId: string;
  tenantId: string;
}

interface ElevenLabsOutboundResponse {
  conversation_id: string;
  status: string;
}

interface PhoneNumber {
  phone_number_id: string;
  phone_number: string;
  label?: string;
  agent_id?: string;
}

/**
 * Fetch all phone numbers from ElevenLabs account
 */
export async function fetchElevenLabsPhoneNumbers(): Promise<PhoneNumber[]> {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not set in environment variables');
    }

    console.log('📞 Fetching phone numbers from ElevenLabs...');

    const response = await axios.get(
      'https://api.elevenlabs.io/v1/convai/phone-numbers',
      {
        headers: {
          'xi-api-key': apiKey
        },
        timeout: 30000
      }
    );

    const phoneNumbers = response.data.phone_numbers || response.data || [];
    console.log(`✅ Found ${phoneNumbers.length} phone numbers`);
    
    return phoneNumbers;

  } catch (error: any) {
    console.error('❌ Failed to fetch ElevenLabs phone numbers:', error);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    throw error;
  }
}

/**
 * Get or fetch agent phone number ID from database or ElevenLabs
 */
export async function getAgentPhoneNumberId(
  agentId: string,
  phoneNumber?: string
): Promise<string | null> {
  try {
    // First check if we have it in the database
    const agentBot = await prisma.agentBot.findFirst({
      where: { elevenLabsAgentId: agentId },
      select: { agentPhoneNumberId: true, phoneNumber: true }
    });

    if (agentBot?.agentPhoneNumberId) {
      console.log(`✅ Found cached phone number ID: ${agentBot.agentPhoneNumberId}`);
      return agentBot.agentPhoneNumberId;
    }

    // If not in database, fetch from ElevenLabs
    console.log('🔍 Phone number ID not cached, fetching from ElevenLabs...');
    const phoneNumbers = await fetchElevenLabsPhoneNumbers();
    
    // Try to find matching phone number
    const targetPhone = phoneNumber || agentBot?.phoneNumber;
    
    if (targetPhone) {
      const formattedTarget = formatPhoneNumber(targetPhone);
      const match = phoneNumbers.find(pn => 
        formatPhoneNumber(pn.phone_number) === formattedTarget
      );
      
      if (match) {
        console.log(`✅ Found matching phone number ID: ${match.phone_number_id}`);
        
        // Cache it in the database
        if (agentBot) {
          await prisma.agentBot.updateMany({
            where: { elevenLabsAgentId: agentId },
            data: { agentPhoneNumberId: match.phone_number_id }
          });
          console.log('💾 Cached phone number ID in database');
        }
        
        return match.phone_number_id;
      }
    }

    // If still not found, just return the first one
    if (phoneNumbers.length > 0) {
      console.log(`⚠️ No exact match found, using first available: ${phoneNumbers[0].phone_number_id}`);
      return phoneNumbers[0].phone_number_id;
    }

    console.error('❌ No phone numbers available');
    return null;

  } catch (error) {
    console.error('❌ Error getting agent phone number ID:', error);
    return null;
  }
}

/**
 * Initialize an outbound call using ElevenLabs SIP Trunk API
 */
export async function initiateCallbackCall({
  customerPhoneNumber,
  agentId,
  agentPhoneNumber,
  agentPhoneNumberId,
  callbackReason,
  conversationId,
  tenantId
}: CallbackRequest): Promise<ElevenLabsOutboundResponse> {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not set in environment variables');
    }

    console.log(`📞 Initiating callback to ${customerPhoneNumber} with agent ${agentId}`);

    // Get phone number ID if not provided
    let phoneNumberId = agentPhoneNumberId;
    if (!phoneNumberId) {
      const fetchedId = await getAgentPhoneNumberId(agentId, agentPhoneNumber);
      if (!fetchedId) {
        throw new Error('Could not determine agent phone number ID for outbound call');
      }
      phoneNumberId = fetchedId;
    }

    // Note: We don't need to fetch voice_id separately
    // The agent_id in ElevenLabs already has the voice configured
    // We'll just use the agent_id directly

    // Retrieve conversation context from Pinecone (top 3 related conversations)
    console.log('🔍 Retrieving conversation context from Pinecone...');
    const callData = await querySimilarCallsByPhone(
      customerPhoneNumber,
      tenantId,
      3
    );

    console.log(`📊 Found ${callData.length} related conversations`);

    const requestBody = {
      agent_id: agentId, // The agent_id already has voice configured in ElevenLabs
      from_number: phoneNumberId, // This is the phone_number_id
      to_number: formatPhoneNumber(customerPhoneNumber),
      call_data: callData.length > 0 ? callData : undefined, // Only include if we have data
      agent_phone_number_id: phoneNumberId
    };

    console.log('ElevenLabs SIP trunk request:', JSON.stringify({
      ...requestBody,
      call_data: callData.length > 0 ? `[${callData.length} conversations]` : undefined
    }, null, 2));

    const response = await axios.post(
      'https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call',
      requestBody,
      {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    console.log('✅ ElevenLabs callback initiated successfully');
    console.log('Response:', response.data);

    return {
      conversation_id: response.data.conversation_id || response.data.id,
      status: response.data.status || 'initiated'
    };

  } catch (error: any) {
    console.error('❌ Failed to initiate ElevenLabs callback:', error);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      throw new Error(`ElevenLabs API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      throw new Error('Network error: Could not reach ElevenLabs API');
    } else {
      throw new Error(`Failed to initiate callback: ${error.message}`);
    }
  }
}

/**
 * Get the status of an ongoing conversation
 */
export async function getConversationStatus(conversationId: string): Promise<any> {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not set in environment variables');
    }

    const response = await axios.get(
      `https://api.elevenlabs.io/v1/convai/conversation/${conversationId}`,
      {
        headers: {
          'xi-api-key': apiKey
        }
      }
    );

    return response.data;

  } catch (error: any) {
    console.error('Error getting conversation status:', error);
    if (error.response) {
      return { status: 'error', error: error.response.data };
    }
    throw error;
  }
}

/**
 * Validate phone number format (basic validation)
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  // Remove all non-digit characters
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Check if it's a valid length (10-15 digits)
  if (cleanNumber.length < 10 || cleanNumber.length > 15) {
    return false;
  }
  
  // Must start with + for international format or be 10+ digits
  return phoneNumber.startsWith('+') || cleanNumber.length >= 10;
}

/**
 * Format phone number to E.164 format
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If it doesn't start with +, assume US number and add +1
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  
  return cleaned;
}