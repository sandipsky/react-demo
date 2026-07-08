import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/products/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/products/"!</div>
}
