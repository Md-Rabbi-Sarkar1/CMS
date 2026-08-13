import { CreateIssueButton } from "@/components/domain/issue-components";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/feedback";
import { getCurrentUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api-client";
import type { Issue, Project } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  let issues: Issue[] = [];
  let projects: Project[] = [];
  let error: string | null = null;

  try {
    [issues, projects] = await Promise.all([
      api.get<{ items: Issue[] }>(`/issues`, { pageSize: 50, projectId }).then((r) => r.items),
      api.get<{ items: Project[] }>(`/projects`, { pageSize: 100 }).then((r) => r.items),
    ]);
  } catch (err) {
    error = err instanceof ApiError ? err.message : "Failed to load issues.";
  }

  return (
    <div>
      <PageHeader
        title="Issues"
        description={projectId ? "Issues for this project." : "Track and resolve issues."}
        action={projects.length > 0 ? <CreateIssueButton projects={projects} /> : null}
      />

      {error ? (
        <ErrorState message={error} />
      ) : issues.length === 0 ? (
        <EmptyState title="No issues reported" description="Report an issue to track and resolve it." />
      ) : (
        <Card>
          <CardBody className="!p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Reporter</th>
                    <th className="px-4 py-3 font-medium">Assignee</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{issue.title}</td>
                      <td className="px-4 py-3 text-slate-700">{issue.project.name}</td>
                      <td className="px-4 py-3 text-slate-700">{issue.reporter.name}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {issue.assignee ? issue.assignee.name : "Unassigned"}
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={issue.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={issue.status} />
                      </td>
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
