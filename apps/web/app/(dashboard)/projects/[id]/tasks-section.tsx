"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  type TaskPriority,
  type TaskStatus,
} from "@construction-ops/validation";

import {
  ApiError,
  apiGet,
  apiPatch,
  apiPost,
  type CompanyRole,
  type ProjectMember,
  type Task,
  type TaskListResult,
} from "@/lib/api-client";
import { canManageTask, canUpdateTaskStatus } from "@/lib/permissions";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  formatTaskDate,
  getAvailableTaskStatuses,
  toTaskDateInputValue,
} from "@/lib/tasks";

interface TasksSectionProps {
  projectId: string;
  managerId: string | null;
  role: CompanyRole;
  userId: string;
}

interface TaskFormValues {
  title: string;
  description: string;
  assigneeId: string;
  priority: string;
  startDate: string;
  dueDate: string;
}

const EMPTY_FORM: TaskFormValues = {
  title: "",
  description: "",
  assigneeId: "",
  priority: "",
  startDate: "",
  dueDate: "",
};

const TASK_LIST_PAGE_SIZE = 20;
const MEMBER_LIST_PAGE_SIZE = 100;

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (error.status === 403) {
      return "You do not have access to this project.";
    }

    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function fromTask(task: Task): TaskFormValues {
  return {
    title: task.title,
    description: task.description ?? "",
    assigneeId: task.assigneeId ?? "",
    priority: task.priority,
    startDate: toTaskDateInputValue(task.startDate),
    dueDate: toTaskDateInputValue(task.dueDate),
  };
}

function assigneeLabel(assigneeId: string | null, names: ReadonlyMap<string, string>): string {
  if (assigneeId == null) {
    return "Unassigned";
  }

  return names.get(assigneeId) ?? "Unknown";
}

