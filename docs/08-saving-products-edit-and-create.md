# 08 — Making the Form Actually Save: Create & Edit Products

**Date:** 2026-07-14

## What I set out to do

Entry 07 left `ProductForm` half-finished: it could *show* a product (view mode) and
it had input boxes for add/edit, but the boxes did nothing — no Save button wired up,
the edit form didn't pre-fill, and it even fired a pointless request in add mode. This
session I closed all of that out. By the end, the form can genuinely **create** a new
product and **edit** an existing one, then send me back to the list.

This entry basically works through entry 07's "What's next" checklist:

- [x] Only fetch in edit/view mode (not add)
- [x] Pre-fill the edit form from the fetched product
- [x] Wire Save to `useCreateProduct` / `useUpdateProduct`
- [x] Convert `price` to a number before sending

---

## Part 1 — Only fetch when there's actually a product (`enabled`)

In entry 07 I flagged a bug: in **add** mode there's no `productId`, so
`Number(undefined)` is `NaN`, and the fetch hook still ran — firing a doomed request
for `/products/NaN`. The fix is TanStack Query's **`enabled`** option, which I threaded
through my hook:

```ts
// product.query.ts
export const useGetProduct = (id: number, enabled: boolean) => {
    return useQuery({
        queryKey: productKeys.detail(id),
        queryFn: () => getProduct(id),
        enabled                        // when false, the query stays idle — no request
    });
};
```

And in the form I pass `mode !== 'add'`:

```tsx
const { data, isLoading, isError } = useGetProduct(Number(productId), mode !== 'add');
```

So view and edit fetch; add stays quiet. `enabled: false` means the query just sits
there in an idle state and never touches the network — exactly what I want when
there's nothing to load yet. (This is the same option you'd use for "don't search
until the user has typed something.")

---

## Part 2 — Pre-filling the edit form (`useEffect`)

The other entry-07 gap: in edit mode the inputs started empty instead of showing the
product's current values. The problem is timing — my inputs are controlled by
`useState` starting at `""`, but the fetched `data` arrives *later*, asynchronously.
On the first render `data` is still `undefined`, so I can't seed `useState` from it.

The tool for "do something when async data arrives" is `useEffect`:

```tsx
useEffect(() => {
  if (data) {
    setName(data.name);
    setPrice(String(data.price));     // price is a number in data, but state is string
    setDescription(data.description);
  }
}, [data]);                           // re-run whenever `data` changes
```

How it plays out:

- First render: `data` is `undefined`, the `if (data)` guard fails, nothing happens.
- Fetch resolves: `data` becomes the product, its reference changes, the effect re-runs
  (because `data` is in the dependency array `[data]`), and the three fields fill in.
- Add mode: the query is disabled, `data` stays `undefined`, so the effect never fills
  anything — inputs stay empty. Perfect.

⚠️ One thing I now understand is a *known* trade-off, not a bug: this copies server
data into local state, so if the product ever refetched in the background, the effect
would overwrite whatever I'd typed. Fine for this app, but "server data → form state"
is a genuinely fiddly area in bigger apps.

> Why not just call `setName(data.name)` directly in the component body instead of an
> effect? Because calling a state setter during render triggers another render, which
> sets state again → an infinite loop. React literally warns about this. Copying
> external data into state is what `useEffect` is *for*.

---

## Part 3 — The Save handler (the main event)

I call both mutation hooks (from entry 05) near the top — hooks must run
unconditionally, and they don't do anything until I call `.mutate()`:

```tsx
import { useNavigate } from "@tanstack/react-router"

const navigate = useNavigate();
const createProduct = useCreateProduct();
const updateProduct = useUpdateProduct();
```

Then `handleSave` decides which mutation to fire based on `mode`:

```tsx
const handleSave = () => {
  if (!name || !price) return;                    // guard: don't save empty

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
```

The pieces that clicked for me:

- **`Number(price)`** — the input state is a string (`useState<string>`), but the API
  and `IProduct` want a number. Same string↔number seam as the route params from entry
  02 and the pre-fill above. I keep meeting it.
- **The two mutations take different arguments.** `updateProduct.mutate` wants
  `{ id, body }` (that's the `mutationFn: ({ id, body }) => ...` shape from entry 05),
  while `createProduct.mutate` takes the body directly. That asymmetry is why the
  branches look different.
- **The second argument to `.mutate(...)` is per-call options.** Its `onSuccess` runs
  *after this specific save succeeds* — I use it to `navigate` back to the list. This
  runs **in addition to** the `onSuccess` already inside the hook (which does
  `invalidateQueries`). So on a successful save, two things happen: the cache is
  invalidated *and* I get redirected.

### Why the list is already up-to-date when I land

This is the part I find genuinely satisfying. I don't manually add the new product to
any list. Because `useCreateProduct`/`useUpdateProduct` call
`invalidateQueries({ queryKey: productKeys.all })` on success (entry 05), the moment
`navigate({ to: '/products' })` lands me on the list, TanStack Query sees the
`['products']` cache is stale and refetches it — so my new/edited product is just
*there*. The form page and the list page never talk to each other directly; they're
connected only through the query key.

The full loop:

```
handleSave → mutate → server saves → hook onSuccess invalidates ['products']
           → per-call onSuccess navigates to /products → list refetches → fresh data
```

---

## Part 4 — `useNavigate` for the redirect

```tsx
const navigate = useNavigate();
// ...
navigate({ to: '/products' });
```

`useNavigate` is TanStack Router's hook for moving around **in code** (as opposed to a
`<Link>` the user clicks — entry 07). Same type-safety perk as links: if I typo
`/product` it won't compile. I call it inside `onSuccess` so the redirect only happens
*after* the save actually succeeds — never navigate away from a save that failed.

---

## Things that tripped me up / notes to self

- **Mutations vs queries, one more time.** Save is a mutation: I *call* it with an
  argument (`.mutate(body)`). Fetching is a query: it runs itself from a key. Getting
  this straight (after the entry 07 bug) made this whole session smooth.
- **⚠️ Editing doesn't refresh the single-product cache.** `useUpdateProduct`
  invalidates `['products']` (the list) but not `['product', id]` (the detail). So
  right after editing, a View might show stale data until it goes stale on its own.
  Fix: also invalidate `productKeys.detail(id)` in the update hook's `onSuccess`.
- **⚠️ No "saving..." state or disabled button.** A fast double-click could fire two
  saves. `disabled={createProduct.isPending || updateProduct.isPending}` on the button
  would fix it. Left out for now.
- **⚠️ Weak validation.** I only check `name` and `price` are non-empty. If I type
  "abc" into price, `Number("abc")` is `NaN` and I'd send junk. Real validation (Zod?)
  is a future topic.
- **⚠️ The `id` in the create body is still a white lie** — the server generates the id
  and ignores mine; it's only there to satisfy the `IProduct` type. `Omit<IProduct,
  'id'>` remains the honest fix (first noted in entry 05).
- **Leftover typo:** view mode still says "Error has occured" (should be "occurred")
  and throws away the real `error.message`.

## What's next

- [ ] Invalidate `productKeys.detail(id)` after an edit
- [ ] Disable Save while `isPending`, show a "Saving..." state
- [ ] Proper form validation (numeric price, required fields) — maybe with Zod
- [ ] Switch the create body type to `Omit<IProduct, 'id'>`
- [ ] Show a success message / toast instead of a silent redirect
