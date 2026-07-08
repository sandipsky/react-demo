import { ProductForm } from '@/features/products'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/products/$productId/')({
  component: ProductViewPage,
})

function ProductViewPage() {
  const { productId } = Route.useParams()
  return <ProductForm mode="view" productId={productId} />
}
