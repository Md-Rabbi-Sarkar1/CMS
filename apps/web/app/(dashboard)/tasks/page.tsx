import Link from "next/link";

import { CreateTaskButton } from "@/components/domain/create-task-button";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/feedback";
import { getCurrentUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api-client";
import type { Project, ProjectMember, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  let tasks: Task[] = [];
  let members: ProjectMember[] = [];
  let project: Project | null = null;
  let error: string | null = null;

  try {
    if (projectId) {
      [tasks, members, project] = await Promise.all([
        api.get<{ items: Task[] }>(`/projects/${projectId}/tasks`).then((r) => r.items),
        api.get<ProjectMember[]>(`/projects/${projectId}/members`),
        api.get<Project>(`/projects/${projectId}`).catch(() => null),
      ]);
    } else {
      const result = await api.get<{ items: Task[] }>(`/tasks`, { pageSize: 100 });
      tasks = result.items;
    }
  } catch (err) {
    error = err instanceof ApiError ? err.message : "Failed to load tasks.";
  }

  return (
    <div>
      <PageHeader
        title={project ? `${project.name} — Tasks` : "Tasks"}
        description={project ? "Tasks for this project." : "All tasks across your projects."}
        action={
          projectId ? (
            <CreateTaskButton user={user} projectId={projectId} members={members} />
          ) : null
        }
      />

      {projectId ? (
        <div className="mb-4">
          <Link href="/projects" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← Back to projects
          </Link>
        </div>
      ) : null}

      {error ? (
        <ErrorState message={error} />
      ) : tasks.length === 0 ? (
        <EmptyState title="No tasks yet" description="Create a task to track work." />
      ) : (
        <Card>
          <CardBody className="!p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Assignee</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{task.title}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {task.project ? (
                          <Link href={`/projects/${task.projectId}`} className="text-blue-600 hover:text-blue-700">
                            {task.project.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {task.assignee ? task.assignee.name : "Unassigned"}
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">{task.dueDate ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
