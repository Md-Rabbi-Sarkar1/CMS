import Link from "next/link";

import { CreateProjectButton } from "@/components/domain/create-project-button";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/feedback";
import { getCurrentUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api-client";
import type { PaginatedResponse, Project } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  let projects: Project[] = [];
  let error: string | null = null;

  try {
    const result = await api.get<PaginatedResponse<Project>>("/projects", { pageSize: 100 });
    projects = result.items;
  } catch (err) {
    error = err instanceof ApiError ? err.message : "Failed to load projects.";
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Manage your construction projects."
        action={<CreateProjectButton user={user} />}
      />

      {error ? (
        <ErrorState message={error} />
      ) : projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Create your first project to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody>
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-slate-900">{project.name}</h3>
                    <StatusBadge status={project.status} />
                  </div>
                  {project.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{project.description}</p>
                  ) : null}
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>{project.location ?? "No location"}</span>
                    <div className="flex items-center gap-3">
                      <span>{project.taskCount} tasks</span>
                      <span>{project.memberCount} members</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-blue-600" style={{ width: `${String(project.progressPercentage)}%` }} />
                      </div>
                      <span className="text-xs text-slate-600">{project.progressPercentage}%</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
