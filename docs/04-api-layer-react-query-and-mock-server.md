# 04 — The API Layer: Env Config, Axios, TanStack Query & a Mock Server

**Date:** 2026-07-08

## What I set out to do

So far my app has been all frontend — routes and components with hardcoded data.
Real apps talk to a **backend API**. In this session I built everything the app needs
to do that properly:

1. **Environment variables** — so the API URL isn't hardcoded, validated with Zod
2. **An axios API client** — one configured HTTP client for the whole app, with
   interceptors that attach the auth token and handle "you're logged out" responses
3. **TanStack Query** — the library that will manage server data (caching, loading
   states, refetching)
4. **A mock Express server** — a fake backend with login, users, and products, so I
   can build the frontend without waiting for a real backend to exist

The pieces stack like this:

```
Component  →  TanStack Query  →  apiClient (axios)  →  mock server (Express)
                (caching)          (auth header,        (fake database)
                                    base URL)
```

---

## Part 1 — Environment variables (`.env` + Zod validation)

### Why not just hardcode the URL?

The API lives at `http://localhost:3000` on my machine, but in production it'll be a
real domain. Values that change per environment belong in **environment variables**,
not in code.

With Vite, env variables live in `.env` files, and only variables prefixed with
**`VITE_`** are exposed to frontend code (that prefix is a safety feature — it stops
you accidentally leaking server secrets into the browser bundle):

```bash
# .env.example
VITE_APP_ENV=dev
VITE_API_BASE_URL=http://localhost:3000
VITE_API_TIMEOUT=30000
```

Note the split between two files:

- **`.env.example`** — committed to git. Contains no secrets, just documents *which*
  variables the project needs. A new developer copies it to get started.
- **`.env.local`** — my actual values, **git-ignored** (I added it to `.gitignore`).
  Never committed.

### Validating env vars with Zod (`src/config/env.ts`)

Env variables are just strings, and they might be missing or malformed. Instead of
finding that out with a weird crash deep inside axios, I validate them **once, at
startup**, using Zod:

```ts
import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.url('API base URL must be a valid URL'),
  VITE_API_TIMEOUT: z.string().transform((val) => Number.parseInt(val, 10)),
  VITE_APP_ENV: z.enum(['dev', 'prod', 'qa']),
});
```

Cool details I learned:

- **`.transform()`** — env vars are always strings, but I want `timeout` as a number.
  The schema converts it during validation, so the rest of the app never sees the string.
- **`z.enum([...])`** — `VITE_APP_ENV` can *only* be `dev`, `prod`, or `qa`. A typo
  like `developement` fails loudly at startup instead of silently misbehaving.
- **Fail fast** — if anything is invalid, the app throws immediately with a readable
  list of what's wrong, instead of limping along with `undefined` values.

The validated result is exported as a typed `config` object, so everywhere else I
write `config.api.baseUrl` with full autocomplete — no raw `import.meta.env` access
scattered around the app.

---

## Part 2 — The axios API client (`src/lib/apiClient.ts`)

Instead of calling `axios.get(...)` with the full URL everywhere, I create **one
configured instance** that every request goes through:

```ts
export const apiClient = axios.create({
  withCredentials: true,
  baseURL: config.api.baseUrl,
  timeout: config.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

Now `apiClient.get('/products')` automatically means
`GET http://localhost:3000/products` with a 30s timeout. One place to configure,
one place to change.

### Interceptors — the powerful part

Interceptors are functions that run on **every** request or response passing through
the client. Like middleware for HTTP.

**Request interceptor** — attach the auth token to every outgoing request:

```ts
apiClient.interceptors.request.use((requestConfig) => {
  const token = "dummy";   // temporary — will come from real auth state later
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});
```

Without this, every single API call in the app would have to remember to add the
header itself. With it, authentication is invisible to the rest of the code.

**Response interceptor** — handle "you're not logged in" globally:

```ts
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 403) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
```

If *any* request comes back with **403 Unauthorized** (expired/invalid session), the
user gets sent to the login page — no matter which component made the call. This
pairs with the `beforeLoad` guard from entry 01: the router guard protects
*navigation*, the interceptor protects *data calls*.

---

## Part 3 — TanStack Query setup

TanStack Query (React Query) manages **server state**: it caches responses, tracks
loading/error states, and refetches when data goes stale. I haven't written my first
`useQuery` yet — this session was just the setup.

### The query client (`src/lib/queryClient.ts`)

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

What each default means (in human words):

- **`staleTime: 60 * 1000`** — after fetching, data is considered "fresh" for 1
  minute. Fresh data is served straight from cache with **no network request**.
  Navigate away from the products page and back within a minute → instant, no spinner.
- **`gcTime: 5 * 60 * 1000`** — unused cached data is kept in memory for 5 minutes
  before being garbage-collected. Between 1 and 5 minutes you get the *stale* data
  shown instantly while a refetch happens in the background.
- **`retry: 1`** — a failed request is retried once before showing an error
  (the default of 3 makes failures feel slow during development).
- **`refetchOnWindowFocus: false`** — by default, TanStack Query refetches everything
  whenever you click back into the browser tab. Great for dashboards, noisy while
  developing, so I turned it off.

### Wiring it into `AppProviders`

This is exactly why I made `AppProviders` its own component back in entry 01 —
"providers accumulate over time." The second one has arrived:

```tsx
export const AppProviders = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    )
}
```

