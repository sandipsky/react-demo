import { config } from '@/config/env';
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
  const token = "dummy";
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 403) {
      //todo logout func
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
