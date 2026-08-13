import { CreateReportButton } from "@/components/domain/create-report-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/feedback";
import { getCurrentUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api-client";
import type { DailyWorkReport, Project } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  let reports: DailyWorkReport[] = [];
  let projects: Project[] = [];
  let error: string | null = null;

  try {
    [reports, projects] = await Promise.all([
      api
        .get<{ items: DailyWorkReport[] }>(`/reports`, { pageSize: 50, projectId })
        .then((r) => r.items)
        .catch(() => []),
      api.get<{ items: Project[] }>(`/projects`, { pageSize: 100 }).then((r) => r.items),
    ]);
  } catch (err) {
    error = err instanceof ApiError ? err.message : "Failed to load reports.";
  }

  return (
    <div>
      <PageHeader
        title="Daily Work Reports"
        description={projectId ? "Reports for this project." : "Daily work reports across your projects."}
        action={<CreateReportButton user={user} projects={projects} />}
      />

      {error ? (
        <ErrorState message={error} />
      ) : reports.length === 0 ? (
        <EmptyState title="No reports yet" description="Submit a daily work report to track progress." />
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader
                title={report.project.name}
                description={`${report.reportDate} · ${report.hoursWorked}h · ${String(report.progressPct)}% progress`}
                action={
                  <span className="text-xs text-slate-500">
                    by {report.submittedBy.name}
                  </span>
                }
              />
              <CardBody>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-500">Work completed</p>
                    <p className="mt-1 text-sm text-slate-700">{report.workCompleted}</p>
                  </div>
                  {report.materialsUsed ? (
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-500">Materials used</p>
                      <p className="mt-1 text-sm text-slate-700">{report.materialsUsed}</p>
                    </div>
                  ) : null}
                  {report.problemsEncountered ? (
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-500">Problems</p>
                      <p className="mt-1 text-sm text-slate-700">{report.problemsEncountered}</p>
                    </div>
                  ) : null}
                  {report.notes ? (
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-500">Notes</p>
                      <p className="mt-1 text-sm text-slate-700">{report.notes}</p>
                    </div>
                  ) : null}
                  {report.workers.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-500">Workers</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {report.workers.map((w) => (
                          <span
                            key={w.id}
                            className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                          >
                            {w.name}
                            {w.role ? ` · ${w.role}` : ""}
                            {w.hoursWorked != null ? ` · ${String(w.hoursWorked)}h` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
