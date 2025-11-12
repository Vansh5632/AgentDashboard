import axios from 'axios';

// Dynamic API URL configuration
// In development: uses full URL (e.g., http://localhost:3001/api)
// In production (behind Nginx): uses relative URL (/api)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api');

console.log('🌐 API Client Configuration:');
console.log('  Environment:', process.env.NODE_ENV || 'development');
console.log('  Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important: Send cookies and handle CORS properly
  timeout: 30000, // 30 second timeout
});

// Request interceptor - Add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => {
    // Log successful API calls in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ API Success: ${response.config.method?.toUpperCase()} ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    // Enhanced error handling
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const message = error.response.data?.error || error.response.data?.message || 'An error occurred';
      
      console.error(`❌ API Error [${status}]:`, message);
      
      // Handle authentication errors
      if (status === 401) {
        if (typeof window !== 'undefined') {
          console.warn('🔒 Unauthorized - Redirecting to login');
          localStorage.removeItem('token');
          
          // Only redirect if not already on login page
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
      }
      
      // Handle CORS errors (though these usually don't reach here)
      if (status === 0) {
        console.error('🚫 CORS Error: Cannot connect to API server');
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('📡 Network Error: No response from server', error.request);
    } else {
      // Something else happened
      console.error('⚠️  Request Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  signup: (data: { email: string; password: string; tenantName: string }) =>
    api.post('/auth/signup', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getMe: () => api.get('/me'),
};

// Agents API
export const agentsApi = {
  getAll: () => api.get('/agents'),
  getOne: (id: string) => api.get(`/agents/${id}`),
  create: (data: any) => api.post('/agents', data),
  update: (id: string, data: any) => api.put(`/agents/${id}`, data),
  delete: (id: string) => api.delete(`/agents/${id}`),
  syncFromElevenLabs: () => api.get('/agents/sync-from-elevenlabs'),
  getElevenLabsAgents: () => api.get('/agents/elevenlabs-agents'),
  testAuth: (agentId: string) => api.post('/agents/test-auth', { agentId }),
};

// Calls API
export const callsApi = {
  getAll: (params?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    phone?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/calls', { params }),
  getOne: (id: string) => api.get(`/calls/${id}`),
  getStats: (days?: number) => api.get('/calls/stats/overview', { params: { days } }),
};

// Meetings API
export const meetingsApi = {
  getAll: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get('/meetings', { params }),
  getOne: (id: string) => api.get(`/meetings/${id}`),
  checkAvailability: (data: any) => api.post('/meetings/check-availability', data),
  confirmBooking: (data: any) => api.post('/meetings/confirm-booking', data),
};

// Credentials API
export const credentialsApi = {
  getElevenLabs: () => api.get('/credentials/elevenlabs'),
  setElevenLabs: (apiKey: string) => api.post('/credentials/elevenlabs', { apiKey }),
  getCalcom: () => api.get('/credentials/calcom'),
  setCalcom: (data: any) => api.post('/credentials/calcom', data),
};

// Time API
export const timeApi = {
  getUtc: () => api.get('/time/utc'),
};

export default api;
