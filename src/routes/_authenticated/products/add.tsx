import { ProductForm } from '@/features/products'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/products/add')({
  component: () => <ProductForm mode="add" />,
})

