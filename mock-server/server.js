import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const app = express()
const PORT = 3000

app.use(
  cors({
    origin: true,          // reflect whatever origin sent the request (allow any)
    credentials: true,
  }),
)
app.use(express.json())

// ---------------------------------------------------------------------------
// File-backed "database" — data lives in db.json and survives restarts.
// We load the whole file into memory at startup, and write the whole thing
// back after every change. Fine for a mock; a real DB would not do this.
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'db.json')

const readDb = () => JSON.parse(readFileSync(DB_PATH, 'utf-8'))
const writeDb = (db) => writeFileSync(DB_PATH, JSON.stringify(db, null, 2))

// Next id = one more than the highest existing id (0 → starts at 1 when empty)
const nextId = (items) => items.reduce((max, item) => Math.max(max, item.id), 0) + 1

const DUMMY_TOKEN = 'dummy-token-12345'

// Strip password before sending a user back to the client
const toPublicUser = ({ password, ...user }) => user

// ---------------------------------------------------------------------------
// Auth middleware — protected routes require an Authorization header.
// Any "Bearer <something>" is accepted; missing/invalid header gets a 403
// (which the frontend interceptor turns into a redirect to /login).
// ---------------------------------------------------------------------------
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(403).json({ message: 'Unauthorized: missing or invalid token' })
  }
  next()
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body ?? {}
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' })
  }

  const db = readDb()
  const user = db.users.find((u) => u.email === email && u.password === password)
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  res.json({ token: DUMMY_TOKEN, user: toPublicUser(user) })
})

app.post('/auth/register', (req, res) => {
  const { name, email, password } = req.body ?? {}
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email and password are required' })
  }

  const db = readDb()
  if (db.users.some((u) => u.email === email)) {
    return res.status(409).json({ message: 'A user with this email already exists' })
  }

  const user = { id: nextId(db.users), name, email, password }
  db.users.push(user)
  writeDb(db)
  res.status(201).json(toPublicUser(user))
})

// ---------------------------------------------------------------------------
// Users (protected)
// ---------------------------------------------------------------------------
app.get('/users', requireAuth, (req, res) => {
  const db = readDb()
  res.json(db.users.map(toPublicUser))
})

app.get('/users/:id', requireAuth, (req, res) => {
  const db = readDb()
  const user = db.users.find((u) => u.id === Number(req.params.id))
  if (!user) return res.status(404).json({ message: 'User not found' })
  res.json(toPublicUser(user))
})

app.post('/users', requireAuth, (req, res) => {
  const { name, email, password } = req.body ?? {}
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email and password are required' })
  }

  const db = readDb()
  if (db.users.some((u) => u.email === email)) {
    return res.status(409).json({ message: 'A user with this email already exists' })
  }

  const user = { id: nextId(db.users), name, email, password }
  db.users.push(user)
  writeDb(db)
  res.status(201).json(toPublicUser(user))
})

app.put('/users/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const db = readDb()
  const user = db.users.find((u) => u.id === id)
  if (!user) return res.status(404).json({ message: 'User not found' })

  const { name, email, password } = req.body ?? {}
  if (email && db.users.some((u) => u.email === email && u.id !== id)) {
    return res.status(409).json({ message: 'A user with this email already exists' })
  }

  const updated = {
    ...user,
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(password !== undefined && { password }),
  }
  db.users = db.users.map((u) => (u.id === id ? updated : u))
  writeDb(db)
  res.json(toPublicUser(updated))
})

app.delete('/users/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const db = readDb()
  if (!db.users.some((u) => u.id === id)) {
    return res.status(404).json({ message: 'User not found' })
  }
  db.users = db.users.filter((u) => u.id !== id)
  writeDb(db)
  res.status(204).end()
})

// ---------------------------------------------------------------------------
// Products (protected)
// ---------------------------------------------------------------------------
app.get('/products', requireAuth, (req, res) => {
  const db = readDb()
  res.json(db.products)
})

app.get('/products/:id', requireAuth, (req, res) => {
  const db = readDb()
  const product = db.products.find((p) => p.id === Number(req.params.id))
  if (!product) return res.status(404).json({ message: 'Product not found' })
  res.json(product)
})

app.post('/products', requireAuth, (req, res) => {
  const { name, price, description } = req.body ?? {}
  if (!name || price === undefined) {
    return res.status(400).json({ message: 'name and price are required' })
  }

  const db = readDb()
  const product = { id: nextId(db.products), name, price, description: description ?? '' }
  db.products.push(product)
  writeDb(db)
  res.status(201).json(product)
})

app.put('/products/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const db = readDb()
  const product = db.products.find((p) => p.id === id)
  if (!product) return res.status(404).json({ message: 'Product not found' })

  const { name, price, description } = req.body ?? {}
  const updated = {
    ...product,
    ...(name !== undefined && { name }),
    ...(price !== undefined && { price }),
    ...(description !== undefined && { description }),
  }
  db.products = db.products.map((p) => (p.id === id ? updated : p))
  writeDb(db)
  res.json(updated)
})

app.delete('/products/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const db = readDb()
  if (!db.products.some((p) => p.id === id)) {
    return res.status(404).json({ message: 'Product not found' })
  }
  db.products = db.products.filter((p) => p.id !== id)
  writeDb(db)
  res.status(204).end()
})

app.listen(PORT, () => {
  console.log(`Mock API server running at http://localhost:${PORT}`)
  console.log(`Login with: sandip@example.com / password123`)
})
