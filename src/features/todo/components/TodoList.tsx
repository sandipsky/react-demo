import { useEffect, useState } from "react"

type TodoItem = {
    id: number,
    name: string
}

export const TodoList = () => {
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [todoInput, setTodoInput] = useState<string>('');
    const [currentTodoId, setCurrentTodoId] = useState<number | null>();

    useEffect(() => {
        setTodos([{id: 1, name: 'First'}])
    }, [])

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

    const editTodo = (todo: TodoItem) => {
        setCurrentTodoId(todo.id);
        setTodoInput(todo.name);
    } 

    const deleteTodo = (id: number) => {
        setTodos(todos.filter(todo => todo.id !== id))
    } 

    return (
        <div>
            Todo List

            <input type="text" value={todoInput} onChange={(e) => setTodoInput(e.target.value)} />
            <button onClick={addTodoItem}>
                Add Todo
            </button>
            {todos.map((todo) => (
                <div key={todo.id}>{todo.name} <button onClick={() => editTodo(todo)}>Edit</button> <button onClick={() => deleteTodo(todo.id)}>Delete</button></div>
            ))}

            {todos.length < 1 && <h1>No Items</h1>}
        </div>
    )
}
