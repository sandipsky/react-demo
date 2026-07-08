# 01 — Setting up TanStack Router with Authenticated Routes

**Date:** 2026-07-08

## What I set out to do

When you create a React app with Vite, you get a single page — one `App.tsx` with a
spinning logo and a counter. Real apps aren't like that. Real apps have **pages**:
a login page, a dashboard, a settings page, and so on. And some of those pages should
only be visible if you're logged in.

The tool that handles "which component shows up for which URL" is called a **router**.
I chose **TanStack Router** because it has great TypeScript support and something called
*file-based routing*, which I'll explain below.

So in this session I:

1. Deleted the Vite starter code (`App.tsx`, `App.css`, and most of `index.css`)
2. Installed TanStack Router
3. Set up **file-based routing** (routes are created by making files in a folder)
4. Created a **login page** and a **protected (authenticated) area**
5. Learned how to **redirect** users who aren't logged in

---

## Step 1 — Installing the packages

I added three packages (you can see them in `package.json`):

```jsonc
"dependencies": {
  "@tanstack/react-router": "...",           // the router itself
  "@tanstack/react-router-devtools": "..."   // a debugging panel (like React DevTools, but for routes)
},
"devDependencies": {
  "@tanstack/router-plugin": "..."           // a Vite plugin — this is what makes file-based routing work
}
```

**Why is `router-plugin` a devDependency?** Because it's a build tool, not something
that runs in the browser. It watches my `src/routes/` folder while I develop and
generates code for me (more on that in Step 3). The user's browser never needs it,
so it doesn't belong in `dependencies`.

---

## Step 2 — Telling Vite about the router plugin

In `vite.config.ts` I added the plugin:

```ts
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    // ...
  ],
})
```

Two things worth understanding here:

- **The plugin must come *before* `react()`** in the plugins list. The router plugin
  transforms my route files first, and then the React plugin processes the result.
- **`autoCodeSplitting: true`** means each page's code is only downloaded when the user
  actually visits that page. Without this, a user visiting the login page would also
  download the code for the dashboard, settings, and every other page. With it, they
  only get what they need. This is called *code splitting* and it makes apps load faster.

### Bonus: the `@` path alias

While I was in the config files, I also set up a **path alias**. Instead of writing
imports like this:

```ts
import { router } from "../../lib/router"   // 😖 how many ../ do I need??
```

I can now write:

```ts
import { router } from "@/lib"              // 😌 @ always means "the src folder"
```

This needed changes in **two places** (this confused me at first — why two?):

1. **`vite.config.ts`** — tells *Vite* (the thing that actually bundles and runs my code)
   what `@` means:
   ```ts
   resolve: {
     alias: {
       '@': fileURLToPath(new URL('./src', import.meta.url)),
     },
   },
   ```
2. **`tsconfig.app.json`** — tells *TypeScript* (the thing that checks my types and powers
   autocomplete in the editor) the same thing:
   ```jsonc
   "paths": {
     "@/*": ["./src/*"]
   }
   ```

They're two separate tools, and each one needs to be told independently. If you only do
the Vite one, your app runs but your editor shows red squiggly errors. If you only do the
TypeScript one, your editor is happy but the app crashes. You need both.

---

## Step 3 — File-based routing: the big idea

This is the coolest part. With TanStack Router, **I don't write a list of routes in code**.
Instead, the *files and folders* inside `src/routes/` **are** the routes:

```
src/routes/
├── __root.tsx                  → the shell that wraps EVERY page
├── login.tsx                   → the page at /login
├── _authenticated.tsx          → an invisible "gatekeeper" layout (no URL of its own!)
└── _authenticated/
    └── index.tsx               → the page at / (the home page, behind the gatekeeper)
```

When I create a file in this folder, the `router-plugin` I installed in Step 2 notices it
and automatically regenerates a file called `src/routeTree.gen.ts`. That file contains the
full "map" of all my routes, with full TypeScript types.

> **Important:** `routeTree.gen.ts` is **generated** — I never edit it by hand. The `.gen`
> in the name is the hint. If I add or delete route files, it updates itself while the
> dev server is running.

The naming conventions took me a moment to learn:

| File name pattern | What it means |
|---|---|
| `__root.tsx` (two underscores) | The root of everything. Every page renders inside this. |
| `login.tsx` | A normal route. The file name becomes the URL: `/login`. |
| `_authenticated.tsx` (one underscore) | A **pathless layout route**. It wraps its children but does **not** add anything to the URL. |
| `index.tsx` | The "default" page of its folder — like `index.html` on a web server. |

### The root route — `__root.tsx`

```tsx
import { Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <React.Fragment>
      <Outlet />
    </React.Fragment>
  )
}
```

The key concept here is **`<Outlet />`**. Think of it as a *placeholder* or a *hole* that
says: "whatever child route matches the current URL, render it right here." Right now my
root component is just the outlet, but later I could add things that should appear on
*every* page — a navbar, a footer, a toast container — around it.

---

## Step 4 — The authenticated area (the part I'm most proud of)

I wanted some pages to be **protected**: if you're not logged in, you get kicked to
`/login`. Here's the clever part — the file `_authenticated.tsx` starts with a single
underscore, which makes it a **pathless layout route**:

- It does **not** appear in the URL. My home page lives at `/`, not at `/_authenticated/`.
- But every route file inside the `_authenticated/` folder renders *inside* it —
  which means they all have to get past its security check first.

Here's the file:

```tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

// temporary — later this will come from real auth state
const isAuthenticated = true;

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    if (!isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: AuthenticatedLayout
})

function AuthenticatedLayout() {
  return <>
    Auth
    <Outlet />
  </>
}
```

