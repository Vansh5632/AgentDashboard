// apps/worker/utils/gohighlevel.ts
import axios from 'axios';

/**
 * Response from GHL WhatsApp webhook
 */
export interface GHLWhatsAppResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Send WhatsApp message via GoHighLevel workflow webhook
 * 
 * @param webhookUrl - GHL workflow webhook URL
 * @param messageData - Data to send in the WhatsApp message
 * @returns Promise with response from GHL
 */
export async function sendWhatsAppNotification(
  webhookUrl: string,
  messageData: {
    customerName: string;
    customerPhoneNumber: string;
    meetingTime: string;
    meetingLink?: string;
    duration: number;
    timezone: string;
    calcomEventId?: string;
    notes?: string;
  }
): Promise<GHLWhatsAppResponse> {
  try {
    console.log('📱 Sending WhatsApp notification via GHL...');
    console.log(`Webhook: ${webhookUrl}`);
    console.log(`Customer: ${messageData.customerName} (${messageData.customerPhoneNumber})`);

    const response = await axios.post(
      webhookUrl,
      {
        // Standard fields that GHL workflow expects
        phoneNumber: messageData.customerPhoneNumber,
        customerName: messageData.customerName,
        meetingTime: messageData.meetingTime,
        meetingLink: messageData.meetingLink || 'Link will be provided shortly',
        duration: messageData.duration,
        timezone: messageData.timezone,
        calcomEventId: messageData.calcomEventId,
        notes: messageData.notes,
        // Additional metadata
        source: 'ai_agent_booking',
        timestamp: new Date().toISOString(),
      },
      {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ WhatsApp notification sent successfully');
    console.log('GHL Response:', response.data);

    return {
      success: true,
      message: response.data?.message || 'WhatsApp sent successfully',
    };

  } catch (error: any) {
    console.error('❌ Error sending WhatsApp notification:', error);
    
    if (error.response) {
      // GHL webhook returned error
      return {
        success: false,
        error: `GHL webhook returned error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`,
      };
    } else if (error.request) {
      // No response received
      return {
        success: false,
        error: 'No response from GHL webhook - check if webhook URL is correct',
      };
    } else {
      // Other error
      return {
        success: false,
        error: `Failed to send WhatsApp: ${error.message}`,
      };
    }
  }
}

/**
 * Format meeting details for WhatsApp message
 * This creates a human-readable message string
 */
export function formatWhatsAppMessage(
  customerName: string,
  meetingTime: string,
  meetingLink: string | undefined,
  duration: number,
  timezone: string
): string {
  const formattedTime = new Date(meetingTime).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });

  let message = `Hi ${customerName}! 👋\n\n`;
  message += `Your meeting has been confirmed! 🎉\n\n`;
  message += `📅 Date & Time: ${formattedTime}\n`;
  message += `⏱️ Duration: ${duration} minutes\n`;
  
  if (meetingLink) {
    message += `🔗 Join Link: ${meetingLink}\n`;
  }
  
  message += `\nLooking forward to speaking with you!`;

  return message;
}

/**
 * Validate GHL webhook URL
 */
export function validateGHLWebhookUrl(url?: string | null): {
  valid: boolean;
  error?: string;
} {
  if (!url) {
    return {
      valid: false,
      error: 'GHL webhook URL is not configured',
    };
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return {
      valid: false,
      error: 'GHL webhook URL must start with http:// or https://',
    };
  }

  return { valid: true };
}
