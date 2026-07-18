# 09 — Real Login Authentication (Token, Guard & Interceptor)

**Date:** 2026-07-15

## What I set out to do

Up to now, being "logged in" was faked in three places — `isAuthenticated = true`
hardcoded in the route guard, a `"dummy"` token in the axios client, and a login page
that did nothing. This session I replaced all three fakes with a **real login flow**:

1. Type email + password → call `POST /auth/login`
2. Get a token back → store it in `localStorage`
3. Send that token on every API request (the interceptor from entry 04, for real)
4. The route guard (entry 01) now checks for a real token, not a hardcoded `true`

By the end, logging in actually logs me in, and visiting a protected page without a
token bounces me to `/login`.

---

## Part 1 — The auth feature files

I made a new `src/features/auth/` feature, same shape as products (entry 02): types,
an api function, a query hook, a component, and a barrel.

### The types (`auth.types.ts`)

```ts
export interface ILoginBody {
    email: string;
    password: string
}

export interface ILoginResponse {
    token: string;
    user: any;
}
```

`ILoginBody` is what I *send*; `ILoginResponse` is what the server *returns* — a token
and a user. (⚠️ `user: any` is a placeholder — `any` turns off type-checking for that
field. I'll give it a real `IUser` shape once I actually use the user data.)

### The API call (`auth.api.ts`)

```ts
import { apiClient } from '@/lib'
import type { ILoginBody, ILoginResponse } from './auth.types';

export const login = async (body: ILoginBody) => {
  const res = await apiClient.post<ILoginResponse>('/auth/login', body)
  return res.data
}
```

Exactly the pattern from entry 05's products API — a thin typed wrapper that returns
`res.data`. Because it goes through `apiClient`, it automatically gets the base URL and
timeout. (It doesn't need a token itself — logging in is how you *get* the token.)

### The hook (`auth.query.ts`)

```ts
import { useMutation } from '@tanstack/react-query'
import { login } from './auth.api'

export const useLogin = () => useMutation({ mutationFn: login })
```

Logging in is a **mutation**, not a query — it's an action I trigger, not data I read
(same reasoning as saving a product in entry 08). Notice there's no `onSuccess` with
`invalidateQueries` here like the product mutations had — logging in doesn't make any
cached list stale, so there's nothing to invalidate.

---

## Part 2 — The login page (`components/LoginPage.tsx`)

```tsx
export const LoginPage = () => {
    const login = useLogin();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = () => {
        login.mutate(
            { email, password },
            {
                onSuccess: (data) => {
                    localStorage.setItem('token', data.token);
                    navigate({ to: '/products' });
                },
            },
        )
    }

    return (
        <>
            <h1>Login</h1>
            <div>
                <label>Username</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="text" />
            </div>
            <div>
                <label>Password</label>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
            </div>
            <button onClick={handleLogin} disabled={login.isPending}>Login</button>
            {login.isError && login.error.message}
        </>
    )
}
```

The moving parts:

- **Controlled inputs** (entry 03) — `value` + `onChange` — are what let `handleLogin`
  actually read what was typed. Without them the inputs would be uncontrolled and I
  couldn't get the values.
- **`login.mutate({ email, password }, { onSuccess })`** — fire the mutation with the
  form values, and in the per-call `onSuccess` (entry 08) do the two things that
  "being logged in" means: save the token, then navigate into the app.
- **`localStorage.setItem('token', data.token)`** — `localStorage` is browser storage
  that survives refreshes and tab closes (unlike a React state variable, which resets
  on reload). That persistence is the whole point — I stay logged in across refreshes.
- **`disabled={login.isPending}`** — the button disables itself while the request is in
  flight, so I can't double-submit. (This is the pattern I said I'd add for the product
  form back in entry 08, applied here from the start.)
- **`{login.isError && login.error.message}`** — show the error if login fails.

Then the route file just points at it (thin routes, entry 02):

```tsx
// src/routes/login.tsx
import { LoginPage } from '@/features/auth'
export const Route = createFileRoute('/login')({ component: LoginPage })
```

---

## Part 3 — Using the real token everywhere

Two placeholders finally became real.

### The axios interceptor (`apiClient.ts`)

```diff
 apiClient.interceptors.request.use((requestConfig) => {
-  const token = "dummy";
+  const token = localStorage.getItem('token');
   if (token) {
     requestConfig.headers.Authorization = `Bearer ${token}`;
   }
   return requestConfig;
 });
```

This is the entry-04 request interceptor doing its real job now: before every request
leaves, it reads the stored token and attaches it as a `Bearer` header. Every product
call I've made is now authenticated as the logged-in user, automatically — I never
touch headers in my API functions.

### The route guard (`_authenticated.tsx`)

```diff
-//temporary
-const isAuthenticated = true;
-
 export const Route = createFileRoute('/_authenticated')({
   beforeLoad: ({ location }) => {
+    const isAuthenticated = !!localStorage.getItem('token');
     if (!isAuthenticated) {
       throw redirect({ to: '/login', search: { redirect: location.href } })
     }
   },
```

The "bouncer at the door" from entry 01 now checks a real credential — is there a token
in `localStorage`? — instead of always waving everyone through. (`!!` turns the value
into a boolean: a real string → `true`, `null` → `false`.)

---

## 🐛 Bug I hit: the redirect that bounced me right back

While building this, login *looked* broken: I'd log in, the token was clearly being
saved, but I'd immediately end up back on the login page. My first version of the guard
put the check at the **top of the module**:

```ts
// ❌ WRONG — my first attempt
const isAuthenticated = !!localStorage.getItem('token');   // module level!

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    if (!isAuthenticated) { throw redirect({ to: '/login', ... }) }
  },
  ...
})
```

**Why it fails:** module-level code runs **once**, when the file is first imported at
app startup. At startup there's no token, so `isAuthenticated` is captured as `false`
and frozen forever. So after logging in:

1. Token gets saved ✅
2. `navigate({ to: '/products' })` fires ✅
3. `/products` is protected, so `beforeLoad` runs
4. It checks the **stale `false`** from startup — not a fresh read
5. → throws redirect back to `/login`

The navigate worked; the guard was just looking at a snapshot from before I logged in
and kicking me out again.

```ts
// ✅ RIGHT — read inside beforeLoad, so it runs fresh every navigation
beforeLoad: ({ location }) => {
  const isAuthenticated = !!localStorage.getItem('token');
  if (!isAuthenticated) { throw redirect({ to: '/login', ... }) }
}
```

**The lesson:** *module-level code runs once at import; function-body code runs every
time the function is called.* Anything that changes over the app's life — like "am I
logged in?" — must be read **inside** the function that needs it. `beforeLoad` runs on
every navigation, so the check has to live there.

---

## Things that tripped me up / notes to self

- **Once vs every time.** The core lesson from the bug above — the single most useful
  thing I learned this session.
- **⚠️ Logout isn't wired up.** There's no logout button, and the response interceptor
  still redirects on 403 **without clearing the token** (the old `//todo logout func`).
  So an expired token would loop: redirect to login, but the stale token's still there.
  Logout needs to `localStorage.removeItem('token')`.
- **⚠️ I built a `?redirect=` param but don't use it.** The guard saves where I was
  headed into `search.redirect`, but `LoginPage` always navigates to `/products`,
  ignoring it. Next step: read that param and go back there after login.
- **⚠️ `user: any`.** No real type on the returned user yet, and I'm not even storing
  the user — only the token. Authorization (roles) will need the user object.
- **⚠️ Security note (localStorage).** A token in `localStorage` is readable by any JS
  on the page, so it's XSS-exposed. Fine for learning; production would lean toward an
  httpOnly cookie (and `apiClient` already has `withCredentials: true` for that day).
- **Small stuff:** the label says "Username" but it's really an email; and `isError`
  shows axios's generic `"Request failed with status code 401"`, not the server's nicer
  `"Invalid email or password"` message.
- Reminder of the seeded login: `sandip@example.com` / `password123`.

## What's next

- [ ] Logout: clear the token + redirect, and clear it in the 403 interceptor too
- [ ] After login, honor the `?redirect=` param instead of always going to `/products`
- [ ] Store the `user` too, give it a real `IUser` type (drop the `any`)
- [ ] Authorization: use `user.role` to gate admin-only UI and routes
- [ ] Show the server's real error message on failed login
