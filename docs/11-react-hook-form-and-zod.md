# 11 — React Hook Form + Zod in the Product Form

**Date:** 2026-07-16

## What I set out to do

My `ProductForm` worked (entry 08), but validation was hand-rolled — a weak
`if (!name || !price) return`, three separate `useState`s, a `useEffect` to pre-fill,
and manual `Number(price)` conversions. This session I replaced all of that with two
libraries that are made for exactly this:

- **React Hook Form (RHF)** — manages the form's values, submission, and field states
  (touched, dirty, errors) for me.
- **Zod** — describes the validation rules as a schema (I already met Zod validating
  env vars in entry 04).

They connect through a tiny bridge package, `@hookform/resolvers`.

---

## Part 1 — Installing

```
npm install react-hook-form @hookform/resolvers
```

`react-hook-form` is the form library; `@hookform/resolvers` is the adapter that lets
RHF use a Zod schema for validation. (Zod itself was already a dependency.)

---

## Part 2 — The schema is the single source of truth

```ts
import { z } from 'zod'

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  price: z.number().positive('Price must be greater than 0'),
  description: z.string().min(1, 'Description is required'),
})

type ProductFormValues = z.infer<typeof productSchema>
```

Two things I love here:

- The validation messages (`'Name is required'`) live **in the schema**, right next to
  the rule they belong to.
- **`z.infer<typeof productSchema>`** turns the schema *into* a TypeScript type. So I
  define the rules once and get `{ name: string; price: number; description: string }`
  for free — no separate interface to keep in sync. Schema and type can never drift.

---

## Part 3 — Wiring up `useForm`

```tsx
const {
  register,
  handleSubmit,
  reset,
  formState: { errors, touchedFields, dirtyFields },
} = useForm<ProductFormValues>({
  resolver: zodResolver(productSchema),
  defaultValues: { name: '', price: 0, description: '' },
  mode: 'onTouched',
});
```

- **`resolver: zodResolver(productSchema)`** — this is the bridge. It tells RHF "run
  everything through this Zod schema to decide what's valid."
- **`defaultValues`** — the form's starting values.
- **`mode: 'onTouched'`** — *when* validation runs (see the touched/dirty bug below).

Then the inputs change completely. My old inputs were **controlled** (entry 03) —
`value={name} onChange={...}`, with React state behind each one. RHF inputs are
**uncontrolled**: I just spread `register('name')` onto the input, and RHF wires up the
value/onChange/onBlur/ref internally by reading the DOM through a **ref** (a direct
handle to the DOM element). No `useState` per field.

```tsx
<input type="text" {...register('name')} />
{(touchedFields.name || dirtyFields.name) && errors.name && <p>{errors.name.message}</p>}
```

And submission:

```tsx
<form onSubmit={handleSubmit(onSubmit)}>
```

**`handleSubmit(onSubmit)`** runs the Zod schema first. If validation fails, it fills
`errors` and my `onSubmit` **never runs**. If it passes, `onSubmit` gets clean, typed
values. That single mechanism replaced my old `if (!name || !price) return` guard.

### What disappeared

- 3 × `useState` → RHF holds the values
- manual pre-fill `setName/setPrice/setDescription` → **`reset(data)`** loads all values
  at once (still in a `useEffect` on `[data, reset]`, same async-timing reason as entry
  08)
- `Number(price)` everywhere → the schema handles the number (see the bug below)
- manual empty-check → `handleSubmit` + schema
- as a bonus, it's a real `<form>`, so **Enter submits**

I kept **view mode exactly as it was** — it's not a form, so RHF doesn't touch it.

---

## 🐛 Bug I hit #1: `zod` wasn't actually installed

The moment I imported `z`, TypeScript errored: *"Cannot find module 'zod'."* But zod
was right there in `package.json`, and `env.ts` had been importing it for ages! Running
a typecheck showed `env.ts` was *also* silently broken.

The cause is the **phantom dependency** I first flagged back in entry 04: zod was in
`package.json` but never truly installed — it had only existed in `node_modules`
*transitively* (pulled in by some other package), and that provider was now gone. It
"worked" by luck until I leaned on it directly.