Let me break down the pieces that were new to me:

### `beforeLoad` — the bouncer at the door

`beforeLoad` runs **before the route's component renders**. It's like a bouncer at a
club: you get checked at the door, before you're inside. This is much better than
checking auth *inside* the component, because the protected page never even starts
rendering for a logged-out user — not even for a split second.

### `throw redirect(...)` — wait, you can *throw* a redirect?!

This genuinely surprised me. In JavaScript, `throw` is usually for errors. But TanStack
Router uses it as a control-flow trick: throwing immediately stops everything that was
about to happen (loading data, rendering the page), and the router catches the thrown
redirect and navigates to `/login` instead. It's a clean way to say "STOP. Go here
instead."

### `search: { redirect: location.href }` — remembering where you were going

This adds a query parameter to the login URL, so it becomes something like:

```
/login?redirect=/dashboard
```

Why? Imagine you click a link to `/dashboard` but you're logged out. You get sent to
the login page. After you log in… you'd want to end up on `/dashboard`, the page you
originally wanted — not dumped on the home page. By saving the original destination
(`location.href`) in the URL, the login page can send you back there after a
successful login. I haven't built that "send back" part yet, but the information is
already being passed along.

### The `isAuthenticated` flag is fake (for now)

```ts
// temporary
const isAuthenticated = true;
```

Right now it's just hardcoded to `true` so I can build and test the routing structure.
Later, this will come from real authentication state (a context, a store, or a token
check). Flipping it to `false` is a quick way to test that the redirect works — I tried
it, and sure enough, visiting `/` bounced me to `/login`.

### The protected home page — `_authenticated/index.tsx`

```tsx
export const Route = createFileRoute('/_authenticated/')({
  component: RouteComponent,
})
```

Because this file lives inside the `_authenticated/` folder, its URL is just `/`
(remember: the underscore folder adds no URL segment), but it renders inside
`AuthenticatedLayout` and is protected by the `beforeLoad` check. Any new page I drop
into that folder gets protection **for free** — I never have to repeat the auth check.
That's the whole payoff of this pattern.

Meanwhile `login.tsx` sits *outside* the folder, so it's public — which makes sense,
because a logged-out user has to be able to reach the login page!

---

## Step 5 — Wiring the router into the app

Three small files connect everything together.

### `src/lib/router.ts` — creating the router

```ts
import { routeTree } from "@/routeTree.gen"
import { createRouter } from "@tanstack/react-router"

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

The first part is simple: take the auto-generated route map and create a router from it.

The `declare module` block looked like black magic at first. It's called **module
augmentation** — I'm telling TypeScript, globally, "this is MY router, with MY routes."
The payoff is amazing type safety everywhere in the app: if I write
`<Link to="/logn">` (typo!), TypeScript immediately yells at me because `/logn` is not
a route that exists. The router literally knows every valid URL in my app at
compile time.

### `src/providers/AppProviders.tsx` — a home for all providers

```tsx
import { router } from "@/lib"
import { RouterProvider } from "@tanstack/react-router"

export const AppProviders = () => {
    return (
        <RouterProvider router={router} />
    )
}
```

`RouterProvider` is the component that actually looks at the current URL and renders the
matching route. I put it in its own `AppProviders` component instead of directly in
`main.tsx`, because React apps tend to accumulate providers over time (theme provider,
query client provider, auth provider…). When those arrive, they'll all nest neatly in
this one file instead of cluttering the entry point.

### `src/main.tsx` — the entry point

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
)
```

Notice what's gone: there's no `<App />` anymore, because I deleted `App.tsx` entirely.
The router now decides what to render. `main.tsx` stays tiny — it just mounts the app
into the page and turns on `StrictMode` (a development helper that warns about common
mistakes).

---

## How a request flows through all of this

Putting it all together, here's what happens when someone visits `/`:

1. `main.tsx` mounts `<AppProviders />`, which renders `<RouterProvider />`.
2. The router looks at the URL (`/`) and finds the matching route chain:
   `__root` → `_authenticated` → `_authenticated/index`.
3. Before rendering anything, `_authenticated`'s `beforeLoad` runs.
   - Logged out? A redirect is thrown, and the user lands on `/login` instead. Done.
   - Logged in? Continue.
4. `__root.tsx` renders, and its `<Outlet />` renders `AuthenticatedLayout`.
5. `AuthenticatedLayout` renders, and *its* `<Outlet />` renders the home page.

It's outlets all the way down — each layer wraps the next.

---

## Things that tripped me up / notes to self

- **Two config files for one alias.** The `@` alias needs to be set in both
  `vite.config.ts` AND `tsconfig.app.json`. One is for the bundler, one is for the
  type checker. Forgetting either one causes confusing half-broken behavior.
- **`routeTree.gen.ts` is not mine to edit.** It regenerates automatically. If routes
  seem "stuck", restarting the dev server regenerates it.
- **Underscore naming matters a lot.** `_authenticated` (one underscore) = pathless
  layout. `__root` (two underscores) = the special root route. Easy to mistype.
- **`throw redirect()` is intentional**, not an error — that's just how TanStack Router
  does navigation from inside `beforeLoad`.

## What's next

- [ ] Replace the hardcoded `isAuthenticated = true` with real auth state
- [ ] Build an actual login form on `/login`
- [ ] After login, read the `?redirect=` search param and navigate back to it
- [ ] Add the router devtools panel (I installed `@tanstack/react-router-devtools`
      but haven't rendered it yet)
- [ ] Give `AuthenticatedLayout` a real layout — navbar, sidebar, etc.
