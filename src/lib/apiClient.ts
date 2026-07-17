import { config } from '@/config/env';
import { useAuthStore } from '@/features/auth';
import axios, { type AxiosError } from 'axios';

export const apiClient = axios.create({
  withCredentials: true, 
  baseURL: config.api.baseUrl,
  timeout: config.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((requestConfig) => {
  const token = useAuthStore.getState().token;
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 403) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error);
  },
);
