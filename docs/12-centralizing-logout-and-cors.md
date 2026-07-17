# 12 — Centralizing Logout (and a CORS Tweak)

**Date:** 2026-07-16

## What I set out to do

Two small but satisfying cleanups this session:

1. Add a **Logout button** and make logout live in **one place** — the auth store —
   instead of being half-duplicated across the app.
2. Loosen the mock server's **CORS** rule so any origin can call it.

---

## Part 1 — A logout button in the authenticated layout

`AuthenticatedLayout` wraps every protected page (via `<Outlet />`, entry 01), so a
button here shows on all of them at once:

```tsx
function AuthenticatedLayout() {
  const logout = useAuthStore((s) => s.logout);

  return <>
    Welcome
    <button onClick={logout}>Logout</button>
    <Outlet />
  </>
}
```

`useAuthStore((s) => s.logout)` grabs the `logout` action with a selector — this is a
component, so the hook is fine (the rule from entry 10). Notice `onClick={logout}` has
**no wrapper** and no `navigate` call — because logout now handles its own redirect.
Which is the interesting part...

---

## Part 2 — Moving navigation *into* the store

Originally my logout button did two steps — `logout()` then
`navigate({ to: '/login' })` — and my 403 interceptor did the *same* two steps
separately. Two copies of "what logout means" is asking for them to drift apart. So I
moved the redirect **into the store action itself**:

```ts
// auth.store.ts
logout: () => {
  set({ token: null, user: null });
  window.location.href = '/login';   // full reload clears all state + query cache
},
```

Now `logout()` is the *one* definition of logging out: clear the auth state, then go to
`/login`. Every caller just calls `logout()`.

### Why `window.location.href` and not `navigate`?

The store isn't a React component, so it can't use the `useNavigate` hook. Two ways out:

| Option | Trade-off |
|---|---|
| `window.location.href = '/login'` | ✅ no imports; **full page reload wipes ALL state + the TanStack Query cache** |
| `router.navigate(...)` | client-side, but importing `router` into the store risks a **circular import** (store → lib/router → routeTree → routes → auth → store) |

For logout, the full reload is actually a *feature* — when a session ends I *want*
everything (in-memory state, cached queries) wiped clean. And it dodges the
circular-import trap. So `window.location.href` is the right tool here specifically.

> ⚠️ The trade-off I'm accepting: the store now has a **side effect** (navigation), not
> just pure state. Some folks keep side effects out of stores. For this app the payoff —
> one definition of logout, shared by the button and the interceptor — is worth it. Just
> not a pattern to copy into `setAuth`/login, where I *want* smooth client-side
> `navigate` (which is why `LoginPage` still uses `useNavigate`).

### The payoff: deleting the duplicate

Because `logout()` now redirects, the manual redirect in the 403 interceptor was doing
the same job twice, so I removed it:

```diff
 if (error.response?.status === 403) {
-  useAuthStore.getState().logout()
-  window.location.href = '/login';
+  useAuthStore.getState().logout()
 }
```

(Still `.getState()` here, not the hook — the interceptor isn't a component, entry 10.)
Now there's exactly one place that knows how to log out, and both callers — the button
and the interceptor — go through it. That's the whole point of centralizing.

---

## Part 3 — Allowing any origin (CORS)

Small mock-server change:

```diff
 app.use(
   cors({
-    origin: 'http://localhost:5173',
+    origin: true,          // reflect whatever origin sent the request (allow any)
     credentials: true,
   }),
)
```

The instinct is `origin: '*'`, but that **won't work here** — my `apiClient` sends
`withCredentials: true`, and browsers **forbid the wildcard `*` when credentials are
involved** (the CORS gotcha from entry 04). `origin: true` is the correct move: the
`cors` package **reflects back whichever origin made the request**, so it accepts any
origin *and* stays compatible with credentials.

⚠️ This means *any* website could make authenticated requests to the server — totally
fine for a local mock, but something you'd never do on a real backend (there you list
specific allowed origins).

---

## Things that tripped me up / notes to self

- **One definition, many callers.** The real win: "log out" is defined once in the
  store; the button and the 403 interceptor both delegate to it. No drift.
- **Store side effects are a trade-off.** Navigation in a store isn't "pure," but it's
  pragmatic and DRY here. `window.location` also means the store now assumes a browser
  (would need mocking in a test).
- **`origin: '*'` ✗ with credentials; `origin: true` ✓.** Reflecting the origin is how
  you allow "any" while keeping `withCredentials`.
- This finishes the "add a Logout button" item from entry 10's list. ✅

## What's next

- [ ] Show `Welcome, {user.name}` in the layout by selecting `user` from the store
- [ ] A real nav bar in `AuthenticatedLayout` (links + logout), not just a bare button
- [ ] Lock CORS back down to specific origins if this ever becomes more than a mock