export default function TasksSection({ projectId, managerId, role, userId }: TasksSectionProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createValues, setCreateValues] = useState<TaskFormValues>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<TaskFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState(false);

  const refreshTasks = useCallback(async (): Promise<void> => {
    const result = await apiGet<TaskListResult>(
      `/projects/${projectId}/tasks?page=1&pageSize=${String(TASK_LIST_PAGE_SIZE)}`,
    );
    setTasks(result.tasks);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [tasksResult, membersResult] = await Promise.all([
          apiGet<TaskListResult>(`/projects/${projectId}/tasks?page=1&pageSize=${String(TASK_LIST_PAGE_SIZE)}`),
          apiGet<{ members: ProjectMember[] }>(
            `/projects/${projectId}/members?page=1&pageSize=${String(MEMBER_LIST_PAGE_SIZE)}`,
          ),
        ]);

        if (!cancelled) {
          setTasks(tasksResult.tasks);
          setMembers(membersResult.members);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(toErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const canManage = canManageTask(role, managerId, userId);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "ACTIVE"),
    [members],
  );

  const assigneeNames = useMemo(() => {
    const names = new Map<string, string>();

    for (const member of members) {
      names.set(member.userId, member.name);
    }

    return names;
  }, [members]);

  const editingTask = editingTaskId == null ? null : tasks.find((task) => task.id === editingTaskId);

  const editAssigneeOptions = useMemo(() => {
    const options = [...activeMembers];

    if (
      editingTask?.assigneeId != null &&
      !options.some((member) => member.userId === editingTask.assigneeId)
    ) {
      const current = members.find((member) => member.userId === editingTask.assigneeId);

      if (current != null) {
        options.push(current);
      }
    }

    return options;
  }, [activeMembers, editingTask, members]);

  async function handleCreate(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setActionError(null);
    setActionSuccess(false);

    const parsed = createTaskSchema.safeParse({
      title: createValues.title.trim(),
      description: createValues.description.trim() === "" ? undefined : createValues.description.trim(),
      assigneeId: createValues.assigneeId === "" ? undefined : createValues.assigneeId,
      priority: createValues.priority === "" ? undefined : createValues.priority,
      startDate: createValues.startDate === "" ? undefined : createValues.startDate,
      dueDate: createValues.dueDate === "" ? undefined : createValues.dueDate,
    });

    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? "Please check the highlighted fields.");
      return;
    }

    setCreating(true);

    try {
      await apiPost<Task>(`/projects/${projectId}/tasks`, parsed.data);
      setCreateValues(EMPTY_FORM);
      setShowCreateForm(false);
      await refreshTasks();
      setActionSuccess(true);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (editingTaskId == null) {
      return;
    }

    setActionError(null);
    setActionSuccess(false);

    const parsed = updateTaskSchema.safeParse({
      title: editValues.title.trim(),
      description: editValues.description.trim() === "" ? null : editValues.description.trim(),
      assigneeId: editValues.assigneeId === "" ? null : editValues.assigneeId,
      priority: editValues.priority === "" ? undefined : editValues.priority,
      startDate: editValues.startDate === "" ? null : editValues.startDate,
      dueDate: editValues.dueDate === "" ? null : editValues.dueDate,
    });

    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? "Please check the highlighted fields.");
      return;
    }

    setSaving(true);

    try {
      await apiPatch<Task>(`/tasks/${editingTaskId}`, parsed.data);
      await refreshTasks();
      setEditingTaskId(null);
      setActionSuccess(true);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(task: Task, nextStatus: TaskStatus): Promise<void> {
    setActionError(null);
    setActionSuccess(false);

    const parsed = updateTaskStatusSchema.safeParse({ status: nextStatus });

    if (!parsed.success) {
      return;
    }

    setUpdatingStatusId(task.id);

    try {
      await apiPatch<Task>(`/tasks/${task.id}/status`, parsed.data);
      await refreshTasks();
      setActionSuccess(true);
    } catch (error) {
      setActionError(toErrorMessage(error));

      if (error instanceof ApiError && error.status === 409) {
        await refreshTasks().catch(() => undefined);
      }
    } finally {
      setUpdatingStatusId(null);
    }
  }

  function handleStartEdit(task: Task): void {
    setActionError(null);
    setActionSuccess(false);
    setEditValues(fromTask(task));
    setEditingTaskId(task.id);
  }

  function handleCancelEdit(): void {
    setEditingTaskId(null);
    setActionError(null);
    setActionSuccess(false);
  }

  if (loading) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
        <p role="status" className="mt-3 text-sm text-slate-500">
          Loading tasks...
        </p>
      </section>
    );
  }

  if (loadError != null) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
        <p role="alert" className="mt-3 text-sm text-red-600">
          {loadError}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowCreateForm((visible) => !visible);
            }}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            {showCreateForm ? "Cancel" : "New task"}
          </button>
        )}
      </div>

      {canManage && showCreateForm && (
        <form
          onSubmit={(event) => {
            void handleCreate(event);
          }}
          className="mt-4 grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2"
        >
          <label htmlFor="task-title" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Title
            <input
              id="task-title"
              value={createValues.title}
              onChange={(event) => {
                setCreateValues({ ...createValues, title: event.target.value });
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label htmlFor="task-assignee" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Assignee
            <select
              id="task-assignee"
              value={createValues.assigneeId}
              onChange={(event) => {
                setCreateValues({ ...createValues, assigneeId: event.target.value });
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
            >
              <option value="">Unassigned</option>
              {activeMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="task-priority" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Priority
            <select
              id="task-priority"
              value={createValues.priority}
              onChange={(event) => {
                setCreateValues({ ...createValues, priority: event.target.value });
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
            >
              <option value="">Default</option>
              {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((priority) => (
                <option key={priority} value={priority}>
                  {TASK_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="task-start-date" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Start date
            <input
              id="task-start-date"
              type="date"
              value={createValues.startDate}
              onChange={(event) => {
                setCreateValues({ ...createValues, startDate: event.target.value });
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label htmlFor="task-due-date" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Due date
            <input
              id="task-due-date"
              type="date"
              value={createValues.dueDate}
              onChange={(event) => {
                setCreateValues({ ...createValues, dueDate: event.target.value });
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label
            htmlFor="task-description"
            className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2"
          >
            Description
            <textarea
              id="task-description"
              rows={3}
              value={createValues.description}
              onChange={(event) => {
                setCreateValues({ ...createValues, description: event.target.value });
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>

          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            {creating ? "Creating..." : "Create task"}
          </button>
        </form>
      )}

      {actionError != null && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {actionError}
        </p>
      )}
      {actionSuccess && (
        <p role="status" className="mt-4 text-sm text-emerald-600">
          Changes saved.
        </p>
      )}

      {tasks.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No tasks yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {tasks.map((task) => {
            const availableStatuses = getAvailableTaskStatuses(task.status);
            const canUpdateStatus = canUpdateTaskStatus(role, managerId, task.assigneeId, userId);

            return (
              <li key={task.id} className="rounded-md border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/tasks/${task.id}`} className="text-base font-semibold text-slate-900">
                      {task.title}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">
                      {TASK_STATUS_LABELS[task.status]} · {TASK_PRIORITY_LABELS[task.priority]} ·{" "}
                      {assigneeLabel(task.assigneeId, assigneeNames)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {task.startDate != null ? `Starts ${formatTaskDate(task.startDate)}` : "No start date"} ·{" "}
                      {task.dueDate != null ? `Due ${formatTaskDate(task.dueDate)}` : "No due date"}
                    </p>
                  </div>
                  {canUpdateStatus && availableStatuses.length > 0 && (
                    <select
                      aria-label="Change task status"
                      value=""
                      disabled={updatingStatusId === task.id}
                      onChange={(event) => {
                        if (event.target.value !== "") {
                          void handleStatusChange(task, event.target.value as TaskStatus);
                        }
                      }}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
                    >
                      <option value="">Change status...</option>
                      {availableStatuses.map((status) => (
                        <option key={status} value={status}>
                          {TASK_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {canManage && editingTaskId === task.id && (
                  <form
                    onSubmit={(event) => {
                      void handleSaveEdit(event);
                    }}
                    className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2"
                  >
                    <label
                      htmlFor="task-edit-title"
                      className="flex flex-col gap-1 text-sm font-medium text-slate-700"
                    >
                      Title
                      <input
                        id="task-edit-title"
                        value={editValues.title}
                        onChange={(event) => {
                          setEditValues({ ...editValues, title: event.target.value });
                        }}
                        className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
                      />
                    </label>
                    <label
                      htmlFor="task-edit-assignee"
                      className="flex flex-col gap-1 text-sm font-medium text-slate-700"
                    >
                      Assignee
                      <select
                        id="task-edit-assignee"
                        value={editValues.assigneeId}
                        onChange={(event) => {
                          setEditValues({ ...editValues, assigneeId: event.target.value });
                        }}
                        className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
                      >
                        <option value="">Unassigned</option>
                        {editAssigneeOptions.map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label
                      htmlFor="task-edit-priority"
                      className="flex flex-col gap-1 text-sm font-medium text-slate-700"
                    >
                      Priority
                      <select
                        id="task-edit-priority"
                        value={editValues.priority}
                        onChange={(event) => {
                          setEditValues({ ...editValues, priority: event.target.value });
                        }}
                        className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
                      >
                        <option value="">Default</option>
                        {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((priority) => (
                          <option key={priority} value={priority}>
                            {TASK_PRIORITY_LABELS[priority]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label
                      htmlFor="task-edit-start-date"
                      className="flex flex-col gap-1 text-sm font-medium text-slate-700"
                    >
                      Start date
                      <input
                        id="task-edit-start-date"
                        type="date"
                        value={editValues.startDate}
                        onChange={(event) => {
                          setEditValues({ ...editValues, startDate: event.target.value });
                        }}
                        className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
                      />
                    </label>
                    <label
                      htmlFor="task-edit-due-date"
                      className="flex flex-col gap-1 text-sm font-medium text-slate-700"
                    >
                      Due date
                      <input
                        id="task-edit-due-date"
                        type="date"
                        value={editValues.dueDate}
                        onChange={(event) => {
                          setEditValues({ ...editValues, dueDate: event.target.value });
                        }}
                        className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
                      />
                    </label>
                    <label
                      htmlFor="task-edit-description"
                      className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2"
                    >
                      Description
                      <textarea
                        id="task-edit-description"
                        rows={3}
                        value={editValues.description}
                        onChange={(event) => {
                          setEditValues({ ...editValues, description: event.target.value });
                        }}
                        className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
                      />
                    </label>

                    <div className="flex gap-3 sm:col-span-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save changes"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {canManage && editingTaskId !== task.id && (
                  <button
                    type="button"
                    onClick={() => {
                      handleStartEdit(task);
                    }}
                    className="mt-4 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400"
                  >
                    Edit
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
