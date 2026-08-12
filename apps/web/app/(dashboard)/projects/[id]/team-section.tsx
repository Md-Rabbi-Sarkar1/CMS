"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ApiError,
  apiDelete,
  apiGet,
  apiPost,
  type CompanyUser,
  type ProjectMember,
} from "@/lib/api-client";

interface TeamSectionProps {
  projectId: string;
  managerId: string | null;
  canManage: boolean;
}

type UsersStatus = "loading" | "loaded" | "fallback" | "error";

const MEMBER_LIST_PAGE_SIZE = 20;
const USER_LIST_PAGE_SIZE = 100;

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (error.status === 403) {
      return "You do not have permission to manage this team.";
    }

    if (error.status === 404) {
      return "Project, member, or user not found.";
    }

    if (error.status === 409) {
      return error.message;
    }

    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function formatAssignedAt(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function TeamSection({ projectId, managerId, canManage }: TeamSectionProps) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [usersStatus, setUsersStatus] = useState<UsersStatus>("loading");
  const [usersError, setUsersError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [manualUserId, setManualUserId] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const refreshMembers = useCallback(async (): Promise<void> => {
    const result = await apiGet<{ members: ProjectMember[] }>(
      `/projects/${projectId}/members?page=1&pageSize=${String(MEMBER_LIST_PAGE_SIZE)}`,
    );
    setMembers(result.members);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    async function loadMembers(): Promise<void> {
      try {
        const result = await apiGet<{ members: ProjectMember[] }>(
          `/projects/${projectId}/members?page=1&pageSize=${String(MEMBER_LIST_PAGE_SIZE)}`,
        );

        if (!cancelled) {
          setMembers(result.members);
        }
      } catch (error) {
        if (!cancelled) {
          setMembersError(toErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setMembersLoading(false);
        }
      }
    }

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!canManage) {
      return;
    }

    let cancelled = false;

    async function loadUsers(): Promise<void> {
      try {
        const result = await apiGet<{ users: CompanyUser[] }>(`/users?page=1&pageSize=${String(USER_LIST_PAGE_SIZE)}`);

        if (!cancelled) {
          setCompanyUsers(result.users);
          setUsersStatus("loaded");
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 403) {
            setUsersStatus("fallback");
          } else {
            setUsersStatus("error");
            setUsersError(toErrorMessage(error));
          }
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [canManage]);

  const candidates = companyUsers.filter(
    (user) => user.status === "ACTIVE" && !members.some((member) => member.userId === user.id),
  );

  async function handleAddMember(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setAddError(null);
    setAddSuccess(false);

    const userId = selectedUserId !== "" ? selectedUserId : manualUserId.trim();

    if (userId === "") {
      setAddError("Select a user to add.");
      return;
    }

    setAdding(true);

    try {
      await apiPost<ProjectMember>(`/projects/${projectId}/members`, { userId });
      setSelectedUserId("");
      setManualUserId("");
      await refreshMembers();
      setAddSuccess(true);
    } catch (error) {
      setAddError(toErrorMessage(error));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMember(member: ProjectMember): Promise<void> {
    if (!window.confirm(`Remove ${member.name} from this project?`)) {
      return;
    }

    setRemoveError(null);
    setRemovingUserId(member.userId);

    try {
      await apiDelete(`/projects/${projectId}/members/${member.userId}`);
      await refreshMembers();
    } catch (error) {
      setRemoveError(toErrorMessage(error));
    } finally {
      setRemovingUserId(null);
    }
  }

  if (membersLoading) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Team</h2>
        <p className="mt-3 text-sm text-slate-500">Loading team...</p>
      </section>
    );
  }

  if (membersError != null) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Team</h2>
        <p role="alert" className="mt-3 text-sm text-red-600">
          {membersError}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">Team</h2>

      {members.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No members yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {members.map((member) => (
            <li key={member.userId} className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-slate-900">{member.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{member.email}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {member.role} · {member.status} · Added {formatAssignedAt(member.assignedAt)}
                  </p>
                </div>
                {canManage && member.userId !== managerId && (
                  <button
                    type="button"
                    disabled={removingUserId === member.userId}
                    onClick={() => {
                      void handleRemoveMember(member);
                    }}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                  >
                    {removingUserId === member.userId ? "Removing..." : "Remove"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {removeError != null && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {removeError}
        </p>
      )}

      {canManage && (
        <form
          onSubmit={(event) => {
            void handleAddMember(event);
          }}
          className="mt-6 rounded-md border border-slate-200 bg-white p-4"
        >
          <h3 className="text-sm font-semibold text-slate-900">Add member</h3>

          {usersStatus === "loaded" ? (
            <label htmlFor="team-user" className="mt-3 flex flex-col gap-1 text-sm font-medium text-slate-700">
              Company user
              <select
                id="team-user"
                value={selectedUserId}
                onChange={(event) => {
                  setSelectedUserId(event.target.value);
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
              >
                <option value="">Select an active company user...</option>
                {candidates.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email}) · {user.role}
                  </option>
                ))}
              </select>
            </label>
          ) : usersStatus === "fallback" ? (
            <label htmlFor="team-user-id" className="mt-3 flex flex-col gap-1 text-sm font-medium text-slate-700">
              User ID
              <input
                id="team-user-id"
                value={manualUserId}
                onChange={(event) => {
                  setManualUserId(event.target.value);
                }}
                placeholder="Active company user ID"
                className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
              />
              <span className="text-xs font-normal text-slate-500">
                The company directory is admin-only. Only ACTIVE users in this company can be added.
              </span>
            </label>
          ) : (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {usersError ?? "Unable to load company users."}
            </p>
          )}

          {usersStatus === "loaded" && candidates.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">No active company users to add.</p>
          )}

          {addError != null && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {addError}
            </p>
          )}
          {addSuccess && (
            <p role="status" className="mt-3 text-sm text-emerald-600">
              Member added.
            </p>
          )}

          <button
            type="submit"
            disabled={adding || (usersStatus === "loaded" && candidates.length === 0)}
            className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add member"}
          </button>
        </form>
      )}
    </section>
  );
}
