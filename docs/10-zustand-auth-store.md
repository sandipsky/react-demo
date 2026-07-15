# 10 — Global State with Zustand: An Auth Store

**Date:** 2026-07-15

## What I set out to do

After entry 09, my auth state worked but was **scattered**: I read
`localStorage.getItem('token')` directly in three different places (the axios client,
the route guard, and the login page set it). If I ever changed how auth worked, I'd
have to hunt down every spot. This session I learned **Zustand** — a tiny global-state
library — and used it to pull all that auth state into **one store**. As a bonus, it
knocked out two leftovers from entry 09: storing the `user` (not just the token) and
having a real `logout`.

---

## The big idea: client state vs server state

This was the concept I had to get straight before writing a line, because my app
*already* has a state library — TanStack Query (entries 04–08). Don't they overlap?
No — they're for **two different kinds of state**:

| | **Server state** → TanStack Query | **Client state** → Zustand |
|---|---|---|
| What | Data the server owns | Data only the browser cares about |
| In my app | products, single product | **auth token, logged-in user** |
| Source of truth | the backend | the app itself |

⚠️ **The trap I now know to avoid:** don't copy fetched data (like products) into
Zustand. TanStack Query already caches and refetches that (entry 05). Auth is a
perfect fit for Zustand because the *token* isn't server data I re-fetch — it's session
state the app holds onto.

---

## Part 1 — Installing & building the store

