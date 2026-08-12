"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  updateTaskSchema,
  updateTaskStatusSchema,
  type TaskPriority,
  type TaskStatus,
} from "@construction-ops/validation";

import {
  ApiError,
  apiGet,
  apiPatch,
  type AuthUserWithCompany,
  type Project,
  type ProjectMember,
  type Task,
} from "@/lib/api-client";
import { canManageTask, canUpdateTaskStatus } from "@/lib/permissions";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  formatTaskDate,
  getAvailableTaskStatuses,
  toTaskDateInputValue,
} from "@/lib/tasks";

const MEMBER_LIST_PAGE_SIZE = 100;

interface TaskFormValues {
  title: string;
  description: string;
  assigneeId: string;
  priority: string;
  startDate: string;
  dueDate: string;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (error.status === 403) {
      return "You do not have access to this task.";
    }

    if (error.status === 404) {
      return "Task not found.";
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

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = params.id;

  const [user, setUser] = useState<AuthUserWithCompany | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editValues, setEditValues] = useState<TaskFormValues>({
    title: "",
    description: "",
    assigneeId: "",
    priority: "",
    startDate: "",
    dueDate: "",
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function isCancelled(): boolean {
      return cancelled;
    }

    async function load(): Promise<void> {
      try {
        const [me, taskData] = await Promise.all([
          apiGet<AuthUserWithCompany>("/auth/me"),
          apiGet<Task>(`/tasks/${taskId}`),
        ]);

        if (isCancelled()) {
          return;
        }

        setUser(me);
        setTask(taskData);
        setEditValues(fromTask(taskData));

        const [projectData, membersResult] = await Promise.all([
          apiGet<Project>(`/projects/${taskData.projectId}`),
          apiGet<{ members: ProjectMember[] }>(
            `/projects/${taskData.projectId}/members?page=1&pageSize=${String(MEMBER_LIST_PAGE_SIZE)}`,
          ),
        ]);

        if (isCancelled()) {
          return;
        }

        setProject(projectData);
        setMembers(membersResult.members);
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
  }, [taskId]);

  const assigneeNames = useMemo(() => {
    const names = new Map<string, string>();

    for (const member of members) {
      names.set(member.userId, member.name);
    }

    return names;
  }, [members]);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "ACTIVE"),
    [members],
  );

  const editAssigneeOptions = useMemo(() => {
    const options = [...activeMembers];

    if (task?.assigneeId != null && !options.some((member) => member.userId === task.assigneeId)) {
      const current = members.find((member) => member.userId === task.assigneeId);

      if (current != null) {
        options.push(current);
      }
    }

    return options;
  }, [activeMembers, members, task]);

  const canEdit = user != null && project != null && canManageTask(user.role, project.managerId, user.id);
  const canUpdateStatus =
    user != null && task != null && canUpdateTaskStatus(user.role, project?.managerId ?? null, task.assigneeId, user.id);

  async function handleSaveEdit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (task == null) {
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
      const updated = await apiPatch<Task>(`/tasks/${task.id}`, parsed.data);
      setTask(updated);
      setEditValues(fromTask(updated));
      setEditing(false);
      setActionSuccess(true);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(nextStatus: TaskStatus): Promise<void> {
    if (task == null) {
      return;
    }

    setActionError(null);
    setActionSuccess(false);

    const parsed = updateTaskStatusSchema.safeParse({ status: nextStatus });

    if (!parsed.success) {
      return;
    }

    setSaving(true);

    try {
      const updated = await apiPatch<Task>(`/tasks/${task.id}/status`, parsed.data);
      setTask(updated);
      setEditValues(fromTask(updated));
      setActionSuccess(true);
    } catch (error) {
      setActionError(toErrorMessage(error));

      if (error instanceof ApiError && error.status === 409) {
        try {
          const fresh = await apiGet<Task>(`/tasks/${task.id}`);
          setTask(fresh);
          setEditValues(fromTask(fresh));
        } catch {
          // Keep the stale task if the refresh fails; the error is already shown.
        }
      }
    } finally {
      setSaving(false);
    }
  }

  function handleStartEdit(): void {
    if (task == null) {
      return;
    }

    setActionError(null);
    setActionSuccess(false);
    setEditValues(fromTask(task));
    setEditing(true);
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading task...</p>;
  }

  if (loadError != null || task == null) {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Task</h1>
        <p role="alert" className="mt-4 text-sm text-red-600">
          {loadError ?? "Unable to load task."}
        </p>
        <Link href="/projects" className="mt-4 inline-block text-sm font-medium text-slate-500 hover:text-slate-900">
          Back to projects
        </Link>
      </div>
    );
  }

