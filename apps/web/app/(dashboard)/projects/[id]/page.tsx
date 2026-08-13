import Link from "next/link";

import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState, PageHeader, Spinner } from "@/components/ui/feedback";
import { getCurrentUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api-client";
import type { Project, ProjectMember, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  let project: Project | null = null;
  let tasks: Task[] = [];
  let members: ProjectMember[] = [];
  let error: string | null = null;

  try {
    [project, tasks, members] = await Promise.all([
      api.get<Project>(`/projects/${id}`),
      api.get<{ items: Task[] }>(`/projects/${id}/tasks`).then((r) => r.items),
      api.get<ProjectMember[]>(`/projects/${id}/members`),
    ]);
  } catch (err) {
    error = err instanceof ApiError ? err.message : "Failed to load project.";
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Project" />
        <ErrorState message={error} />
      </div>
    );
  }

  if (!project) {
    return (
      <div>
        <PageHeader title="Project" />
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        action={<StatusBadge status={project.status} />}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/tasks?projectId=${project.id}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Tasks ({project.taskCount})
        </Link>
        <Link
          href={`/reports?projectId=${project.id}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Daily Reports
        </Link>
        <Link
          href={`/expenses?projectId=${project.id}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Expenses
        </Link>
        <Link
          href={`/issues?projectId=${project.id}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Issues
        </Link>
        <Link
          href={`/documents?projectId=${project.id}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Documents
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Project details" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-slate-500">Location</dt>
                  <dd className="mt-1 font-medium text-slate-900">{project.location ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Client</dt>
                  <dd className="mt-1 font-medium text-slate-900">{project.clientInfo ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Start date</dt>
                  <dd className="mt-1 font-medium text-slate-900">{project.startDate ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Expected end</dt>
                  <dd className="mt-1 font-medium text-slate-900">{project.expectedEndDate ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Budget</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {project.budget ? `$${Number(project.budget).toLocaleString()}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Manager</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {project.manager ? project.manager.name : "Unassigned"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Progress</span>
                  <span>{project.progressPercentage}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-blue-600" style={{ width: `${String(project.progressPercentage)}%` }} />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent tasks" description={`${String(tasks.length)} tasks`} />
            <CardBody className="!p-0">
              {tasks.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-slate-500">No tasks yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {tasks.slice(0, 5).map((task) => (
                    <li key={task.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{task.title}</p>
                        <p className="text-xs text-slate-500">
                          {task.assignee ? task.assignee.name : "Unassigned"}
                        </p>
                      </div>
                      <StatusBadge status={task.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader title="Team" description={`${String(members.length)} members`} />
            <CardBody className="!p-0">
              {members.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-slate-500">No members yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {members.map((m) => (
                    <li key={m.id} className="px-5 py-3">
                      <p className="font-medium text-slate-900">{m.user.name}</p>
                      <p className="text-xs text-slate-500">{m.user.email}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
