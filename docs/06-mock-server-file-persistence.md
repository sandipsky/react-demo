# 06 — Giving the Mock Server a Real(ish) Database with db.json

**Date:** 2026-07-10

## What I set out to do

Back in entry 04 my mock server kept everything in **in-memory arrays** — plain
`let users = [...]` and `let products = [...]` variables. That worked, but it had one
annoying property: every time I restarted the server, all my changes vanished and it
reset to the two seed products. Add a product, restart, gone.

This session I fixed that by moving the data into a **`db.json` file** that the server
reads from and writes back to. Now data survives restarts. I also filled it with
**50 products** so the product list has something realistic to show.

---

## Part 1 — The data file (`mock-server/db.json`)

The whole "database" is now just a JSON file:

```json
{
  "users": [
    { "id": 1, "name": "Sandip", "email": "sandip@example.com", "password": "password123" }
  ],
  "products": [
    { "id": 1, "name": "Keyboard", "price": 2500, "description": "Mechanical keyboard" },
    { "id": 2, "name": "Mouse", "price": 1200, "description": "Wireless mouse" }
    // ... 48 more, up to id 50
  ]
}
```

It has the same shape as my old in-memory data — a `users` array and a `products`
array — just living on disk instead of in a variable.

---

## Part 2 — Reading and writing the file

At the top of `server.js` I added two tiny helper functions:

```js
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'db.json')

const readDb = () => JSON.parse(readFileSync(DB_PATH, 'utf-8'))
const writeDb = (db) => writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
```

Let me unpack the parts that were new to me:

### Recreating `__dirname` in an ES module

I wanted to load `db.json` from the same folder as `server.js`. Normally you'd use
`__dirname` (Node's "the folder this file lives in"), but **`__dirname` doesn't exist
in ES modules** — and my project uses `"type": "module"` (from entry 01), so all my
files are ES modules. So I had to rebuild it:

- `import.meta.url` — the URL of the current file (something like `file:///C:/.../server.js`)
- `fileURLToPath(...)` — turns that URL into a normal file path
- `dirname(...)` — chops off the filename, leaving just the folder

Then `join(__dirname, 'db.json')` builds the full path to the data file. Using `join`
instead of gluing strings with `/` means it works on Windows and Mac/Linux alike.

### `readDb` / `writeDb`

- **`readFileSync(DB_PATH, 'utf-8')`** reads the file as text, and `JSON.parse` turns
  that text into real JavaScript objects/arrays.
- **`writeDb`** does the reverse: `JSON.stringify(db, null, 2)` turns the data back
  into text (the `2` means "pretty-print with 2-space indents" so the file stays
  human-readable), and `writeFileSync` saves it.

I'm using the **`Sync`** versions on purpose. Normally in Node you avoid synchronous
file calls because they block everything, but for a tiny local mock server it keeps
the code simple and readable — no `async`/`await` or callbacks. Not something I'd do
in a real production backend.

---

## Part 3 — The pattern in every route

The rule is simple and consistent:

- **Reading data (GET)** → `readDb()` at the start, then respond.
- **Changing data (POST / PUT / DELETE)** → `readDb()`, modify, then `writeDb()` to
  save it back.

For example, adding a product went from touching an in-memory array to this:

```js
app.post('/products', requireAuth, (req, res) => {
  const { name, price, description } = req.body ?? {}
  if (!name || price === undefined) {
    return res.status(400).json({ message: 'name and price are required' })
  }

  const db = readDb()                                    // load current data
  const product = { id: nextId(db.products), name, price, description: description ?? '' }
  db.products.push(product)                              // change it
  writeDb(db)                                            // save back to disk
  res.status(201).json(product)
})
```

The read-modify-write shape is the same for users too. Every write ends with
`writeDb(db)` — forget that line and the change would only live in memory and vanish
on restart (which is exactly the old behavior I was trying to escape).

### Generating ids from the file

The old code used counter variables (`let nextProductId = 3`). But counters reset to
their starting value every restart — which would cause **duplicate ids** once the file
has more data than the counter knows about. So I compute the next id from the data
itself:

```js
const nextId = (items) => items.reduce((max, item) => Math.max(max, item.id), 0) + 1
```

In plain words: "look at every item, find the biggest `id`, add 1." Start the running
maximum at `0` so an empty list correctly gives id `1`. Because this reads the actual
file every time, it stays correct across restarts — no counter to fall out of sync.

This is the same "derive it, don't store it separately" lesson as React keys in entry
03: a value you compute from the source of truth can't drift out of sync with it.

---

## Things that tripped me up / notes to self

- **⚠️ `db.json` is now a *live* file that the app rewrites.** This is a double-edged
  sword. It's great that data persists — but it also means my seed data gets
  overwritten as I click around. If I ever want the original 50 products back, I'd
  need a separate seed file (e.g. `db.seed.json`) that I copy over `db.json` to reset.
  Right now there's no reset mechanism. Also worth thinking about whether `db.json`
  should even be committed to git, since it'll be full of my test junk.
- **🐛 A zombie server wasted 10 minutes.** While testing, I saw completely wrong data
  come back — a product I never added, and a missing one. The cause: an **old server
  process from a previous run was still holding port 3000**, so my requests were
  hitting the stale in-memory server, not my new file-backed one. Lesson: if the data
  looks impossible, check for a leftover process:
  ```
  netstat -ano | findstr :3000      # find the PID listening on 3000
  taskkill /F /PID <pid>            # kill it
  ```
  Only one process can own a port, so a "ghost" server silently answering requests is
  a real gotcha.
- **This supersedes entry 04's description of the server.** Entry 04 documented the
  server as in-memory; from now on it's file-backed. The endpoints, status codes, and
  `requireAuth` behavior are all unchanged — only *where the data lives* changed.

## What's next

- [ ] Add a `db.seed.json` + a `reset` script so I can restore the 50 products
- [ ] Decide whether to git-ignore `db.json`
- [ ] (Maybe) switch to async `fs.promises` reads/writes as a learning exercise
