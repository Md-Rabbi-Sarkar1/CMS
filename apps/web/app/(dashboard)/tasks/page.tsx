"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { taskSortSchema, taskStatusSchema, type TaskSort } from "@construction-ops/validation";

import {
  ApiError,
  apiGet,
  apiGetWithMeta,
  type Project,
  type ProjectMember,
  type Task,
} from "@/lib/api-client";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, formatTaskDate } from "@/lib/tasks";

const PAGE_SIZE = 20;
const MEMBER_PAGE_SIZE = 100;

const SORT_LABELS: Record<TaskSort, string> = {
  "createdAt:asc": "Created (oldest first)",
  "createdAt:desc": "Created (newest first)",
  "dueDate:asc": "Due date (earliest first)",
  "dueDate:desc": "Due date (latest first)",
  "title:asc": "Title (A-Z)",
  "title:desc": "Title (Z-A)",
};

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function buildQuery(page: number, status: string, assigneeId: string, sort: TaskSort): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));
  params.set("sort", sort);

  if (status !== "") {
    params.set("status", status);
  }

  if (assigneeId !== "") {
    params.set("assigneeId", assigneeId);
  }

  return params.toString();
}

function assigneeLabel(assigneeId: string | null, names: ReadonlyMap<string, string>): string {
  if (assigneeId == null) {
    return "Unassigned";
  }

  return names.get(assigneeId) ?? "Unknown";
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [sort, setSort] = useState<TaskSort>("createdAt:desc");

  const [memberNames, setMemberNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [projectNames, setProjectNames] = useState<ReadonlyMap<string, string>>(new Map());
  const loadedProjectIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    function isCancelled(): boolean {
      return cancelled;
    }

    async function load(): Promise<void> {
      setLoading(true);
      setLoadError(null);

      try {
        const query = buildQuery(page, statusFilter, assigneeFilter, sort);
        const result = await apiGetWithMeta<{ tasks: Task[] }>(`/tasks?${query}`);

        if (isCancelled()) {
          return;
        }

        setTasks(result.data.tasks);
        setTotal(result.meta?.total ?? result.data.tasks.length);

        const projectIds = Array.from(new Set(result.data.tasks.map((task) => task.projectId)));
        const missing = projectIds.filter((projectId) => !loadedProjectIds.current.has(projectId));

        if (missing.length > 0) {
          const contexts = await Promise.all(
            missing.map(async (projectId) => {
              const [project, membersResult] = await Promise.all([
                apiGet<Project>(`/projects/${projectId}`),
                apiGet<{ members: ProjectMember[] }>(
                  `/projects/${projectId}/members?page=1&pageSize=${String(MEMBER_PAGE_SIZE)}`,
                ),
              ]);

              return { project, members: membersResult.members };
            }),
          );

          if (isCancelled()) {
            return;
          }

          for (const context of contexts) {
            loadedProjectIds.current.add(context.project.id);
          }

          setProjectNames((previous) => {
            const next = new Map(previous);
            for (const context of contexts) {
              next.set(context.project.id, context.project.name);
            }
            return next;
          });

          setMemberNames((previous) => {
            const next = new Map(previous);
            for (const context of contexts) {
              for (const member of context.members) {
                next.set(member.userId, member.name);
              }
            }
            return next;
          });
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
  }, [page, statusFilter, assigneeFilter, sort]);

  const assigneeOptions = useMemo(
    () =>
      Array.from(memberNames.entries())
        .map(([userId, name]) => ({ userId, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [memberNames],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  function handleStatusChange(value: string): void {
    setStatusFilter(value);
    setPage(1);
  }

  function handleAssigneeChange(value: string): void {
    setAssigneeFilter(value);
    setPage(1);
  }

  function handleSortChange(value: string): void {
    setSort(value as TaskSort);
    setPage(1);
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Tasks</h1>
          <p className="mt-1 text-sm text-slate-500">Tasks across your projects.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label htmlFor="task-status-filter" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Status
          <select
            id="task-status-filter"
            value={statusFilter}
            onChange={(event) => {
              handleStatusChange(event.target.value);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
          >
            <option value="">All statuses</option>
            {taskStatusSchema.options.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="task-assignee-filter" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Assignee
          <select
            id="task-assignee-filter"
            value={assigneeFilter}
            onChange={(event) => {
              handleAssigneeChange(event.target.value);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
          >
            <option value="">All assignees</option>
            {assigneeOptions.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="task-sort" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Sort
          <select
            id="task-sort"
            value={sort}
            onChange={(event) => {
              handleSortChange(event.target.value);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
          >
            {taskSortSchema.options.map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p role="status" className="mt-8 text-sm text-slate-500">
          Loading tasks...
        </p>
      ) : loadError != null ? (
        <p role="alert" className="mt-8 text-sm text-red-600">
          {loadError}
        </p>
      ) : tasks.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No tasks found.</p>
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-3">
            {tasks.map((task) => {
              const projectName = projectNames.get(task.projectId);

              return (
                <li key={task.id} className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link href={`/tasks/${task.id}`} className="text-base font-semibold text-slate-900">
                        {task.title}
                      </Link>
                      <p className="mt-1 text-sm text-slate-500">
                        {TASK_STATUS_LABELS[task.status]} · {TASK_PRIORITY_LABELS[task.priority]} ·{" "}
                        {assigneeLabel(task.assigneeId, memberNames)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {projectName != null ? (
                          <Link href={`/projects/${task.projectId}`} className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
                            {projectName}
                          </Link>
                        ) : (
                          <Link href={`/projects/${task.projectId}`} className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
                            Project
                          </Link>
                        )}
                        {task.startDate != null ? ` · Starts ${formatTaskDate(task.startDate)}` : ""}
                        {task.dueDate != null ? ` · Due ${formatTaskDate(task.dueDate)}` : ""}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages} ({total} {total === 1 ? "task" : "tasks"})
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                disabled={!hasPrevious}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => {
                  setPage((current) => current + 1);
                }}
                disabled={!hasNext}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
