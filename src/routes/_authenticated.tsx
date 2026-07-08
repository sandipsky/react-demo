import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

//temporary
const isAuthenticated = true;

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
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
