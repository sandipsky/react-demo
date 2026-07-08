import { TodoList } from '@/features/todo'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/todo/')({
  component: TodoList,
})
