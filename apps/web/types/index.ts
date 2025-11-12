export interface User {
  id: string;
  email: string;
  tenantId: string;
}

export interface Agent {
  id: string;
  name: string;
  elevenLabsAgentId?: string | null;
  elevenLabsVoiceId?: string | null;
  phoneNumber?: string | null;
  agentPhoneNumberId?: string | null;
  persona?: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallLog {
  id: string;
  conversationId: string;
  status: string;
  summary?: string | null;
  transcript?: string | null;
  customerPhoneNumber?: string | null;
  agentId?: string | null;
  agentPhoneNumber?: string | null;
  agentPhoneNumberId?: string | null;
  callbackRequested: boolean;
  callbackScheduledAt?: string | null;
  callbackReason?: string | null;
  callbackAttempts: number;
  callbackCompletedAt?: string | null;
  leadStatus?: string | null;
  finalState?: string | null;
  callDuration?: number | null;
  createdAt: string;
  tenantId: string;
}

export interface Meeting {
  id: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhoneNumber?: string | null;
  meetingTime: string;
  duration: number;
  timezone: string;
  status: string;
  calcomEventId?: string | null;
  conversationId?: string | null;
  agentId?: string | null;
  calcomResponse?: string | null;
  meetingLink?: string | null;
  whatsappSent: boolean;
  whatsappSentAt?: string | null;
  whatsappError?: string | null;
  notes?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

export interface Credential {
  id: string;
  serviceName: string;
  encryptedValue: string;
  userId: string;
  createdAt: string;
}

export interface MeetingCredential {
  id: string;
  tenantId: string;
  calcomApiKey?: string | null;
  n8nAvailabilityWebhook?: string | null;
  n8nBookingWebhook?: string | null;
  ghlWhatsappWebhook?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ElevenLabsAgent {
  agent_id: string;
  name: string;
  voice_id: string;
  prompt: string;
  inDatabase?: boolean;
  dbId?: string | null;
}

export interface Stats {
  totalCalls: number;
  completedCalls: number;
  callbacksRequested: number;
  callbacksCompleted: number;
  successRate: string;
  avgCallDuration: number;
}

export interface DailyVolume {
  date: string;
  count: number;
}

export type CallStatus = 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'NO_PICKUP' 
  | 'CALLBACK_NEEDED' 
  | 'CALLBACK_SCHEDULED' 
  | 'CALLBACK_COMPLETED'
  | 'APPOINTMENT_BOOKED';

export type MeetingStatus = 
  | 'PENDING' 
  | 'CONFIRMED' 
  | 'FAILED' 
  | 'CANCELLED' 
  | 'WHATSAPP_SENT' 
  | 'WHATSAPP_FAILED';
