import { InviteUserButton } from "@/components/domain/invite-user-button";
import { RoleBadge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api-client";
import type { Invitation, PaginatedResponse, User } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage() {
  let users: User[] = [];
  let invitations: Invitation[] = [];
  let error: string | null = null;

  try {
    [users, invitations] = await Promise.all([
      api.get<PaginatedResponse<User>>("/users", { pageSize: 100 }).then((r) => r.items),
      api.get<Invitation[]>("/users/invitations").catch((): Invitation[] => []),
    ]);
  } catch (err) {
    error = err instanceof ApiError ? err.message : "Failed to load users.";
  }

  const pendingInvitations = invitations.filter((i) => i.status === "PENDING");

  return (
    <div>
      <PageHeader
        title="Team Members"
        description="Manage users and invitations."
        action={<InviteUserButton />}
      />

      {error ? (
        <ErrorState message={error} />
      ) : (
        <div className="space-y-8">
          <Card>
            <CardBody className="!p-0">
              {users.length === 0 ? (
                <EmptyState title="No users" description="Invite team members to join." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                          <td className="px-4 py-3 text-slate-700">{u.email}</td>
                          <td className="px-4 py-3">
                            <RoleBadge role={u.role} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          {pendingInvitations.length > 0 ? (
            <Card>
              <CardBody className="!p-0">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h3 className="text-base font-semibold text-slate-900">Pending invitations</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Expires</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingInvitations.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{inv.email}</td>
                          <td className="px-4 py-3">
                            <RoleBadge role={inv.role} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={inv.status} />
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {new Date(inv.expiresAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
