import { CreateDocumentButton } from "@/components/domain/document-components";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/feedback";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { api, ApiError } from "@/lib/api-client";
import type { Document, Project } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${String(units[i])}`;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  let documents: Document[] = [];
  let projects: Project[] = [];
  let error: string | null = null;

  try {
    [documents, projects] = await Promise.all([
      api.get<{ items: Document[] }>(`/documents`, { pageSize: 50, projectId }).then((r) => r.items),
      api.get<{ items: Project[] }>(`/projects`, { pageSize: 100 }).then((r) => r.items),
    ]);
  } catch (err) {
    error = err instanceof ApiError ? err.message : "Failed to load documents.";
  }

  const canUpload = can("uploadDocument", user.role);

  return (
    <div>
      <PageHeader
        title="Documents"
        description={projectId ? "Documents for this project." : "Project documents and files."}
        action={canUpload ? <CreateDocumentButton projects={projects} /> : null}
      />

      {error ? (
        <ErrorState message={error} />
      ) : documents.length === 0 ? (
        <EmptyState title="No documents yet" description="Upload a document to share with your team." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📄</span>
                    <div>
                      <p className="font-medium text-slate-900">{doc.name}</p>
                      <p className="text-xs text-slate-500">{doc.project.name}</p>
                    </div>
                  </div>
                  <Badge tone="blue">{doc.type}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{formatBytes(doc.sizeBytes)}</span>
                  <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">by {doc.uploadedBy.name}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
