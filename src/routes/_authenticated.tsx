
import { useAuthStore } from '@/features/auth';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'


export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    const isAuthenticated = !!useAuthStore.getState().token;
    if (!isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: AuthenticatedLayout
})

function AuthenticatedLayout() {
  return <>
    Auth
    <Outlet />
  </>
}