`QueryClientProvider` wraps the router so that **every routed page** can call
`useQuery`/`useMutation`. `main.tsx` didn't change at all.

I also added `@tanstack/eslint-plugin-query` (dev dependency) — an ESLint plugin that
catches common TanStack Query mistakes, like a broken query key.

---

## Part 4 — The mock Express server (`mock-server/server.js`)

I don't have a real backend, and I don't want to build the frontend against thin air.
So: a small **Express** server that pretends to be my backend. It's a plain
JavaScript file, started separately from the frontend:

```bash
npm run mock-api    # terminal 1 → API on http://localhost:3000
npm run dev         # terminal 2 → app on http://localhost:5173
```

Express and cors are **devDependencies** — they're development tooling, never shipped
to users.

### The "database" is just arrays

```js
let users = [
  { id: 1, name: 'Sandip', email: 'sandip@example.com', password: 'password123' },
]
let products = [
  { id: 1, name: 'Keyboard', price: 2500, description: 'Mechanical keyboard' },
  { id: 2, name: 'Mouse', price: 1200, description: 'Wireless mouse' },
]
```

In-memory data: restart the server, everything resets to the seed data. For a mock,
that's a feature — a clean slate whenever I need one. There's a ready-made login:
**`sandip@example.com` / `password123`**.

### The endpoints

| Method & path | What it does | Status codes |
|---|---|---|
| `POST /auth/login` | Returns `{ token, user }` — the dummy token | 200, 400, 401 |
| `POST /auth/register` | Creates a user (public) | 201, 400, 409 |
| `GET /users`, `GET /users/:id` | List / view users | 200, 404 |
| `POST /users` | Add a user | 201, 400, 409 |
| `PUT /users/:id` | Edit a user | 200, 404, 409 |
| `DELETE /users/:id` | Delete a user | 204, 404 |
| `GET /products`, `GET /products/:id` | List / view products | 200, 404 |
| `POST /products` | Add a product | 201, 400 |
| `PUT /products/:id` | Edit a product | 200, 404 |
| `DELETE /products/:id` | Delete a product | 204, 404 |

Even though it's fake, it uses **real HTTP semantics**: 400 for missing fields, 404
for unknown ids, 409 Conflict for duplicate emails, 204 No Content after a delete.
Building the frontend against realistic responses now means fewer surprises when a
real backend arrives.

### Concepts the server taught me

**CORS.** The app (port 5173) and the API (port 3000) are different *origins*, and
browsers block cross-origin requests by default. The server must explicitly allow it:

```js
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}))
```

`credentials: true` is required because my `apiClient` sets `withCredentials: true` —
with credentials involved, the browser refuses the wildcard `origin: '*'`; the origin
must be spelled out exactly.

**Middleware.** `requireAuth` runs *before* the route handler on protected routes —
same "bouncer at the door" idea as the router's `beforeLoad`, but on the server side:

```js
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(403).json({ message: 'Unauthorized: missing or invalid token' })
  }
  next()  // "you may pass" — continue to the actual route handler
}

app.get('/products', requireAuth, (req, res) => { ... })
```

Any `Bearer <whatever>` is accepted — it's a mock, the point is exercising the
frontend's header-sending and error-handling paths, not real security.

**Never send passwords back.** Even in a mock, user responses strip the password
first. This destructure-and-drop trick is neat:

```js
const toPublicUser = ({ password, ...user }) => user
```

It pulls `password` out and collects *everything else* into `user` — so the returned
object is the user minus the password. Good habit even when the data is fake.

**Update without mutation.** Editing a product builds a new object and a new array —
the same immutability idea as React state (entry 03), which apparently is just a good
way to handle data everywhere:

```js
const updated = {
  ...product,
  ...(name !== undefined && { name }),   // only override fields that were sent
  ...(price !== undefined && { price }),
}
products = products.map((p) => (p.id === id ? updated : p))
```

That `...(condition && { field })` spread trick means a `PUT` with only `{ price }`
updates the price and leaves the other fields alone — a partial update.

---

## Things that tripped up / notes to self

- **The `VITE_` prefix is mandatory.** An env var without it simply doesn't exist in
  frontend code. It's a guard against leaking secrets into the bundle.
- **`.env.example` is committed, `.env.local` is git-ignored.** Template vs real values.
- **⚠️ 401 vs 403 mismatch to resolve:** my `requireAuth` middleware currently returns
  **403** for a missing/invalid token, but the axios interceptor only redirects to
  `/login` on **401**. HTTP convention: 401 = "not authenticated (who are you?)",
  403 = "authenticated but not allowed (I know who you are — no)". So for a missing
  token, 401 is the conventional choice — and it's what my interceptor listens for.
  Either the middleware should return 401, or the interceptor should also handle 403.
- **zod is missing from `package.json`.** `env.ts` imports it, and it works only
  because some other package happened to install it transitively. On a fresh clone it
  would break. Fix: `npm install zod`.
- **The token is still fake everywhere** — the interceptor hardcodes `"dummy"`, and
  login isn't wired to a form yet. Real auth state is the next big topic.

## What's next

- [ ] `npm install zod` to make it an explicit dependency
- [ ] Fix the 401/403 mismatch between mock server and interceptor
- [ ] Build the login form and call `POST /auth/login`, store the returned token
- [ ] Replace the hardcoded `"dummy"` token in the request interceptor with the real one
- [ ] First `useQuery`: fetch `/products` in `ProductList`
- [ ] First `useMutation`: wire `ProductForm` to POST/PUT/DELETE
