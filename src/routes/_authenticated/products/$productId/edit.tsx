import { ProductForm } from '@/features/products'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/products/$productId/edit',
)({
  component: ProductEditPage,
})

function ProductEditPage() {
  const { productId } = Route.useParams()
  return <ProductForm mode="edit" productId={productId} />
}
