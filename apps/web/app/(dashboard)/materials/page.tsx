import { CreateMaterialButton, RecordTransactionButton } from "@/components/domain/material-components";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/feedback";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { api, ApiError } from "@/lib/api-client";
import type { InventoryTransaction, Material, Project } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  let materials: Material[] = [];
  let projects: Project[] = [];
  let error: string | null = null;

  try {
    [materials, projects] = await Promise.all([
      api.get<{ items: Material[] }>(`/materials`, { pageSize: 100 }).then((r) => r.items),
      api.get<{ items: Project[] }>(`/projects`, { pageSize: 100 }).then((r) => r.items),
    ]);
  } catch (err) {
    error = err instanceof ApiError ? err.message : "Failed to load materials.";
  }

  const canManage = can("manageMaterial", user.role);
  const canRecord = can("recordInventory", user.role);
  const projectsForTx = projects.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div>
      <PageHeader
        title="Materials"
        description="Track inventory and material stock levels."
        action={canManage ? <CreateMaterialButton /> : null}
      />

      {error ? (
        <ErrorState message={error} />
      ) : materials.length === 0 ? (
        <EmptyState title="No materials yet" description="Add materials to track inventory." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {materials.map((material) => (
            <Card key={material.id}>
              <CardHeader
                title={material.name}
                description={`${material.currentStock} ${material.unit} · reorder at ${material.reorderLevel}`}
                action={
                  material.lowStock ? <Badge tone="red">Low stock</Badge> : <Badge tone="green">In stock</Badge>
                }
              />
              <CardBody>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">{material.transactionCount} transactions</p>
                  {canRecord ? (
                    <RecordTransactionButton materialId={material.id} projects={projectsForTx} />
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {materials.length > 0 ? (
        <div className="mt-8">
          <RecentTransactions materialIds={materials.map((m) => m.id)} />
        </div>
      ) : null}
    </div>
  );
}

async function RecentTransactions({ materialIds }: { materialIds: string[] }) {
  let transactions: InventoryTransaction[] = [];
  let txError: string | null = null;

  try {
    const all = await Promise.all(
      materialIds.slice(0, 10).map((id) =>
        api
          .get<{ items: InventoryTransaction[] }>(`/materials/${id}/transactions`, { pageSize: 5 })
          .then((r) => r.items),
      ),
    );
    transactions = all.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  } catch (err) {
    txError = err instanceof ApiError ? err.message : "Failed to load transactions.";
  }

  if (txError) {
    return <ErrorState message={txError} />;
  }

  return (
    <Card>
      <CardHeader title="Recent transactions" description="Latest inventory movements." />
      <CardBody className="!p-0">
        {transactions.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-500">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Material</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Quantity</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{tx.material.name}</td>
                    <td className="px-4 py-3">
                      <Badge tone={tx.type === "PURCHASE" ? "green" : tx.type === "USAGE" ? "amber" : "blue"}>
                        {tx.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {tx.quantity} {tx.material.unit}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{tx.note ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
