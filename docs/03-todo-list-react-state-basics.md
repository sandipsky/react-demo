# 03 — Todo List: useState, Events, and the "Never Mutate" Rule

**Date:** 2026-07-08

## What I set out to do

Build the classic beginner exercise — a todo list with **add, edit, and delete** —
at `/todo`. It sounds trivial, but it turned out to be the best React lesson so far,
because I hit (and fixed) two very common beginner bugs along the way. This entry
documents the final code in
`src/features/todo/components/TodoList.tsx` *and* the mistakes I made getting there,
because the mistakes taught me more than the working code did.

---

## The state: three `useState` hooks

```tsx
type TodoItem = {
    id: number,
    name: string
}

const [todos, setTodos] = useState<TodoItem[]>([]);
const [todoInput, setTodoInput] = useState<string>('');
const [currentTodoId, setCurrentTodoId] = useState<number | null>();
```

Each piece of state has one clear job:

- **`todos`** — the list itself, an array of `TodoItem` objects.
- **`todoInput`** — whatever is currently typed in the text box.
- **`currentTodoId`** — this one is clever: it doubles as the *mode switch*. When it's
  `null`, the Add button adds a new todo. When it holds an id, the same button
  *updates* that todo instead. One input + one button = both "add" and "edit",
  depending on this value.

### The controlled input

```tsx
<input type="text" value={todoInput} onChange={(e) => setTodoInput(e.target.value)} />
```

This pattern is called a **controlled input**: the input doesn't own its text — React
state does. `value={todoInput}` pushes state *into* the box, and `onChange` pushes
every keystroke *back* into state. The payoff shows up in `editTodo`: I can pre-fill
the box just by calling `setTodoInput(todo.name)`. If the input owned its own text,
I couldn't do that.

### Seeding initial data with `useEffect`

```tsx
useEffect(() => {
    setTodos([{id: 1, name: 'First'}])
}, [])
```

