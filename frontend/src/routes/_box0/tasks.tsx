import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

type BoardView = 'active' | 'done'

type TaskStatus = 'drafted' | 'building' | 'needs_review' | 'done'

type ChatMessage = {
  id: string
  author: 'user' | 'agent'
  authorLabel: string
  body: string
  meta: string
}

type TaskItem = {
  id: string
  title: string
  summary: string
  status: TaskStatus
  owner: string
  dateLabel: string
  model: string
  branch: string
  messages: ChatMessage[]
}

const initialTasks: TaskItem[] = [
  {
    id: 'DAY-002',
    title: 'Implement signed URL uploads for Supabase storage',
    summary:
      'Implement secure file uploads using signed URLs to bypass restrictive storage rules.',
    status: 'needs_review',
    owner: 'WH',
    dateLabel: 'Mar 22',
    model: 'Opus 4.6',
    branch: 'main',
    messages: [
      {
        id: 'msg-1',
        author: 'user',
        authorLabel: 'Wilson Hou',
        body: 'Implement signed URL uploads for Supabase storage',
        meta: '1s ago'
      },
      {
        id: 'msg-2',
        author: 'agent',
        authorLabel: 'Captain Copy',
        body:
          'Task drafted with an upload policy pass, signed URL endpoint, and a frontend handoff for secure browser uploads.',
        meta: 'just now'
      }
    ]
  },
  {
    id: 'DAY-001',
    title: 'Fix submission form getting stuck on "submitting..."',
    summary:
      'Form hangs in loading state when network requests time out or fail silently.',
    status: 'needs_review',
    owner: 'WH',
    dateLabel: 'Mar 22',
    model: 'ChatGPT',
    branch: 'main',
    messages: [
      {
        id: 'msg-3',
        author: 'user',
        authorLabel: 'Wilson Hou',
        body: 'Review performance bugs',
        meta: '1s ago'
      },
      {
        id: 'msg-4',
        author: 'agent',
        authorLabel: 'Captain Copy',
        body: 'Investigating the timeout path and button reset flow before marking this one ready.',
        meta: '4s ago'
      }
    ]
  },
  {
    id: 'DAY-003',
    title: 'Refactor task fetchers behind backend BFF routes',
    summary:
      'Move dashboard reads off direct core access and into backend-owned task endpoints.',
    status: 'building',
    owner: 'CC',
    dateLabel: 'Today',
    model: 'Claude',
    branch: 'feature/bff-tasks',
    messages: [
      {
        id: 'msg-5',
        author: 'user',
        authorLabel: 'Wilson Hou',
        body: 'Move task reads behind the backend API.',
        meta: '12m ago'
      },
      {
        id: 'msg-6',
        author: 'agent',
        authorLabel: 'Captain Copy',
        body: 'The BFF contract is in progress. I am mapping task list, detail, and message endpoints first.',
        meta: '9m ago'
      }
    ]
  },
  {
    id: 'DAY-004',
    title: 'Design kanban-first task control room',
    summary:
      'Turn the tasks page into a planning cockpit with board lanes and an embedded agent chat.',
    status: 'drafted',
    owner: 'CC',
    dateLabel: 'Today',
    model: 'Codex',
    branch: 'feature/kanban-studio',
    messages: [
      {
        id: 'msg-7',
        author: 'user',
        authorLabel: 'Wilson Hou',
        body: 'Tasks page should feel like a task studio, not a table.',
        meta: '18m ago'
      },
      {
        id: 'msg-8',
        author: 'agent',
        authorLabel: 'Captain Copy',
        body: 'Drafted a new board concept with lanes, richer cards, and a task-generation chat rail.',
        meta: '15m ago'
      }
    ]
  },
  {
    id: 'DAY-000',
    title: 'Ship Supabase login experience refresh',
    summary:
      'The updated auth entry flow, OAuth actions, and magic link messaging are complete and verified.',
    status: 'done',
    owner: 'CC',
    dateLabel: 'Mar 21',
    model: 'ChatGPT',
    branch: 'release/auth-refresh',
    messages: [
      {
        id: 'msg-9',
        author: 'user',
        authorLabel: 'Wilson Hou',
        body: 'Refresh the login flow and keep the auth states crisp.',
        meta: 'Yesterday'
      },
      {
        id: 'msg-10',
        author: 'agent',
        authorLabel: 'Captain Copy',
        body: 'Done. Password, magic link, and OAuth all land in a consistent new shell.',
        meta: 'Yesterday'
      }
    ]
  }
]

