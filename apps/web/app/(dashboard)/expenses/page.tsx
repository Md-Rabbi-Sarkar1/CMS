import { CreateExpenseButton, ReviewExpenseButton } from "@/components/domain/expense-components";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/feedback";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { api, ApiError } from "@/lib/api-client";
import type { Expense, Project } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  let expenses: Expense[] = [];
  let projects: Project[] = [];
  let error: string | null = null;

  try {
    [expenses, projects] = await Promise.all([
      api.get<{ items: Expense[] }>(`/expenses`, { pageSize: 50, projectId }).then((r) => r.items),
      api.get<{ items: Project[] }>(`/projects`, { pageSize: 100 }).then((r) => r.items),
    ]);
  } catch (err) {
    error = err instanceof ApiError ? err.message : "Failed to load expenses.";
  }

  const canReview = can("reviewExpense", user.role);

  return (
    <div>
      <PageHeader
        title="Expenses"
        description={projectId ? "Expenses for this project." : "Track and review expenses."}
        action={<CreateExpenseButton projects={projects} />}
      />

      {error ? (
        <ErrorState message={error} />
      ) : expenses.length === 0 ? (
        <EmptyState title="No expenses yet" description="Submit an expense for tracking and approval." />
      ) : (
        <Card>
          <CardBody className="!p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Submitted by</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {expense.project ? expense.project.name : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{expense.category}</td>
                      <td className="px-4 py-3 text-slate-900">${Number(expense.amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-700">{expense.submittedBy.name}</td>
                      <td className="px-4 py-3 text-slate-500">{expense.expenseDate}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={expense.status} />
                      </td>
                      <td className="px-4 py-3">
                        {canReview && expense.status === "PENDING" ? (
                          <ReviewExpenseButton expenseId={expense.id} />
                        ) : null}
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