`useEffect` with an **empty dependency array** (`[]`) runs once, after the component
first appears on screen. Right now I use it to fake some initial data; later this is
exactly where fetching from an API would go. (Note: in dev, `StrictMode` deliberately
runs effects twice to expose bugs — that's normal, not broken.)

---

## Add + edit in one function

```tsx
const addTodoItem = () => {
    if (!todoInput.trim()) return;

    if (currentTodoId) {
        setTodos(todos.map(todo =>
            todo.id === currentTodoId ? { ...todo, name: todoInput } : todo
        ));
        setCurrentTodoId(null);
    }
    else {
        setTodos([...todos, {
            id: todos.length + 1,
            name: todoInput
        }])
    }
    setTodoInput('');
}
```

Walking through it:

- **The guard clause** `if (!todoInput.trim()) return;` — bail out early on empty or
  whitespace-only input. Guard clauses at the top keep the rest of the function clean.
- **Edit branch**: `.map()` builds a **new** array where the matching todo is replaced
  by a **new** object (`{ ...todo, name: todoInput }` = "copy all fields, override
  `name`") and every other todo passes through unchanged.
- **Add branch**: `[...todos, newItem]` builds a new array with the old items plus one.
- Either way, finish by clearing the input.

### 🐛 Bug #1 I hit: mutating state directly

My first version of the edit branch was this:

```tsx
// ❌ WRONG — my first attempt
const todoItem = todos.find(todo => todo.id === currentTodoId);
todoItem.name = todoInput;
```

Looks reasonable, right? Find the item, change its name. But `find()` returns a
**reference** to the actual object inside React's state — so this line secretly edits
state **without calling `setTodos`**. And React only re-renders when a setter hands it
a **new** array; it never inspects the contents of the old one. So my change was
invisible to React. (It *appeared* to work only because `setTodoInput('')` on the next
line happened to trigger a render — a coincidence, not correctness.)

**The rule I learned: never assign into state. Always build a new array/object and
pass it to the setter.** Each operation has a standard tool:

| Operation | Pattern |
|---|---|
| Add | `setTodos([...todos, newItem])` |
| Edit one | `setTodos(todos.map(t => t.id === id ? { ...t, name: newName } : t))` |
| Delete one | `setTodos(todos.filter(t => t.id !== id))` |

No `push`, no `splice`, no `item.field = x`. New arrays, every time.

---

## Edit and delete

```tsx
const editTodo = (todo: TodoItem) => {
    setCurrentTodoId(todo.id);
    setTodoInput(todo.name);
}

const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id))
}
```

- `editTodo` doesn't change the list at all! It just flips the component into "edit
  mode": remember which id we're editing, and pre-fill the input. The actual saving
  happens later in `addTodoItem`.
- `deleteTodo` uses `.filter()`, which builds a new array containing every todo
  *except* the matching one — the immutable way to delete.

---

## Rendering the list

```tsx
{todos.map((todo) => (
    <div key={todo.id}>
        {todo.name}{' '}
        <button onClick={() => editTodo(todo)}>Edit</button>{' '}
        <button onClick={() => deleteTodo(todo.id)}>Delete</button>
    </div>
))}

{todos.length < 1 && <h1>No Items</h1>}
```

Three concepts packed in here:

### `key={todo.id}`

When rendering a list, React needs a stable identity for each item so it can tell
"item moved" apart from "item changed". The `key` prop is that identity. It should be
the item's **id**, not the array index — indexes shift when items are deleted, which
confuses React into recycling the wrong DOM.

### 🐛 Bug #2 I hit: calling the handler instead of passing it

My first version was:

```tsx
// ❌ WRONG — my first attempt
<button onClick={editTodo(todo)}>Edit</button>
```

TypeScript stopped me with: *"Type 'void' is not assignable to type
'MouseEventHandler'"*. The problem: `onClick` wants **a function to call later, when
the click happens**. But `editTodo(todo)` — with parentheses — runs *immediately,
during render*, and hands `onClick` the function's return value (`void`, i.e.
nothing). Worse, running `setCurrentTodoId` during render would cause an infinite
re-render loop.

The fix is to wrap it in an arrow function, which *is* a function React can call later:

```tsx
// ✅ RIGHT
<button onClick={() => editTodo(todo)}>Edit</button>
```

My rule of thumb now:

- No arguments needed → pass the function itself: `onClick={addTodoItem}`
- Arguments needed → wrap it: `onClick={() => editTodo(todo)}`

If you ever see parentheses directly inside `onClick={...}`, it's almost certainly
running too early.

### Conditional rendering with `&&`

```tsx
{todos.length < 1 && <h1>No Items</h1>}
```

In JSX, `condition && <Something />` renders the element only when the condition is
true. It works because `&&` short-circuits: if the left side is false, the right side
never evaluates, and React renders `false` as nothing.

---

## Wiring it to a route

Same "thin route" pattern as the products pages — the route file is just a pointer:

```tsx
// src/routes/_authenticated/todo/index.tsx
import { TodoList } from '@/features/todo'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/todo/')({
  component: TodoList,
})
```

Living under `_authenticated/` means the todo page is automatically login-protected.

---

## Things that tripped me up / notes to self

- **Mutation is the silent killer.** `todoItem.name = x` compiles fine, sometimes even
  *looks* like it works, and is still wrong. React only reacts to new references
  passed through setters. `map` / `filter` / spread are the everyday tools.
- **`onClick={fn(arg)}` runs NOW; `onClick={() => fn(arg)}` runs on click.** The
  TypeScript error about `void` and `MouseEventHandler` means exactly this.
- **`id: todos.length + 1` is a known weak spot.** With 3 todos (ids 1,2,3), deleting
  one makes length 2, so the next todo gets id 3 — a duplicate, which breaks both
  editing and React keys. A never-decreasing counter or `crypto.randomUUID()` fixes
  it. Leaving this on the to-fix list.
- **Keys should be ids, not array indexes.**

## What's next

- [ ] Fix the duplicate-id bug (switch to `crypto.randomUUID()` and a string id)
- [ ] Submit on Enter key, not just the button
- [ ] Change the button label to "Update" while `currentTodoId` is set, plus a
      "Cancel edit" button
- [ ] Persist todos (localStorage first, then a real API)
