# 07 — Wiring the Products UI to the Data Layer (List, View, Delete)

**Date:** 2026-07-10

## What I set out to do

Entry 05 built the products *data layer* — the `useProducts`, `useCreateProduct`,
etc. hooks — but no component actually used them. This session I finally connected the
UI to real data:

1. **`ProductList`** — show all products in a table, with Edit/View/Delete actions
2. **`ProductForm` (view mode)** — fetch and display a single product
3. Added the missing **`useGetProduct(id)`** hook the view/edit pages needed

And I hit **two real bugs** along the way (both things I asked "what's wrong?" about),
which — per my own rule — are the most valuable part of this entry.

---

## Part 1 — The product list (`ProductList.tsx`)

This is my first component that reads real server data:

```tsx
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
        {/* ...thead... */}
        <tbody>
          {products?.map((product, index) => (
            <tr key={product.id}>
              <td>{index + 1}</td>
              <td>{product.name}</td>
              <td>{product.price}</td>
              <td>{product.description}</td>
              <td>
                <Link to="/products/$productId/edit" params={{ productId: String(product.id) }}>Edit</Link>
                <Link to="/products/$productId" params={{ productId: String(product.id) }}>View</Link>
                <button onClick={() => onDelete(product.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isLoading && <h2>Loading...</h2>}
      {isError && <h3>{error.message}</h3>}
    </>
  )
}
```

Things I learned wiring this up:

- **`data: products`** — that colon is *renaming* while destructuring. `useProducts`
  returns a field literally called `data`; I rename it to `products` so the JSX reads
  nicely. (`isLoading`, `isError`, `error` come straight from the same hook — all the
  loading/error bookkeeping I got for free from TanStack Query, entry 05.)
- **`products?.map(...)`** — the `?.` (optional chaining) matters. On the very first
  render, before the fetch finishes, `products` is `undefined`, and `undefined.map()`
  would crash. `?.` means "only call `.map` if `products` exists, otherwise give
  `undefined`" (which React renders as nothing).
- **`key={product.id}`** — same lesson as the todo list (entry 03): stable id as the
  key, not the array index.
- **Typed links with `params`** — the Edit/View links use the `$productId` dynamic
  route from entry 02. I don't build the URL string by hand; I give the route pattern
  plus `params`, and because the route ids are numbers but URLs are strings, I convert
  with `String(product.id)`.
- **Delete = a mutation.** `useDeleteProduct()` gives me a mutation object, and
  `deleteProduct.mutate(id)` fires it. Thanks to the `invalidateQueries` in that hook
  (entry 05), the list refreshes itself automatically after a delete — I didn't write
  a single line to remove the row manually.

### 🐛 Bug I hit #1: rendering an error object

My first version of the error line was:

```tsx
// ❌ WRONG — my first attempt
{isError && <h3>{error}</h3>}
```

TypeScript complained: *"Type 'Error' is not assignable to type 'ReactNode'"*, and at
runtime React would throw *"Objects are not valid as a React child"*. The problem:
`error` is an **`Error` object**, not a string — and React can't render an object.
The human-readable text lives in its `.message` property:

```tsx
// ✅ RIGHT
{isError && <h3>{error.message}</h3>}
```

(A nice detail: because `useQuery`'s result is a *discriminated union*, inside the
`isError &&` block TypeScript already knows `error` is a real `Error` and not `null`,
so I can safely reach `.message`.)

---

## Part 2 — The `useGetProduct` hook

The view and edit pages need to fetch **one** product by id. The API function
`getProduct(id)` existed since entry 05, but there was no hook wrapping it. I added:

```ts
export const productKeys = {
    all: ['products'] as const,
    detail: (id: number) => ['product', id] as const,
};

export const useGetProduct = (id: number) => {
    return useQuery({
        queryKey: productKeys.detail(id),
        queryFn: () => getProduct(id)
    });
};
```

### 🐛 Bug I hit #2: how a query gets its argument

My first attempt looked reasonable but was wrong in three ways at once:

```ts
// ❌ WRONG — my first attempt
export const productKeys = {
    detail: ['product'] as const,        // static key, same for every product
};

export const useGetProduct = () => {     // no id parameter!
    return useQuery({
        queryKey: productKeys.detail,
        queryFn: (id: number) => getProduct(id),   // this id is NOT what I think
    });
}
```

What's wrong, and why:

