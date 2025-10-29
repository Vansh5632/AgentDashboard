// apps/worker/utils/n8n.ts
import axios from 'axios';

/**
 * Represents an available time slot
 */
export interface TimeSlot {
  start: string; // ISO 8601 datetime
  end: string;   // ISO 8601 datetime
}

/**
 * Response from n8n availability check webhook
 */
export interface AvailabilityResponse {
  success: boolean;
  availableSlots: TimeSlot[];
  error?: string;
}

/**
 * Response from n8n booking confirmation webhook
 */
export interface BookingResponse {
  success: boolean;
  bookingId?: string;
  eventId?: string;
  message?: string;
  error?: string;
}

/**
 * Check availability by calling n8n webhook
 * This function is synchronous from the API's perspective - it waits for the response
 * 
 * @param webhookUrl - The n8n webhook URL for checking availability
 * @param calcomApiKey - Cal.com API key for authentication
 * @param startDate - Start date for availability check (ISO string)
 * @param endDate - End date for availability check (ISO string)
 * @param timezone - Timezone for the availability check
 * @returns Promise with available time slots
 */
export async function checkAvailability(
  webhookUrl: string,
  calcomApiKey: string,
  startDate: string,
  endDate: string,
  timezone: string = 'UTC'
): Promise<AvailabilityResponse> {
  try {
    console.log('🔍 Checking availability via n8n...');
    console.log(`Webhook: ${webhookUrl}`);
    console.log(`Date range: ${startDate} to ${endDate}`);
    console.log(`Timezone: ${timezone}`);

    const response = await axios.post(
      webhookUrl,
      {
        action: 'check_availability',
        calcomApiKey,
        startDate,
        endDate,
        timezone,
      },
      {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Availability check response:', response.data);

    // Normalize the response structure
    if (response.data.success) {
      return {
        success: true,
        availableSlots: response.data.availableSlots || response.data.slots || [],
      };
    } else {
      return {
        success: false,
        availableSlots: [],
        error: response.data.error || 'Unknown error from n8n',
      };
    }
  } catch (error: any) {
    console.error('❌ Error checking availability:', error);
    
    if (error.response) {
      // Server responded with error status
      return {
        success: false,
        availableSlots: [],
        error: `n8n returned error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`,
      };
    } else if (error.request) {
      // No response received
      return {
        success: false,
        availableSlots: [],
        error: 'No response from n8n webhook - check if webhook URL is correct',
      };
    } else {
      // Other error
      return {
        success: false,
        availableSlots: [],
        error: `Failed to check availability: ${error.message}`,
      };
    }
  }
}

/**
 * Confirm a meeting booking by calling n8n webhook
 * This is called asynchronously by the worker
 * 
 * @param webhookUrl - The n8n webhook URL for confirming bookings
 * @param calcomApiKey - Cal.com API key for authentication
 * @param meetingData - Meeting details including time, attendee info, etc.
 * @returns Promise with booking confirmation
 */
export async function confirmBooking(
  webhookUrl: string,
  calcomApiKey: string,
  meetingData: {
    customerName: string;
    customerEmail: string;
    customerPhoneNumber?: string;
    meetingTime: string; // ISO 8601 datetime
    duration: number; // minutes
    timezone: string;
    notes?: string;
    conversationId?: string;
  }
): Promise<BookingResponse> {
  try {
    console.log('📅 Confirming booking via n8n...');
    console.log(`Webhook: ${webhookUrl}`);
    console.log(`Meeting details:`, meetingData);

    const response = await axios.post(
      webhookUrl,
      {
        action: 'confirm_booking',
        calcomApiKey,
        ...meetingData,
      },
      {
        timeout: 60000, // 60 second timeout for booking operations
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Booking confirmation response:', response.data);

    // Normalize the response structure
    if (response.data.success) {
      return {
        success: true,
        bookingId: response.data.bookingId || response.data.id,
        eventId: response.data.eventId || response.data.eventTypeId,
        message: response.data.message || 'Booking confirmed successfully',
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Unknown error from n8n',
      };
    }
  } catch (error: any) {
    console.error('❌ Error confirming booking:', error);
    
    if (error.response) {
      // Server responded with error status
      return {
        success: false,
        error: `n8n returned error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`,
      };
    } else if (error.request) {
      // No response received
      return {
        success: false,
        error: 'No response from n8n webhook - check if webhook URL is correct',
      };
    } else {
      // Other error
      return {
        success: false,
        error: `Failed to confirm booking: ${error.message}`,
      };
    }
  }
}

/**
 * Validate that the webhook URLs are properly configured
 */
export function validateWebhookUrls(availabilityUrl?: string | null, bookingUrl?: string | null): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!availabilityUrl) {
    errors.push('Availability webhook URL is not configured');
  } else if (!availabilityUrl.startsWith('http://') && !availabilityUrl.startsWith('https://')) {
    errors.push('Availability webhook URL must start with http:// or https://');
  }

  if (!bookingUrl) {
    errors.push('Booking webhook URL is not configured');
  } else if (!bookingUrl.startsWith('http://') && !bookingUrl.startsWith('https://')) {
    errors.push('Booking webhook URL must start with http:// or https://');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