The fix was simply to install it for real:

```
npm install zod
```

**Lesson:** a package must be a real, installed dependency — "it happens to be in
node_modules" is not the same thing. This is exactly the trap the entry-04 notes warned
about, and it finally bit me.

---

## 🐛 Bug I hit #2: `z.coerce.number()` broke the types

My first schema used `z.coerce.number()` (to auto-convert the input's string to a
number). The typecheck then complained that the resolver's types didn't match `useForm`:

```
Type 'unknown' is not assignable to type 'number'
```

**Why:** `z.coerce.number()` accepts *`unknown`* as input (it'll coerce anything) and
outputs a `number`. So the schema's **input** type and **output** type differ, and RHF
got confused about which one the form values are.

**The fix** — keep the schema as a plain `z.number()`, and let RHF do the string→number
conversion at the input with `valueAsNumber`:

```tsx
// schema
price: z.number().positive('Price must be greater than 0'),

// input
<input type="number" {...register('price', { valueAsNumber: true })} />
```

`valueAsNumber: true` tells RHF to hand the field to the schema as a number, so input
and output types line up. Cleaner than juggling coerce, and it kills the manual
`Number(price)` I used to do.

---

## 🐛 Bug I hit #3: the touched/dirty error wouldn't show (`||` vs `&&`)

I wanted the name error to appear only after the field was touched or edited (like
Angular's `(touched || dirty) && invalid`). My first attempt:

```tsx
// ❌ WRONG
{(touchedFields.name || dirtyFields.name) || errors.name && <p>{errors.name.message}</p>}
```

**Why it fails — operator precedence.** `&&` binds tighter than `||`, so JS read it as:

```tsx
{(touchedFields.name || dirtyFields.name)  ||  (errors.name && <p>...</p>)}
```

The moment I touched the field, the left side became `true`, the `||` short-circuited,
and the whole thing returned `true` (which React renders as nothing) — the `<p>` was
never reached. So the error could only show *before* touching, the opposite of what I
wanted.

```tsx
// ✅ RIGHT
{(touchedFields.name || dirtyFields.name) && errors.name && <p>{errors.name.message}</p>}
```

One character: the middle `||` becomes `&&`. Now it reads "if (touched or dirty) **and**
invalid, show the error."

### The other half of that fix: `mode: 'onTouched'`

Even after fixing the operator, the error still didn't show while typing — because
RHF's default `mode` is `'onSubmit'`, so `errors` stays empty until the first Save. I
added `mode: 'onTouched'` so validation runs on blur (then re-checks as I type). The
validation modes:

| `mode` | When it validates |
|---|---|
| `'onSubmit'` (default) | only when Save is clicked |
| `'onBlur'` | when a field loses focus |
| `'onTouched'` | first on blur, then on every change ← Angular-like |
| `'onChange'` | every keystroke |

---

## Things that tripped me up / notes to self

- **Controlled vs uncontrolled.** My todo/login forms are controlled (entry 03); RHF is
  uncontrolled (reads via refs). Both are valid — good to know the difference and why
  RHF is fast (fewer re-renders).
- **Phantom dependencies are real.** `npm install zod` should have happened long ago.
- **`z.infer` = schema becomes the type.** The pattern I'll reuse everywhere.
- **`mode` controls *when*; the resolver controls *what*.** Two separate knobs.
- **⚠️ Only `name` uses the touched/dirty gate.** `price` and `description` still use a
  plain `{errors.x && ...}`. Works (with `onTouched`), but inconsistent — I should pick
  one style for all three.
- **⚠️ The `id` in the create body is still the entry-05 white lie** (server ignores it).
  Unchanged by this work.
- **⚠️ Leftover:** view mode still says "Error has occured" (typo) and ignores
  `error.message`.

## What's next

- [ ] Use the same touched/dirty error style on all three fields (or just `errors.x`)
- [ ] Reuse `productSchema` to validate the API response (Zod's real superpower)
- [ ] Disable Save until the form `isValid` (needs the `isValid` flag)
- [ ] Fix the "Error has occured" typo / show the real error message
