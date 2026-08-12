"use client";

import { useEffect, useState } from "react";

import { ApiError, apiGet, type CompanyDashboard } from "@/lib/api-client";

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

export default function CompanyDashboard() {
  const [dashboard, setDashboard] = useState<CompanyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const data = await apiGet<CompanyDashboard>("/analytics/company");

        if (!cancelled) {
          setDashboard(data);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("Failed to load dashboard data.");
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
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading dashboard...</p>;
  }

  if (error != null) {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Company Dashboard</h1>
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      </div>
    );
  }

  if (dashboard == null) {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Company Dashboard</h1>
        <p className="mt-4 text-sm text-slate-500">No dashboard data available.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">Company Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Overview of your company's projects and tasks.</p>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Projects" value={String(dashboard.totalProjects)} />
        <StatCard label="Active Projects" value={String(dashboard.activeProjects)} />
        <StatCard label="Completed Projects" value={String(dashboard.completedProjects)} />
        <StatCard label="Team Members" value={String(dashboard.totalTeamMembers)} />
        <StatCard label="Total Tasks" value={String(dashboard.totalTasks)} />
        <StatCard label="Completed Tasks" value={String(dashboard.completedTasks)} />
        <StatCard label="Open Tasks" value={String(dashboard.openTasks)} />
      </dl>
    </div>
  );
}
