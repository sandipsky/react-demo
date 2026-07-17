import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  user: { id: number; name: string; email: string } | null
  setAuth: (token: string, user: AuthState['user']) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => {
        set({ token: null, user: null });
        window.location.href = '/login';   
      },
    }),
    { name: 'auth' },   // localStorage key
  ),
)
