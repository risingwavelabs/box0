import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/tasks', replace: true })
  },
  component: () => null,
})
