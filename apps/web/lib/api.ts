import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
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

export default api;