  const availableStatuses = getAvailableTaskStatuses(task.status);
  const projectHref = project == null ? "/projects" : `/projects/${project.id}`;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <Link href="/projects" className="hover:text-slate-900">
          Projects
        </Link>
        <span aria-hidden="true">/</span>
        {project == null ? (
          <span>Project</span>
        ) : (
          <Link href={projectHref} className="hover:text-slate-900">
            {project.name}
          </Link>
        )}
        <span aria-hidden="true">/</span>
        <span aria-current="page">Task</span>
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{task.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {TASK_STATUS_LABELS[task.status]} · {TASK_PRIORITY_LABELS[task.priority]} ·{" "}
            {assigneeLabel(task.assigneeId, assigneeNames)}
          </p>
        </div>
        {canUpdateStatus && availableStatuses.length > 0 && (
          <select
            aria-label="Change task status"
            value=""
            disabled={saving}
            onChange={(event) => {
              if (event.target.value !== "") {
                void handleStatusChange(event.target.value as TaskStatus);
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

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-sm font-medium text-slate-500">Description</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{task.description ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Project</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {project == null ? "—" : (
              <Link href={projectHref} className="font-medium text-slate-900 underline underline-offset-2 hover:text-slate-600">
                {project.name}
              </Link>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Assignee</dt>
          <dd className="mt-1 text-sm text-slate-900">{assigneeLabel(task.assigneeId, assigneeNames)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Priority</dt>
          <dd className="mt-1 text-sm text-slate-900">{TASK_PRIORITY_LABELS[task.priority]}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Status</dt>
          <dd className="mt-1 text-sm text-slate-900">{TASK_STATUS_LABELS[task.status]}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Start date</dt>
          <dd className="mt-1 text-sm text-slate-900">{formatTaskDate(task.startDate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Due date</dt>
          <dd className="mt-1 text-sm text-slate-900">{formatTaskDate(task.dueDate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Completion date</dt>
          <dd className="mt-1 text-sm text-slate-900">{formatTaskDate(task.completionDate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Created</dt>
          <dd className="mt-1 text-sm text-slate-900">{formatTaskDate(task.createdAt)}</dd>
        </div>
      </dl>

      {canEdit && (
        <div className="mt-8">
          {actionError != null && (
            <p role="alert" className="text-sm text-red-600">
              {actionError}
            </p>
          )}
          {actionSuccess && (
            <p role="status" className="text-sm text-emerald-600">
              Changes saved.
            </p>
          )}

          {!editing && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Edit task
            </button>
          )}

          {editing && (
            <form
              onSubmit={(event) => {
                void handleSaveEdit(event);
              }}
              className="grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2"
            >
              <label htmlFor="task-title" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Title
                <input
                  id="task-title"
                  value={editValues.title}
                  onChange={(event) => {
                    setEditValues({ ...editValues, title: event.target.value });
                  }}
                  className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
                />
              </label>
              <label htmlFor="task-assignee" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Assignee
                <select
                  id="task-assignee"
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
              <label htmlFor="task-priority" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Priority
                <select
                  id="task-priority"
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
              <label htmlFor="task-start-date" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Start date
                <input
                  id="task-start-date"
                  type="date"
                  value={editValues.startDate}
                  onChange={(event) => {
                    setEditValues({ ...editValues, startDate: event.target.value });
                  }}
                  className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
                />
              </label>
              <label htmlFor="task-due-date" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Due date
                <input
                  id="task-due-date"
                  type="date"
                  value={editValues.dueDate}
                  onChange={(event) => {
                    setEditValues({ ...editValues, dueDate: event.target.value });
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
                  onClick={() => {
                    setEditing(false);
                    setActionError(null);
                    setActionSuccess(false);
                  }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
