"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  canTransitionProjectStatus,
  updateProjectProgressSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
  type ProjectStatus,
} from "@construction-ops/validation";

import {
  ApiError,
  apiGet,
  apiPatch,
  type AuthUserWithCompany,
  type Project,
} from "@/lib/api-client";
import { canManageProject } from "@/lib/permissions";

import TeamSection from "./team-section";

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const PROJECT_STATUSES: readonly ProjectStatus[] = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];

interface DetailsFormValues {
  name: string;
  description: string;
  location: string;
  clientInfo: string;
  startDate: string;
  expectedEndDate: string;
  budget: string;
}

function fromProject(project: Project): DetailsFormValues {
  return {
    name: project.name,
    description: project.description ?? "",
    location: project.location ?? "",
    clientInfo: project.clientInfo ?? "",
    startDate: project.startDate ?? "",
    expectedEndDate: project.expectedEndDate ?? "",
    budget: project.budget ?? "",
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (error.status === 403) {
      return "You do not have access to this project.";
    }

    if (error.status === 404) {
      return "Project not found.";
    }

    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function buildDetailsPatch(project: Project, values: DetailsFormValues): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  const name = values.name.trim();
  if (name !== project.name) {
    patch.name = name;
  }

  const description = values.description.trim() === "" ? null : values.description.trim();
  if (description !== project.description) {
    patch.description = description;
  }

  const location = values.location.trim() === "" ? null : values.location.trim();
  if (location !== project.location) {
    patch.location = location;
  }

  const clientInfo = values.clientInfo.trim() === "" ? null : values.clientInfo.trim();
  if (clientInfo !== project.clientInfo) {
    patch.clientInfo = clientInfo;
  }

  const startDate = values.startDate === "" ? null : values.startDate;
  if (startDate !== project.startDate) {
    patch.startDate = startDate;
  }

  const expectedEndDate = values.expectedEndDate === "" ? null : values.expectedEndDate;
  if (expectedEndDate !== project.expectedEndDate) {
    patch.expectedEndDate = expectedEndDate;
  }

  const budget = values.budget.trim() === "" ? null : Number(values.budget);
  if (budget !== (project.budget === null ? null : Number(project.budget))) {
    patch.budget = budget;
  }

  return patch;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [user, setUser] = useState<AuthUserWithCompany | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [values, setValues] = useState<DetailsFormValues>({
    name: "",
    description: "",
    location: "",
    clientInfo: "",
    startDate: "",
    expectedEndDate: "",
    budget: "",
  });
  const [progressInput, setProgressInput] = useState("0");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [me, projectData] = await Promise.all([
          apiGet<AuthUserWithCompany>("/auth/me"),
          apiGet<Project>(`/projects/${projectId}`),
        ]);

        if (cancelled) {
          return;
        }

        setUser(me);
        setProject(projectData);
        setValues(fromProject(projectData));
        setProgressInput(String(projectData.progressPercentage));
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

  const availableStatuses = useMemo(() => {
    if (project == null) {
      return [];
    }

    return PROJECT_STATUSES.filter(
      (status) => status !== project.status && canTransitionProjectStatus(project.status, status),
    );
  }, [project]);

  const canEdit =
    user != null && project != null && canManageProject(user.role, project.managerId, user.id);

  async function handleSaveDetails(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (project == null) {
      return;
    }

    setActionError(null);
    setActionSuccess(false);

    const payload = buildDetailsPatch(project, values);

    if (Object.keys(payload).length === 0) {
      return;
    }

    const parsed = updateProjectSchema.safeParse(payload);

    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? "Please check the highlighted fields.");
      return;
    }

    setSaving(true);

    try {
      const updated = await apiPatch<Project>(`/projects/${project.id}`, parsed.data);
      setProject(updated);
      setValues(fromProject(updated));
      setActionSuccess(true);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(nextStatus: ProjectStatus): Promise<void> {
    if (project == null) {
      return;
    }

    setActionError(null);
    setActionSuccess(false);

    const parsed = updateProjectStatusSchema.safeParse({ status: nextStatus });

    if (!parsed.success) {
      return;
    }

    setSaving(true);

    try {
      const updated = await apiPatch<Project>(`/projects/${project.id}/status`, parsed.data);
      setProject(updated);
      setValues(fromProject(updated));
      setActionSuccess(true);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleProgressUpdate(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (project == null) {
      return;
    }

    setActionError(null);
    setActionSuccess(false);

    const parsed = updateProjectProgressSchema.safeParse({ progressPercentage: Number(progressInput) });

    if (!parsed.success) {
      setActionError("Progress must be a whole number between 0 and 100.");
      return;
    }

    setSaving(true);

    try {
      const updated = await apiPatch<Project>(`/projects/${project.id}/progress`, parsed.data);
      setProject(updated);
      setProgressInput(String(updated.progressPercentage));
      setActionSuccess(true);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading project...</p>;
  }

  if (loadError != null || project == null) {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Project</h1>
        <p role="alert" className="mt-4 text-sm text-red-600">
          {loadError ?? "Unable to load project."}
        </p>
        <Link href="/projects" className="mt-4 inline-block text-sm font-medium text-slate-500 hover:text-slate-900">
          Back to projects
        </Link>
      </div>
    );
  }

  const statusLabel = PROJECT_STATUS_LABELS[project.status];

  return (
    <div>
      <Link href="/projects" className="text-sm font-medium text-slate-500 hover:text-slate-900">
        Back to projects
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {statusLabel} · {project.progressPercentage}% complete
          </p>
        </div>
        {canEdit && availableStatuses.length > 0 && (
          <select
            aria-label="Change project status"
            value=""
            onChange={(event) => {
              if (event.target.value !== "") {
                void handleStatusChange(event.target.value as ProjectStatus);
              }
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          >
            <option value="">Change status...</option>
            {availableStatuses.map((status) => (
              <option key={status} value={status}>
                {PROJECT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-slate-500">Description</dt>
          <dd className="mt-1 text-sm text-slate-900">{project.description ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Location</dt>
          <dd className="mt-1 text-sm text-slate-900">{project.location ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Client info</dt>
          <dd className="mt-1 text-sm text-slate-900">{project.clientInfo ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Manager ID</dt>
          <dd className="mt-1 text-sm text-slate-900">{project.managerId ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Start date</dt>
          <dd className="mt-1 text-sm text-slate-900">{project.startDate ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Expected end date</dt>
          <dd className="mt-1 text-sm text-slate-900">{project.expectedEndDate ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Actual end date</dt>
          <dd className="mt-1 text-sm text-slate-900">{project.actualEndDate ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Budget</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {project.budget == null ? "—" : `$${project.budget}`}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Status</dt>
          <dd className="mt-1 text-sm text-slate-900">{statusLabel}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Progress</dt>
          <dd className="mt-1 text-sm text-slate-900">{project.progressPercentage}%</dd>
        </div>
      </dl>

      {canEdit && (
        <div className="mt-8 flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Manage project</h2>
            {actionError != null && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {actionError}
              </p>
            )}
            {actionSuccess && (
              <p role="status" className="mt-2 text-sm text-emerald-600">
                Changes saved.
              </p>
            )}
          </div>

          <form
            onSubmit={(event) => {
              void handleSaveDetails(event);
            }}
            className="grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2"
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
            <label
              htmlFor="project-client-info"
              className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2"
            >
              Client info
              <textarea
                id="project-client-info"
                rows={3}
                value={values.clientInfo}
                onChange={(event) => {
                  setValues({ ...values, clientInfo: event.target.value });
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

            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </form>

          <form
            onSubmit={(event) => {
              void handleProgressUpdate(event);
            }}
            className="flex items-end gap-3 rounded-md border border-slate-200 bg-white p-4"
          >
            <label htmlFor="project-progress" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Progress (%)
              <input
                id="project-progress"
                type="number"
                min="0"
                max="100"
                step="1"
                value={progressInput}
                onChange={(event) => {
                  setProgressInput(event.target.value);
                }}
                className="w-28 rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Update progress"}
            </button>
          </form>
        </div>
      )}

      <TeamSection projectId={project.id} managerId={project.managerId} canManage={canEdit} />
    </div>
  );
}