`npm install zustand` (it's now in `package.json`), then a new file:

```ts
// src/features/auth/auth.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  user: { id: number; name: string; email: string } | null
  setAuth: (token: string, user: AuthState['user']) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'auth' },   // localStorage key
  ),
)
```

Unpacking the new stuff:

- **`create(...)`** makes the store. The function it takes receives **`set`** (the
  updater, just like `setState`) and returns the initial state **plus actions** —
  functions that call `set` to change things. So the state (`token`, `user`) and the
  logic that changes it (`setAuth`, `logout`) live together in one place. That
  co-location is the thing I was missing when auth was scattered.
- **`persist(...)`** is *middleware* — a wrapper that adds behavior. This one
  automatically saves the store to `localStorage` (under the key `"auth"`) and reloads
  it on refresh. So I get persistence for free, and it **replaces my manual
  `localStorage.setItem/getItem`** from entry 09. And now the `user` is saved too, not
  just the token.
- The whole thing is exported as **`useAuthStore`** — it's both a hook *and* an object
  with extra methods (more on that below).

---

## Part 2 — Reading the store *inside* a component (selectors)

In `LoginPage`, the manual `localStorage.setItem` became a store action:

```tsx
const setAuth = useAuthStore((s) => s.setAuth);   // grab the action at the top

const handleLogin = () => {
  login.mutate({ email, password }, {
    onSuccess: (data) => {
      setAuth(data.token, data.user);   // save token + user in the store
      navigate({ to: '/products' });
    },
  })
}
```

- **`useAuthStore((s) => s.setAuth)`** — that `(s) => s.setAuth` is a **selector**: it
  picks out just the one slice I need. The component then only re-renders when *that
  slice* changes (grabbing the whole store would re-render on every change to any
  field). Selectors are the key habit for keeping Zustand fast.
- **Why grab it at the top, not inside `onSuccess`?** Because `useAuthStore(...)` is a
  hook, and hooks must be called at the **top level of a component** — never inside
  callbacks or conditions (the Rules of Hooks). So I select the action at the top, then
  *call* it (`setAuth(...)`) later inside the callback. Selecting and calling are two
  separate steps.

---

## Part 3 — Reading the store *outside* a component (`.getState()`)

Here's the part that took a real "aha." The axios interceptor and the router's
`beforeLoad` are **not React components** — they're plain functions — so I **cannot**
call the `useAuthStore(...)` hook in them (hooks only work inside components). Zustand's
answer: every store also has a plain **`.getState()`** method for non-React access.

```ts
// apiClient.ts — request interceptor
apiClient.interceptors.request.use((requestConfig) => {
  const token = useAuthStore.getState().token;   // no hook — just read the value
  if (token) requestConfig.headers.Authorization = `Bearer ${token}`;
  return requestConfig;
});
```

```ts
// _authenticated.tsx — the route guard
beforeLoad: ({ location }) => {
  const isAuthenticated = !!useAuthStore.getState().token;   // fresh read each navigation
  if (!isAuthenticated) {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
}
```

Two things I like about this:

- `.getState()` reads the value **fresh at call time** — which is exactly what fixed my
  entry-09 redirect bug (read inside the function, not once at module load). The store
  makes the correct pattern the natural one.
- The guard is still the "bouncer at the door" from entry 01 — it just checks the store
  now instead of poking at `localStorage` directly.

### The rule, boiled down

> **Hook + selector inside components** (`useAuthStore(s => s.x)`).
> **`.getState()` everywhere else** (interceptors, `beforeLoad`, plain functions).

---

## 🐛 Bug I hit: selecting `logout` but never logging out

I wired `logout` into the response interceptor (so an expired 403 session clears
itself). My first attempt was wrong in **two** ways at once:

```ts
// ❌ WRONG — my first attempt
if (error.response?.status === 403) {
  useAuthStore((s) => s.logout)      // two bugs on one line
  window.location.href = '/login';
}
```

1. **Hook outside a component.** The interceptor isn't a component, so calling the
   `useAuthStore(...)` hook here is illegal — React throws "invalid hook call." This
   needs `.getState()`.
2. **Selected but never called.** Even ignoring bug 1, `(s) => s.logout` just *grabs a
   reference* to the function and throws it away — there are no `()`, so it never runs.

The fix does both correctly — read outside React **and** actually call it:

```ts
// ✅ RIGHT
if (error.response?.status === 403) {
  useAuthStore.getState().logout();   // .getState() = no hook; () = actually run it
  window.location.href = '/login';
}
```

Now a 403 wipes `token` + `user` from the store (and, thanks to `persist`, from
localStorage) *before* redirecting — fixing the "stale token loops forever" problem I
flagged in entry 09. The `window.location.href` (full reload, not `navigate`) is
actually good right after logout: it guarantees all in-memory state and the TanStack
Query cache are wiped clean.

**The lesson:** the difference between `LoginPage` and the interceptor isn't style —
it's that one is a component (hooks legal) and one isn't (`.getState()` required). And
selecting a function is not the same as calling it.

---

## What this cleaned up

Before, "am I logged in?" was answered by three separate `localStorage` pokes. Now
there's **one store** and everything reads from it:

| Place | Before (entry 09) | After (Zustand) |
|---|---|---|
| Login success | `localStorage.setItem('token', ...)` | `setAuth(token, user)` |
| API requests | `localStorage.getItem('token')` | `useAuthStore.getState().token` |
| Route guard | `localStorage.getItem('token')` | `useAuthStore.getState().token` |
| 403 / logout | *(nothing — bug!)* | `useAuthStore.getState().logout()` |

One source of truth, and the `user` is finally stored, not just the token.

---

## Things that tripped me up / notes to self

- **Component vs not-a-component decides hook vs `.getState()`.** The single biggest
  takeaway, and the root of the logout bug.
- **Select ≠ call.** `(s) => s.logout` hands me the function; `logout()` runs it.
- **⚠️ No logout *button* yet.** The `logout` action exists and fires on a 403, but
  there's no button for the user to log out on purpose. Easy to add now:
  `const logout = useAuthStore(s => s.logout)` then call it + navigate.
- **⚠️ `?redirect=` still unused.** `LoginPage` always goes to `/products`, ignoring the
  param the guard saves. Still on the list from entry 09.
- **⚠️ `user`'s type is duplicated.** The store types `user` inline as
  `{ id; name; email }`, but `ILoginResponse.user` is still `any` (entry 09). So
  `setAuth(data.token, data.user)` passes `any` into a typed slot — it compiles, but the
  source type is loose. Worth a shared `IUser` type.
- **⚠️ Security, still.** `persist` uses `localStorage` by default, so the same XSS
  caveat from entry 09 applies. Fine for learning.
- **Storage key changed.** Auth now lives under the `"auth"` key as JSON
  (`{ state: { token, user }, version }`), not the old raw `"token"` string. An old
  `"token"` entry from before could linger harmlessly in my browser.

## What's next

- [ ] Add a visible Logout button (in `AuthenticatedLayout`?)
- [ ] Honor `?redirect=` after login instead of always `/products`
- [ ] Give `user` a shared `IUser` type; drop the `any` in `ILoginResponse`
- [ ] Authorization: read `user.role` from the store to gate admin-only UI/routes
- [ ] (Maybe) select `user` in a component to show "Logged in as {name}"
