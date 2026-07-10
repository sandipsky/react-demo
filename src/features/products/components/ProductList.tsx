import { Link } from "@tanstack/react-router"
import { useDeleteProduct, useProducts } from "../product.query"

export const ProductList = () => {

  const { data: products, isLoading, isError, error } = useProducts()
  const deleteProduct = useDeleteProduct();

  const onDelete = (id: number) => {
    deleteProduct.mutate(id)
  }

  return (
    <>
      <h1>Product List</h1>

      <Link to="/products/add">Add Product</Link>

      <table>
        <thead>
          <tr>
            <th>SN</th>
            <th>Name</th>
            <th>Price</th>
            <th>Description</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {products?.map((product, index) => (
            <tr key={product.id}>
              <td>{index + 1}</td>
              <td>{product.name}</td>
              <td>{product.price}</td>
              <td>{product.description}</td>
              <td>
                <Link
                  to="/products/$productId/edit"
                  params={{ productId: String(product.id) }}
                >
                  Edit
                </Link>

                <Link
                  to="/products/$productId"
                  params={{ productId: String(product.id) }}
                >
                  View
                </Link>

                <button onClick={() => onDelete(product.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isLoading &&
        <h2>Loading...</h2>
      }

      {isError &&
        <h3>{error.message}</h3>
      }
    </>
  )
}