const laneMeta: Record<
  TaskStatus,
  { label: string; hint: string; dotClass: string; view: BoardView }
> = {
  drafted: {
    label: 'Drafted',
    hint: 'Freshly proposed by the agent',
    dotClass: 'drafted',
    view: 'active'
  },
  building: {
    label: 'Building',
    hint: 'Implementation underway',
    dotClass: 'building',
    view: 'active'
  },
  needs_review: {
    label: 'Needs review',
    hint: 'Ready for human sign-off',
    dotClass: 'needs_review',
    view: 'active'
  },
  done: {
    label: 'Done',
    hint: 'Shipped and archived',
    dotClass: 'done',
    view: 'done'
  }
}

export const Route = createFileRoute('/_box0/tasks')({
  component: TasksPage
})

function shortTitle(prompt: string) {
  const normalized = prompt.trim().replace(/\s+/g, ' ')
  if (normalized.length <= 56) {
    return normalized
  }

  return `${normalized.slice(0, 53)}...`
}

function buildSummary(prompt: string) {
  const normalized = prompt.trim().replace(/\s+/g, ' ')
  if (normalized.length <= 96) {
    return normalized
  }

  return `${normalized.slice(0, 93)}...`
}

function modelFromBranch(branch: string) {
  if (branch === 'release') return 'Claude'
  if (branch === 'main') return 'ChatGPT'
  return 'Codex'
}

function nextTaskId(tasks: TaskItem[]) {
  return `DAY-${String(tasks.length + 1).padStart(3, '0')}`
}

