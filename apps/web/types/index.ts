export interface User {
  id: string;
  email: string;
  tenantId: string;
}

export interface Agent {
  id: string;
  name: string;
  elevenLabsVoiceId: string | null;
  phoneNumber: string | null;
  persona: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallLog {
  id: string;
  conversationId: string;
  status: string;
  summary: string | null;
  customerPhoneNumber: string | null;
  callbackRequested: boolean;
  callbackScheduledAt: string | null;
  callbackReason: string | null;
  leadStatus: string | null;
  finalState: string | null;
  callDuration: number | null;
  createdAt: string;
  agentId: string | null;
  agentPhoneNumber: string | null;
}

export interface Meeting {
  id: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhoneNumber: string | null;
  meetingTime: string;
  duration: number;
  timezone: string;
  status: string;
  calcomEventId: string | null;
  notes: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
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
  | 'CALLBACK_COMPLETED';

export type MeetingStatus = 
  | 'PENDING' 
  | 'CONFIRMED' 
  | 'FAILED' 
  | 'CANCELLED' 
  | 'WHATSAPP_SENT' 
  | 'WHATSAPP_FAILED';
