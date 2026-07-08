# 02 — Feature Folders & Dynamic Product Routes (Add / Edit / View)

**Date:** 2026-07-08

## What I set out to do

Two things in this session:

1. **Organize my code into a `features/` folder** so the project doesn't turn into a
   mess as it grows.
2. **Build product pages with dynamic URLs** — `/products/add`, `/products/1`,
   `/products/1/edit` — all powered by **one single component**, `ProductForm`.

---

## Part 1 — The `features/` folder structure

Until now, all my components could just float around anywhere in `src/`. That works
for three components, but not for thirty. So I adopted a **feature-based structure**:
code is grouped by *what it's for* (home, products, todo), not by *what it is*
(components, hooks, utils).

```
src/features/
├── home/
│   ├── components/
│   │   └── Home.tsx
│   └── index.ts          ← the "barrel" (explained below)
├── products/
│   ├── components/
│   │   ├── ProductForm.tsx
│   │   └── ProductList.tsx
│   └── index.ts
└── todo/
    ├── components/
    │   └── TodoList.tsx
    └── index.tsx
```

Why I like this: when I work on "products", *everything* about products is in one
folder. Later each feature can grow its own `hooks/`, `api/`, `types/` subfolders
without touching the others.

### Barrel files (`index.ts`)

Each feature has an `index.ts` that just re-exports its public components:

```ts
// src/features/products/index.ts
export { ProductList } from './components/ProductList'
export { ProductForm } from './components/ProductForm'
```

This is called a **barrel file**, and it exists purely to make imports nicer.
Without it:

```ts
import { ProductForm } from '@/features/products/components/ProductForm'  // 😖 long and exposes internals
```

With it:

```ts
import { ProductForm } from '@/features/products'   // 😌 short, and the folder decides what's "public"
```

The barrel acts like the feature's front door. If I later move `ProductForm.tsx` to a
different subfolder, only the barrel file changes — every import in the rest of the
app keeps working.

### Routes stay thin, features hold the real code

An important decision: **route files don't contain UI anymore.** For example, the home
page route went from having its own inline component to just pointing at the feature:

```tsx
// src/routes/_authenticated/index.tsx
import { Home } from '@/features/home'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/')({
  component: Home,
})
```

The `routes/` folder answers "**which URL** shows what?", and the `features/` folder
answers "**what does it look like** and how does it behave?". Two different jobs, two
different folders.

---

## Part 2 — Dynamic routes with a `$` parameter

Here's the routes folder for products:

```
src/routes/_authenticated/products/
├── index.tsx            →  /products              (product list)
├── add.tsx              →  /products/add          (add a product)
└── $productId/
    ├── index.tsx        →  /products/1            (view product 1)
    └── edit.tsx         →  /products/1/edit       (edit product 1)
```

The new concept is the **`$productId` folder**. A file or folder name starting with
`$` is a **dynamic segment**: it's a placeholder that matches *any* value in that
position of the URL. Visit `/products/1` and the router captures `productId = "1"`.
Visit `/products/abc` and it captures `productId = "abc"`.

### "But how does it know `/products/add` isn't a product ID called 'add'?"

This was my first question. The answer: TanStack Router ranks **static segments above
dynamic ones**. `add.tsx` is a static route, so `/products/add` matches it first.
Only URLs that don't match any static route fall through to `$productId`. I didn't
have to configure anything — the naming does it.

### Reading the parameter

Inside a route under the `$productId` folder, I get the value with `Route.useParams()`:

```tsx
// src/routes/_authenticated/products/$productId/edit.tsx
import { ProductForm } from '@/features/products'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/products/$productId/edit')({
  component: ProductEditPage,
})

function ProductEditPage() {
  const { productId } = Route.useParams()
  return <ProductForm mode="edit" productId={productId} />
}
```

The best part: this is fully typed. TypeScript *knows* `productId` exists here,
because the `$productId` folder name told the code generator about it. No casting,
no "maybe undefined" — the filename **is** the type information.

And because all these files live under the `_authenticated/` folder from entry 01,
every product page is automatically behind the login check. I never repeated any
auth code.

---

## Part 3 — One `ProductForm`, three pages

I did **not** want three copies of the same form (imagine adding a "description" field
and having to do it in three files). So all three pages share one component, and a
`mode` prop tells it how to behave:

```tsx
// src/features/products/components/ProductForm.tsx
type ProductFormProps = {
  mode: 'add' | 'edit' | 'view'
  productId?: string          // present for edit + view, absent for add
}

export const ProductForm = ({ mode, productId }: ProductFormProps) => {
  return (
    <>
      <h1>
        {mode == 'edit' ? `Edit mode ${productId}` : mode == 'view' ? `View mode ${productId}` : 'Add mode'}
      </h1>
    </>
  )
}
```

(It only renders a heading for now — the real form fields come later. The point of
this session was getting the *structure* right.)

Then each route file is a tiny 5–10 line shell whose only job is translating
"which URL am I?" into "which mode + which id?":

| Route file | URL | Renders |
|---|---|---|
| `add.tsx` | `/products/add` | `<ProductForm mode="add" />` |
| `$productId/index.tsx` | `/products/1` | `<ProductForm mode="view" productId="1" />` |
| `$productId/edit.tsx` | `/products/1/edit` | `<ProductForm mode="edit" productId="1" />` |

The principle I'm taking away: **routes are thin, components are smart.** The route
knows about the URL; the component knows about the behavior. Neither needs to know
the other's details.

Two nice TypeScript perks of the `mode` prop being a union type
(`'add' | 'edit' | 'view'`):

- My editor autocompletes the three valid values.
- A typo like `mode="edt"` is a compile error, not a silent runtime bug.

---

## Things that tripped me up / notes to self

- **`$` in a filename felt weird** but it's the whole mechanism — the folder name
  `$productId` is simultaneously the URL pattern AND the TypeScript type for params.
- **Static beats dynamic** in route matching, so `add.tsx` safely coexists with
  `$productId/`. No special config needed.
- **Barrel files are for the outside world.** Inside the feature I can import
  directly between files; the barrel is the public doorway for everyone else.

## What's next

- [ ] Build the actual form fields in `ProductForm` (inputs, submit handler)
- [ ] Make `mode="view"` render the fields as read-only/disabled
- [ ] Fill in `ProductList` with real products and `<Link>`s to view/edit pages
- [ ] Fetch the product by `productId` in edit/view mode (probably my excuse to
      learn data fetching properly)