function TasksPage() {
  const [tasks, setTasks] = React.useState(initialTasks)
  const [boardView, setBoardView] = React.useState<BoardView>('active')
  const [selectedTaskId, setSelectedTaskId] = React.useState(initialTasks[0]?.id ?? '')
  const [prompt, setPrompt] = React.useState('')
  const [branch, setBranch] = React.useState('main')
  const [draggingTaskId, setDraggingTaskId] = React.useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = React.useState<TaskStatus | null>(null)
  const [isPending, startTransition] = React.useTransition()

  const visibleStatuses = React.useMemo(() => {
    return boardView === 'active'
      ? (['drafted', 'building', 'needs_review', 'done'] as TaskStatus[])
      : (['done'] as TaskStatus[])
  }, [boardView])

  const visibleTasks = React.useMemo(() => {
    return tasks.filter((task) => laneMeta[task.status].view === boardView)
  }, [boardView, tasks])

  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0] ?? tasks[0]

  React.useEffect(() => {
    if (!selectedTask) {
      return
    }

    if (selectedTask.id !== selectedTaskId) {
      setSelectedTaskId(selectedTask.id)
    }
  }, [selectedTask, selectedTaskId])

  const moveTaskToStatus = (taskId: string, nextStatus: TaskStatus) => {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId || task.status === nextStatus) {
          return task
        }

        return {
          ...task,
          status: nextStatus,
          dateLabel: 'Now',
          messages: [
            ...task.messages,
            {
              id: `${task.id}-${nextStatus}-${task.messages.length + 1}`,
              author: 'agent',
              authorLabel: 'Captain Copy',
              body: `Moved this task into ${laneMeta[nextStatus].label.toLowerCase()} to keep the board aligned.`,
              meta: 'just now'
            }
          ]
        }
      })
    )
  }

  const handleGenerateTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPrompt = prompt.trim()
    if (!nextPrompt) {
      return
    }

    const taskId = nextTaskId(tasks)
    const newTask: TaskItem = {
      id: taskId,
      title: shortTitle(nextPrompt),
      summary: buildSummary(nextPrompt),
      status: 'drafted',
      owner: 'CC',
      dateLabel: 'Now',
      model: modelFromBranch(branch),
      branch,
      messages: [
        {
          id: `${taskId}-user`,
          author: 'user',
          authorLabel: 'Wilson Hou',
          body: nextPrompt,
          meta: 'just now'
        },
        {
          id: `${taskId}-agent`,
          author: 'agent',
          authorLabel: 'Captain Copy',
          body:
            'Task drafted. I broke it into a focused card, kept the scope actionable, and parked it in the active queue for review.',
          meta: 'just now'
        }
      ]
    }

    setPrompt('')
    startTransition(() => {
      setTasks((current) => [newTask, ...current])
      setBoardView('active')
      setSelectedTaskId(taskId)
    })
  }

  return (
    <div className="tasks-studio-page">
      <div className="page-header">
        <div>
          <h2>Tasks</h2>
          <p className="page-subtitle">
            Kanban on the left, task-generating agent on the right.
          </p>
        </div>
        <span className="page-pill">Task Studio</span>
      </div>

      <div className="tasks-studio-shell">
        <section className="tasks-kanban-panel">
          <div className="tasks-panel-tabs">
            <button
              type="button"
              className={boardView === 'active' ? 'active' : ''}
              onClick={() => setBoardView('active')}
            >
              Active
            </button>
            <button
              type="button"
              className={boardView === 'done' ? 'active' : ''}
              onClick={() => setBoardView('done')}
            >
              Done
            </button>
          </div>

          <div className="tasks-kanban-grid">
            {visibleStatuses.map((status) => {
              const laneTasks = tasks.filter((task) => task.status === status)
              const meta = laneMeta[status]
              return (
                <section key={status} className="tasks-lane">
                  <header className="tasks-lane-header">
                    <div className="tasks-lane-heading">
                      <span className={`tasks-lane-dot ${meta.dotClass}`} />
                      <div>
                        <h3>{meta.label}</h3>
                        <p>{meta.hint}</p>
                      </div>
                    </div>
                    <span className="tasks-lane-count">{laneTasks.length}</span>
                  </header>

                  <div
                    className={`tasks-lane-body${dragOverStatus === status ? ' drag-over' : ''}`}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setDragOverStatus(status)
                    }}
                    onDragLeave={() => {
                      if (dragOverStatus === status) {
                        setDragOverStatus(null)
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId
                      if (taskId) {
                        moveTaskToStatus(taskId, status)
                        setSelectedTaskId(taskId)
                        if (status === 'done') {
                          setBoardView('done')
                        }
                      }
                      setDraggingTaskId(null)
                      setDragOverStatus(null)
                    }}
                  >
                    {laneTasks.map((task) => (
                      <article
                        key={task.id}
                        className={`kanban-task-card${selectedTask?.id === task.id ? ' selected' : ''}${draggingTaskId === task.id ? ' dragging' : ''}`}
                        draggable
                        onClick={() => setSelectedTaskId(task.id)}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', task.id)
                          setDraggingTaskId(task.id)
                          setSelectedTaskId(task.id)
                        }}
                        onDragEnd={() => {
                          setDraggingTaskId(null)
                          setDragOverStatus(null)
                        }}
                      >
                        <div className="kanban-task-topline">
                          <div className="kanban-task-owner">{task.owner}</div>
                          <span>{task.id}</span>
                          <span className="kanban-task-date">{task.dateLabel}</span>
                        </div>

                        <h4>{task.title}</h4>
                        <p>{task.summary}</p>

                        <div className="kanban-task-chip-row">
                          <span className="kanban-task-chip">{task.model}</span>
                          <span className="kanban-task-chip muted">{task.branch}</span>
                        </div>

                        <div className="kanban-task-footer">
                          <span className="kanban-task-thread-count">
                            {task.messages.length} updates
                          </span>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedTaskId(task.id)
                            }}
                          >
                            {task.status === 'needs_review' || task.status === 'done'
                              ? 'Create PR'
                              : 'Open thread'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </section>

        <aside className="tasks-chat-panel">
          <div className="tasks-chat-header">
            <div className="tasks-chat-breadcrumb">Captain Copy</div>
            <h3>{selectedTask?.title ?? 'Generate a task'}</h3>
            <p>
              Chat with the agent to draft new cards, then move them across the board as they mature.
            </p>
          </div>

          <div className="tasks-chat-log">
            {selectedTask?.messages.map((message) => (
              <div key={message.id} className="task-chat-message">
                <div className={`task-chat-avatar ${message.author}`}>
                  {message.author === 'user' ? 'WH' : 'CC'}
                </div>
                <div className="task-chat-bubble">
                  <div className="task-chat-meta">
                    <strong>{message.authorLabel}</strong>
                    <span>{message.meta}</span>
                  </div>
                  <p>{message.body}</p>
                </div>
              </div>
            ))}
          </div>

          <form className="tasks-chat-composer" onSubmit={handleGenerateTask}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="What should Copy build?"
              rows={4}
            />

            <div className="tasks-chat-actions">
              <div className="tasks-chat-toolbar">
                <select
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                >
                  <option value="main">main</option>
                  <option value="feature/kanban-studio">feature/kanban-studio</option>
                  <option value="release">release</option>
                </select>
                <button type="button" className="tasks-chat-icon-button">
                  @
                </button>
                <button type="button" className="tasks-chat-icon-button">
                  +
                </button>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={!prompt.trim() || isPending}
              >
                {isPending ? 'Drafting...' : 'Generate task'}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  )
}
