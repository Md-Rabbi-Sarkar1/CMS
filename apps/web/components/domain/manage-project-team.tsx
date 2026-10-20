"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import type { ProjectMember, User } from "@/lib/types";

export function ManageProjectTeam({
  projectId,
  members,
  users,
}: {
  projectId: string;
  members: ProjectMember[];
  users: User[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const memberIds = new Set(members.map((member) => member.userId));
  const availableUsers = users.filter((user) => !memberIds.has(user.id));

  async function addMember() {
    if (!userId) return;
    setError(null);
    setLoading(true);
    try {
      await api.post(`/projects/${projectId}/members`, { userId });
      setUserId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add team member.");
    } finally {
      setLoading(false);
    }
  }

  if (users.length === 0) {
    return <p className="mt-3 text-xs text-slate-500">No company users are available to assign.</p>;
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Add team member</p>
      <div className="flex gap-2">
        <Select value={userId} onChange={(event) => { setUserId(event.target.value); }}>
          <option value="">Select a user</option>
          {availableUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.role.replace(/_/g, " ")})
            </option>
          ))}
        </Select>
        <Button type="button" onClick={() => { void addMember(); }} loading={loading} disabled={!userId}>
          Add
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
