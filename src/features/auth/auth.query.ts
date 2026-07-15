import { useMutation } from '@tanstack/react-query'
import { login } from './auth.api'

export const useLogin = () => useMutation({ mutationFn: login })