# 05 — The Products Data Layer: My First useQuery & useMutation

**Date:** 2026-07-09

## What I set out to do

Entry 04 built all the plumbing — the axios client, the query client, the mock
server — but nothing actually *used* it yet. This session I built the **data layer
for the products feature**: typed functions that call the API, and TanStack Query
hooks that components will use to read and change products.

Three new files, one job each:

```
src/features/products/
├── product.types.ts     → what a product IS        (the shape)
├── products.api.ts      → how to fetch/change one  (raw HTTP calls)
└── product.query.ts     → how components use it    (useQuery/useMutation hooks)
```

This layering continues the theme from entry 02 ("routes are thin, components are
smart"): now it's **components are thin, hooks are smart**. A component will just say
`useProducts()` and get data + loading + error states — it won't know axios exists.

---

## Part 1 — The type (`product.types.ts`)

```ts
export interface IProduct {
  id: number;
  name: string;
  price: number;
  description: string;
}
```

One interface, describing what the mock server returns. Every layer above imports
this, so if a product ever gains a field, I add it in exactly one place and
TypeScript points out everywhere that needs updating.

---

## Part 2 — The API functions (`products.api.ts`)

Each function is a thin, typed wrapper around one endpoint:

```ts
import { apiClient } from "@/lib";
import type { IProduct } from "./product.types";

export const getProducts = async () => {
  const res = await apiClient.get<IProduct[]>('/products');
  return res.data;
};

export const getProduct = async (id: number) => {
  const res = await apiClient.get<IProduct>(`/products/${id}`);
  return res.data;
};

export const createProduct = async (body: IProduct) => {
  const res = await apiClient.post<IProduct>('/products', body);
  return res.data;
};

export const updateProduct = async (id: number, body: IProduct) => {
  const res = await apiClient.put<IProduct>(`/products/${id}`, body);
  return res.data;
};

export const deleteProduct = async (id: number) => {
  await apiClient.delete(`/products/${id}`);
};
```

Things worth noticing:

- **The generic tells TypeScript what comes back.** `apiClient.get<IProduct[]>(...)`
  means "the response body is an array of products" — so `res.data` is fully typed
  and autocomplete works downstream. (It's a *promise*, not a *check* — TypeScript
  trusts me here; nothing verifies the server actually sent that shape. Runtime
  validation with Zod is a possible future upgrade.)
- **Return `res.data`, not `res`.** Axios wraps responses in an object carrying
  status, headers, etc. The rest of the app only cares about the body, so the API
  layer unwraps it once, here.
- **All the entry-04 plumbing kicks in silently.** Because these go through
  `apiClient`, every call automatically gets the base URL, the timeout, the Bearer
  token header, and the 403 → `/login` redirect. These functions stay tiny because
  the interceptors do the boring work.
- I also had to add `apiClient` to the `src/lib` barrel (`src/lib/index.ts`) so it's
  importable as `@/lib` — the barrel only exposes what's been explicitly exported.

---

## Part 3 — The query hooks (`product.query.ts`)

This is the new mental model, so I'll go slowly.

### Query keys — the cache's addresses

```ts
export const productKeys = {
    all: ['products'] as const,
};
```

TanStack Query caches every query under a **key** (an array). The key is like a
label on a drawer: `['products']` is the drawer where the product list lives.
Ask for the same key twice → same drawer, no second network request while fresh.

Defining keys in one `productKeys` object (instead of typing `['products']` inline
everywhere) matters because *invalidation* — telling the cache "this drawer is out of
date" — must use the **exact same key** as the query. A typo like `['product']` in
one place would silently break the refresh behavior. One shared constant makes that
impossible. (`as const` keeps the type exact, which TanStack Query likes.)

### Reading data: `useQuery`

```ts
export const useProducts = () =>
    useQuery({
        queryKey: productKeys.all,
        queryFn: getProducts,
    });
```

`useQuery` takes "where to store it" (`queryKey`) and "how to fetch it" (`queryFn`).
In exchange, a component gets a whole bundle:

```tsx
const { data, isPending, isError, error } = useProducts();
```

...and TanStack Query handles what I'd otherwise hand-roll with `useEffect` +
three `useState`s: fetch on mount, track loading, track errors, cache the result,
dedupe simultaneous requests, refetch when stale (per the 1-minute `staleTime` from
entry 04). Declarative data: *"I need products"*, not *"go fetch products now."*

Wrapping it in a custom hook (`useProducts`) instead of calling `useQuery` directly
in components keeps the key + fetcher pairing in exactly one place.

### Changing data: `useMutation`

Queries are for *reading*; **mutations** are for *writing* (create/update/delete).
They don't run on mount — they run when you call them:

```ts
export const useCreateProduct = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: IProduct) => createProduct(body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
    });
};
```

In a component this will look like:

```tsx
const createMutation = useCreateProduct();
createMutation.mutate(newProduct);       // fire it, e.g. in the form's onSubmit
// createMutation.isPending → disable the submit button while saving
```

### `invalidateQueries` — the part that makes it all click

Here's the problem it solves. Suppose the product list is cached, and I add a new
product. The server now has 3 products; my cache still says 2. Stale UI.

The fix is that `onSuccess` line: after the mutation succeeds,
`invalidateQueries({ queryKey: productKeys.all })` tells the cache *"whatever you
have under `['products']` is now out of date."* TanStack Query then automatically
refetches it (immediately, if any component on screen is using it), and every
component showing the list re-renders with fresh data.

That's the whole loop:

```
mutate() → server changes → onSuccess → invalidate ['products'] → auto refetch → UI updates
```

No manual `setProducts([...products, newOne])` state juggling, no passing callbacks
between pages. The form page and the list page don't even need to know about each
other — they're connected only through the query key.

`useUpdateProduct` and `useDeleteProduct` follow the identical pattern. One quirk:
`mutationFn` accepts only **one argument**, so the update hook bundles its two values
into a single object:

```ts
mutationFn: ({ id, body }: { id: number; body: IProduct }) => updateProduct(id, body),
// called as: updateMutation.mutate({ id: 5, body: editedProduct })
```

---

## Things that tripped me up / notes to self

- **The query key is the contract.** Query and invalidation must use the same key —
  that's why `productKeys` exists. As the app grows, this becomes a "key factory"
  with entries like `productKeys.detail(id)` for single products.
- **⚠️ `createProduct` takes a full `IProduct` — including `id`.** But the server
  generates the id itself and ignores whatever I send. The honest type would be
  `Omit<IProduct, 'id'>` ("an IProduct minus its id"). Works fine today, but the
  type is lying slightly. On the fix list.
- **⚠️ `getProduct` has no hook yet.** The API function exists, but there's no
  `useProduct(id)` — which the view/edit pages need. It'll want its own cache
  address per product, something like `['products', id]`.
- **TypeScript generics on axios are trust, not validation.** `get<IProduct[]>` types
  the response but never checks it at runtime. Zod could close that gap later.
- **Minor naming inconsistency:** `products.api.ts` (plural) vs `product.query.ts` /
  `product.types.ts` (singular). Harmless, but worth picking one style before more
  features copy the pattern.

## What's next

- [ ] Wire `useProducts()` into `ProductList` — render data, `isPending`, `isError`
- [ ] Add `useProduct(id)` with key `['products', id]` for the view/edit pages
- [ ] Wire `ProductForm` to `useCreateProduct` / `useUpdateProduct` (and use
      `isPending` to disable the submit button)
- [ ] Change `createProduct`'s body type to `Omit<IProduct, 'id'>`
- [ ] Delete button on the list using `useDeleteProduct`
