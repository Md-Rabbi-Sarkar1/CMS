"use client";

import { useEffect, useState } from "react";

import { ApiError, apiGet, type ProjectDashboard } from "@/lib/api-client";

interface StatCardProps {
  label: string;
  value: string;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

interface ProjectDashboardProps {
  projectId: string;
}

export default function ProjectDashboard({ projectId }: ProjectDashboardProps) {
  const [dashboard, setDashboard] = useState<ProjectDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const data = await apiGet<ProjectDashboard>(`/analytics/projects/${projectId}`);

        if (!cancelled) {
          setDashboard(data);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("Failed to load project dashboard data.");
          }
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

  if (loading) {
    return <p className="text-sm text-slate-500">Loading project dashboard...</p>;
  }

  if (error != null) {
    return (
      <div>
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      </div>
    );
  }

  if (dashboard == null) {
    return <p className="text-sm text-slate-500">No project dashboard data available.</p>;
  }

  const budgetDisplay = dashboard.budget == null ? "—" : `$${dashboard.budget}`;

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Project Dashboard</h2>

      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Progress" value={`${String(dashboard.progressPercentage)}%`} />
        <StatCard label="Budget" value={budgetDisplay} />
        <StatCard label="Total Tasks" value={String(dashboard.totalTasks)} />
        <StatCard label="Completed Tasks" value={String(dashboard.completedTasks)} />
        <StatCard label="Open Tasks" value={String(dashboard.openTasks)} />
        <StatCard label="Open Issues" value={String(dashboard.openIssues)} />
      </dl>

      <div className="mt-6 rounded-md border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-medium text-slate-700">Recent Activity</h3>
        <p className="mt-2 text-sm text-slate-500">Recent activity will be available in a future phase.</p>
      </div>
    </div>
  );
}
