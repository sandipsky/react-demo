import { useState } from "react"
import { useGetProduct } from "../product.query"

type ProductFormProps = {
  mode: 'add' | 'edit' | 'view'
  productId?: string          // present for edit + view, absent for add
}

export const ProductForm = ({ mode, productId }: ProductFormProps) => {

  const { data, isLoading, isError } = useGetProduct(Number(productId));

  const [name, setName] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [description, setDescription] = useState<string>("");

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
    <>
      <h1>{mode === 'edit' ? 'Edit' : 'Add'} Product</h1>


      <div>
        <label>Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <label>Price</label>
        <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>

      <div>
        <label>Description</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <button>Save</button>
    </>
  )
}
