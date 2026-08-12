"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createProjectSchema } from "@construction-ops/validation";

import { ApiError, apiGet, apiPost, type AuthUserWithCompany, type Project } from "@/lib/api-client";
import { canCreateProject } from "@/lib/permissions";

const PROJECT_STATUS_LABELS: Record<Project["status"], string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

interface CreateFormValues {
  name: string;
  description: string;
  location: string;
  startDate: string;
  expectedEndDate: string;
  budget: string;
}

const EMPTY_FORM: CreateFormValues = {
  name: "",
  description: "",
  location: "",
  startDate: "",
  expectedEndDate: "",
  budget: "",
};

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

async function fetchProjects(): Promise<Project[]> {
  const result = await apiGet<{ projects: Project[] }>("/projects");
  return result.projects;
}

export default function ProjectsPage() {
  const [user, setUser] = useState<AuthUserWithCompany | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [values, setValues] = useState<CreateFormValues>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
  }, []);

  async function handleCreate(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setCreateError(null);

    const parsed = createProjectSchema.safeParse({
      name: values.name.trim(),
      description: values.description.trim() === "" ? undefined : values.description.trim(),
      location: values.location.trim() === "" ? undefined : values.location.trim(),
      startDate: values.startDate === "" ? undefined : values.startDate,
      expectedEndDate: values.expectedEndDate === "" ? undefined : values.expectedEndDate,
      budget: values.budget.trim() === "" ? undefined : Number(values.budget),
    });

    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message ?? "Please check the highlighted fields.");
      return;
    }

    setCreating(true);

    try {
      await apiPost<Project>("/projects", parsed.data);
      setValues(EMPTY_FORM);
      setShowForm(false);
      setProjects(await fetchProjects());
    } catch (error) {
      setCreateError(toErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div>
        <p className="text-sm text-slate-500">Loading projects...</p>
      </div>
    );
  }

  if (loadError != null || user == null) {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Projects</h1>
        <p role="alert" className="mt-4 text-sm text-red-600">
          {loadError ?? "Unable to load projects."}
        </p>
      </div>
    );
  }

  const canCreate = canCreateProject(user.role);

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">Construction projects in your company.</p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setShowForm((visible) => !visible);
            }}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            {showForm ? "Cancel" : "New project"}
          </button>
        )}
      </div>

      {canCreate && showForm && (
        <form
          onSubmit={(event) => {
            void handleCreate(event);
          }}
          className="mt-6 grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2"
        >
          <label htmlFor="project-name" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Name
            <input
              id="project-name"
              value={values.name}
              onChange={(event) => {
                setValues({ ...values, name: event.target.value });
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label htmlFor="project-location" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Location
            <input
              id="project-location"
              value={values.location}
              onChange={(event) => {
                setValues({ ...values, location: event.target.value });
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label
            htmlFor="project-description"
            className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2"
          >
            Description
            <textarea
              id="project-description"
              rows={3}
              value={values.description}
              onChange={(event) => {
                setValues({ ...values, description: event.target.value });
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label htmlFor="project-start-date" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Start date
            <input
              id="project-start-date"
              type="date"
              value={values.startDate}
              onChange={(event) => {
                setValues({ ...values, startDate: event.target.value });
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label htmlFor="project-end-date" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Expected end date
            <input
              id="project-end-date"
              type="date"
              value={values.expectedEndDate}
              onChange={(event) => {
                setValues({ ...values, expectedEndDate: event.target.value });
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label htmlFor="project-budget" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Budget
            <input
              id="project-budget"
              type="number"
              min="0"
              step="0.01"
              value={values.budget}
              onChange={(event) => {
                setValues({ ...values, budget: event.target.value });
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>

          {createError != null && (
            <p role="alert" className="text-sm text-red-600 sm:col-span-2">
              {createError}
            </p>
          )}

          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            {creating ? "Creating..." : "Create project"}
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No projects yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="block rounded-md border border-slate-200 bg-white p-4 hover:border-slate-300"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{project.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {PROJECT_STATUS_LABELS[project.status]}
                      {project.location != null ? ` · ${project.location}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-slate-700">{project.progressPercentage}%</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
