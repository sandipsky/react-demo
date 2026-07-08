import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3000

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json())

// ---------------------------------------------------------------------------
// In-memory "database" — resets every time the server restarts
// ---------------------------------------------------------------------------
let users = [
  { id: 1, name: 'Sandip', email: 'sandip@example.com', password: 'password123' },
]
let products = [
  { id: 1, name: 'Keyboard', price: 2500, description: 'Mechanical keyboard' },
  { id: 2, name: 'Mouse', price: 1200, description: 'Wireless mouse' },
]
let nextUserId = 2
let nextProductId = 3

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

  const user = users.find((u) => u.email === email && u.password === password)
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
  if (users.some((u) => u.email === email)) {
    return res.status(409).json({ message: 'A user with this email already exists' })
  }

  const user = { id: nextUserId++, name, email, password }
  users.push(user)
  res.status(201).json(toPublicUser(user))
})

// ---------------------------------------------------------------------------
// Users (protected)
// ---------------------------------------------------------------------------
app.get('/users', requireAuth, (req, res) => {
  res.json(users.map(toPublicUser))
})

app.get('/users/:id', requireAuth, (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id))
  if (!user) return res.status(404).json({ message: 'User not found' })
  res.json(toPublicUser(user))
})

app.post('/users', requireAuth, (req, res) => {
  const { name, email, password } = req.body ?? {}
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email and password are required' })
  }
  if (users.some((u) => u.email === email)) {
    return res.status(409).json({ message: 'A user with this email already exists' })
  }

  const user = { id: nextUserId++, name, email, password }
  users.push(user)
  res.status(201).json(toPublicUser(user))
})

app.put('/users/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const user = users.find((u) => u.id === id)
  if (!user) return res.status(404).json({ message: 'User not found' })

  const { name, email, password } = req.body ?? {}
  if (email && users.some((u) => u.email === email && u.id !== id)) {
    return res.status(409).json({ message: 'A user with this email already exists' })
  }

  const updated = {
    ...user,
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(password !== undefined && { password }),
  }
  users = users.map((u) => (u.id === id ? updated : u))
  res.json(toPublicUser(updated))
})

app.delete('/users/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  if (!users.some((u) => u.id === id)) {
    return res.status(404).json({ message: 'User not found' })
  }
  users = users.filter((u) => u.id !== id)
  res.status(204).end()
})

// ---------------------------------------------------------------------------
// Products (protected)
// ---------------------------------------------------------------------------
app.get('/products', requireAuth, (req, res) => {
  res.json(products)
})

app.get('/products/:id', requireAuth, (req, res) => {
  const product = products.find((p) => p.id === Number(req.params.id))
  if (!product) return res.status(404).json({ message: 'Product not found' })
  res.json(product)
})

app.post('/products', requireAuth, (req, res) => {
  const { name, price, description } = req.body ?? {}
  if (!name || price === undefined) {
    return res.status(400).json({ message: 'name and price are required' })
  }

  const product = { id: nextProductId++, name, price, description: description ?? '' }
  products.push(product)
  res.status(201).json(product)
})

app.put('/products/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const product = products.find((p) => p.id === id)
  if (!product) return res.status(404).json({ message: 'Product not found' })

  const { name, price, description } = req.body ?? {}
  const updated = {
    ...product,
    ...(name !== undefined && { name }),
    ...(price !== undefined && { price }),
    ...(description !== undefined && { description }),
  }
  products = products.map((p) => (p.id === id ? updated : p))
  res.json(updated)
})

app.delete('/products/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  if (!products.some((p) => p.id === id)) {
    return res.status(404).json({ message: 'Product not found' })
  }
  products = products.filter((p) => p.id !== id)
  res.status(204).end()
})

app.listen(PORT, () => {
  console.log(`Mock API server running at http://localhost:${PORT}`)
  console.log(`Login with: sandip@example.com / password123`)
})
