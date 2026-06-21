import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Create axios instance
const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// WebSocket connection
let socket = null;

export const initializeSocket = (sessionId) => {
  socket = io(API_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('Connected to server');
    if (sessionId) {
      socket.emit('join_session', { session_id: sessionId });
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  return socket;
};

export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

// Auth API
export const authApi = {
  login: async (userId = null) => {
    const response = await apiClient.post('/auth/login', { user_id: userId });
    return response.data;
  },
};

// SPP API
export const sppApi = {
  getStructure: async () => {
    const response = await apiClient.get('/spp/structure');
    return response.data;
  },

  getAvailableDates: async () => {
    const response = await apiClient.get('/spp/available-dates');
    return response.data;
  },
};

// Distribution API
export const distributionApi = {
  calculate: async (elementIds, totalAmount, versionDate = null) => {
    const response = await apiClient.post('/distribution/calculate', {
      element_ids: elementIds,
      total_amount: totalAmount,
      version_date: versionDate,
    });
    return response.data;
  },

  save: async (resultId, sessionId) => {
    const response = await apiClient.post('/distribution/save', {
      result_id: resultId,
      session_id: sessionId,
    });
    return response.data;
  },

  getSavedResults: async (sessionId) => {
    const response = await apiClient.get('/distribution/saved-results', {
      params: { session_id: sessionId },
    });
    return response.data;
  },

  load: async (resultId) => {
    const response = await apiClient.get(`/distribution/${resultId}/load`);
    return response.data;
  },

  export: async (resultId) => {
    const response = await apiClient.get(`/distribution/${resultId}/export`, {
      responseType: 'blob',
    });
    return response;
  },
};

// Error handler
export const handleApiError = (error) => {
  if (error.response) {
    return error.response.data.error || 'An error occurred';
  }
  return error.message;
};
