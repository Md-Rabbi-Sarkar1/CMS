"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiGet, type AuthUserWithCompany, type Project } from "@/lib/api-client";

import CompanyDashboard from "@/components/dashboard/company-dashboard";
import ProjectDashboard from "@/components/dashboard/project-dashboard";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

async function fetchProjects(): Promise<Project[]> {
  const result = await apiGet<{ projects: Project[] }>("/projects");
  return result.projects;
}

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUserWithCompany | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [me, projectsData] = await Promise.all([
          apiGet<AuthUserWithCompany>("/auth/me"),
          fetchProjects(),
        ]);

        if (!cancelled) {
          setUser(me);
          setProjects(projectsData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(toErrorMessage(err));
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
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading dashboard...</p>;
  }

  if (error != null || user == null) {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error ?? "Unable to load dashboard."}
        </p>
      </div>
    );
  }

  if (user.role === "ADMIN") {
    return <CompanyDashboard />;
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Welcome, {user.name}. Here's an overview of your projects and tasks.
      </p>

      <div className="mt-6 flex gap-4">
        <Link
          href="/projects"
          className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
        >
          View Projects
        </Link>
        <Link
          href="/tasks"
          className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
        >
          View Tasks
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">You don't have access to any projects yet.</p>
      ) : (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Your Projects</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {projects.map((project) => (
              <li key={project.id}>
                <div className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-base font-semibold text-slate-900 hover:text-slate-700"
                      >
                        {project.name}
                      </Link>
                      <p className="mt-1 text-sm text-slate-500">{project.progressPercentage}% complete</p>
                    </div>
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-sm font-medium text-slate-500 hover:text-slate-900"
                    >
                      View details →
                    </Link>
                  </div>
                  <div className="mt-4">
                    <ProjectDashboard projectId={project.id} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
