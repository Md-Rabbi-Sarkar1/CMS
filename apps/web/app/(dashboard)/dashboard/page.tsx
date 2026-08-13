import Link from "next/link";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ErrorState, PageHeader, Spinner } from "@/components/ui/feedback";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api-client";
import type { DashboardStats, ProjectProgress } from "@/lib/types";

export const dynamic = "force-dynamic";

function StatCard({ label, value, tone = "gray" }: { label: string; value: string | number; tone?: string }) {
  const toneClass: Record<string, string> = {
    gray: "text-slate-900",
    blue: "text-blue-600",
    green: "text-green-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };
  return (
    <Card>
      <CardBody>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className={`mt-2 text-3xl font-bold ${String(toneClass[tone])}`}>{value}</p>
      </CardBody>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  let stats: DashboardStats | null = null;
  let progress: ProjectProgress[] = [];
  let error: string | null = null;

  try {
    if (can("viewAnalytics", user.role)) {
      [stats, progress] = await Promise.all([
        api.get<DashboardStats>("/analytics/dashboard"),
        api.get<ProjectProgress[]>("/analytics/project-progress"),
      ]);
    } else {
      progress = await api.get<ProjectProgress[]>("/analytics/project-progress");
    }
  } catch (err) {
    error = err instanceof ApiError ? err.message : "Failed to load dashboard data.";
  }

  if (error) {
    return (
      <div>
        <PageHeader title={`Welcome, ${user.name}`} description="Here's what's happening in your workspace." />
        <ErrorState message={error} />
      </div>
    );
  }

  if (!stats && progress.length === 0) {
    return (
      <div>
        <PageHeader title={`Welcome, ${user.name}`} description="Here's what's happening in your workspace." />
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name}`}
        description="Here's what's happening in your workspace."
        action={
          can("createProject", user.role) ? (
            <Link
              href="/projects"
              className="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
            >
              View projects
            </Link>
          ) : null
        }
      />

      {stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Projects" value={stats.projects.total} tone="blue" />
          <StatCard label="Active Projects" value={stats.projects.active} tone="green" />
          <StatCard label="Completed Projects" value={stats.projects.completed} />
          <StatCard label="On Hold" value={stats.projects.onHold} tone="amber" />
          <StatCard label="Total Tasks" value={stats.tasks.total} tone="blue" />
          <StatCard label="Completed Tasks" value={stats.tasks.completed} tone="green" />
          <StatCard label="Blocked Tasks" value={stats.tasks.blocked} tone="red" />
          <StatCard label="Open Issues" value={stats.issues.open} tone="red" />
          <StatCard label="Pending Expenses" value={stats.expenses.pendingCount} tone="amber" />
          <StatCard label="Pending Amount" value={`$${Number(stats.expenses.pendingAmount).toLocaleString()}`} />
          <StatCard label="Approved Expenses" value={`$${Number(stats.expenses.approvedAmount).toLocaleString()}`} />
          <StatCard label="Low Stock Materials" value={stats.materials.lowStock} tone="red" />
        </div>
      ) : null}

      <div className="mt-8">
        <Card>
          <CardHeader title="Project Progress" description="Active projects and their completion status." />
          <CardBody className="!p-0">
            {progress.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No projects assigned yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Project</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Progress</th>
                      <th className="px-5 py-3 font-medium">Tasks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {progress.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-900">
                          <Link href={`/projects/${p.id}`} className="text-blue-600 hover:text-blue-700">
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full bg-blue-600" style={{ width: `${String(p.progressPercentage)}%` }} />
                            </div>
                            <span className="text-xs text-slate-600">{p.progressPercentage}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-700">
                          {p.taskCompleted}/{p.taskTotal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
