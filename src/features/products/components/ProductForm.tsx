import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useGetProduct, useUpdateProduct, useCreateProduct } from "../product.query"
import { useNavigate } from "@tanstack/react-router"

type ProductFormProps = {
  mode: 'add' | 'edit' | 'view'
  productId?: string          // present for edit + view, absent for add
}

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  price: z.number().positive('Price must be greater than 0'),
  description: z.string().min(1, 'Description is required'),
})

type ProductFormValues = z.infer<typeof productSchema>

export const ProductForm = ({ mode, productId }: ProductFormProps) => {


  const { data, isLoading, isError } = useGetProduct(Number(productId), mode !== 'add');

  const navigate = useNavigate();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, touchedFields,dirtyFields },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: '', price: 0, description: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (data) {
      reset({ name: data.name, price: data.price, description: data.description });
    }
  }, [data, reset]);

  const onSubmit = (values: ProductFormValues) => {
    const body = { id: Number(productId), ...values };

    if (mode === 'edit') {
      updateProduct.mutate(
        { id: Number(productId), body },
        { onSuccess: () => navigate({ to: '/products' }) },
      );
    } else {
      createProduct.mutate(
        body,
        { onSuccess: () => navigate({ to: '/products' }) },
      );
    }
  };

  if (mode === 'view') {
    return (
      <>
        <h1>View Product</h1>

        {isLoading &&
          <h1>Loading...</h1>
        }

        {
          isError && "Error has occured"
        }

        {
          data && (
            <>
              <h3>Name: {data?.name}</h3>
              <h3>Price: {data?.price}</h3>
              <h3>Description: {data?.description}</h3>
            </>
          )
        }
      </>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1>{mode === 'edit' ? 'Edit' : 'Add'} Product</h1>


      <div>
        <label>Name</label>
        <input type="text" {...register('name')} />
        {(touchedFields.name || dirtyFields.name) && errors.name && <p>{errors.name.message}</p>}
      </div>

      <div>
        <label>Price</label>
        <input type="number" {...register('price', { valueAsNumber: true })} />
        {errors.price && <p>{errors.price.message}</p>}
      </div>

      <div>
        <label>Description</label>
        <input type="text" {...register('description')} />
        {errors.description && <p>{errors.description.message}</p>}
      </div>

      <button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>Save</button>
    </form>
  )
}