1. **A query's `queryFn` does not receive my `id`.** This is the big
   misunderstanding. Unlike a *mutation*, where `mutate(id)` passes the value into
   `mutationFn` (entry 05), a **query runs automatically** based on its key — nobody
   "calls it" with an argument. The function TanStack Query actually passes to
   `queryFn` is a *context object* (with `queryKey`, `signal`, ...), so my `id: number`
   would really be that object, and I'd fetch `/products/[object Object]`.
2. **The hook took no `id`.** There was nowhere for the id to enter. It has to be a
   parameter of the hook, and the `queryFn` grabs it by **closure**, not as an argument.
3. **The key was shared across all products.** `['product']` is identical for product
   1, 5, and 50 — so they'd all collide in one cache slot. View product 1, then
   product 2, and you'd get product 1's stale data. The key **must include the id**.

The fix addresses all three: the hook takes `id`, `detail` becomes a *function* that
folds the id into the key (`['product', 5]` — unique per product), and `queryFn` reads
`id` from the closure:

```ts
// ✅ RIGHT
detail: (id: number) => ['product', id] as const,

export const useGetProduct = (id: number) => useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => getProduct(id),
});
```

**The mental model I'm taking away:** *mutations are called with arguments; queries
are described by a key and run themselves.*

---

## Part 3 — ProductForm view mode

`ProductForm` now fetches the product when showing it:

```tsx
export const ProductForm = ({ mode, productId }: ProductFormProps) => {
  const { data, isLoading, isError } = useGetProduct(Number(productId));

  const [name, setName] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  if (mode === 'view') {
    return (
      <>
        {isLoading && <h1>Loading...</h1>}
        {isError && "Error has occured"}
        {data && (
          <>
            <h3>Name: {data.name}</h3>
            <h3>Price: {data.price}</h3>
            <h3>Description: {data.description}</h3>
          </>
        )}
      </>
    )
  }

  // add / edit → the controlled form inputs
  return (
    <>
      <div><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><label>Price</label><input value={price} onChange={(e) => setPrice(e.target.value)} /></div>
      <div><label>Description</label><input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
    </>
  )
}
```

- **`Number(productId)`** — remember from entry 02 that route params arrive as
  **strings**, but `useGetProduct` and the API expect a **number**, so I convert.
- **View mode** uses the fetched `data`; **add/edit mode** shows controlled inputs
  (the `value` + `onChange` pattern from the todo list, entry 03).
- **`{data && (...)}`** guards the display so it only renders once the data has
  arrived — same idea as `products?.map` above.

---

## Things that tripped me up / notes to self

- **Queries vs mutations, again.** The `useGetProduct` bug was really me applying
  mutation thinking to a query. Worth burning in: queries fetch based on a key,
  automatically; mutations are fired manually with an argument.
- **⚠️ The form isn't actually saving yet.** The add/edit inputs have state but there's
  **no submit button** and they're **not wired to `useCreateProduct`/`useUpdateProduct`**.
  Also, in *edit* mode the inputs start empty — they don't pre-fill from the fetched
  product. So edit mode currently can't really edit. Next session's job.
- **⚠️ `useGetProduct` fires even in add mode.** When `mode === 'add'`, `productId` is
  `undefined`, so `Number(undefined)` is `NaN`, and the hook still runs a query for
  `/products/NaN` (hooks must run unconditionally, so I can't just skip it). That's a
  wasted, failing request. The fix is TanStack Query's `enabled` option, e.g.
  `enabled: mode === 'view' || mode === 'edit'`, so it only fetches when there's a
  real id.
- **⚠️ Price is a string in state.** `useState<string>("")` for price is fine for the
  input, but I'll need `Number(price)` before sending it to the API (the server and
  `IProduct` expect a number).
- **Minor:** view-mode error just shows the literal `"Error has occured"` (and it's
  spelled "occurred"). Fine as a placeholder, but it throws away `error.message`.
- **`isLoading` vs `isPending`.** Works today; note that v5's primary "no data yet"
  flag is `isPending`. Same behavior on first load.

## What's next

- [ ] Add a submit button and wire add mode to `useCreateProduct`
- [ ] Pre-fill the edit form from `useGetProduct` data, wire to `useUpdateProduct`
- [ ] Add `enabled` to `useGetProduct` so it doesn't fetch in add mode
- [ ] Convert `price` to a number before submitting
- [ ] Show the server's real error message instead of a hardcoded string
- [ ] A confirm dialog + disabled state (`deleteProduct.isPending`) on Delete
