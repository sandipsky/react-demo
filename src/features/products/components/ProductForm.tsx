import { useEffect, useState } from "react"
import { useGetProduct, useUpdateProduct, useCreateProduct } from "../product.query"
import { useNavigate } from "@tanstack/react-router"

type ProductFormProps = {
  mode: 'add' | 'edit' | 'view'
  productId?: string          // present for edit + view, absent for add
}

export const ProductForm = ({ mode, productId }: ProductFormProps) => {


  const { data, isLoading, isError } = useGetProduct(Number(productId), mode !== 'add');
  const [name, setName] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const navigate = useNavigate();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  useEffect(() => {
    if (data) {
      setName(data.name);
      setPrice(String(data.price));     // price is a number in data, but state is string
      setDescription(data.description);
    }
  }, [data]);

  const handleSave = () => {
    if (!name || !price) return;

    const body = {
      id: Number(productId),        // ignored by the server on create; used on update
      name,
      price: Number(price),         // state is a string → convert to number for the API
      description,
    };

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

      <button onClick={handleSave}>Save</button>
    </>
  )
}
