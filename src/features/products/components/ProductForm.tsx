type ProductFormProps = {
  mode: 'add' | 'edit' | 'view'
  productId?: string          // present for edit + view, absent for add
}

export const ProductForm = ({mode, productId}: ProductFormProps) => {
  return (
    <>
        <h1>
            {mode == 'edit' ? `Edit mode ${productId}` : mode == 'view' ? `View mode ${productId}` : 'Add mode'}
        </h1>
    </>
  )
}
