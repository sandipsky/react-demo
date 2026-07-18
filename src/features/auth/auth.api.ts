import { apiClient } from '@/lib'
import type { ILoginBody, ILoginResponse } from './auth.types';

export const login = async (body: ILoginBody) => {
  const res = await apiClient.post<ILoginResponse>(
    '/auth/login',
    body,
  )
  return res.data
}