"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

const ROLES = ["ADMIN", "PROJECT_MANAGER", "ENGINEER", "WORKER"];

export function InviteUserButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("WORKER");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<{ token: string }>("/users/invitations", { name, email, role });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setInviteLink(`${origin}/accept-invite?token=${result.token}`);
      setName("");
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send invitation.");
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (inviteLink && typeof navigator !== "undefined") {
      void navigator.clipboard.writeText(inviteLink);
    }
  }

  return (
    <>
      <Button onClick={() => { setOpen(true); }}>Invite user</Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setInviteLink(null);
        }}
        title="Invite team member"
        footer={
          inviteLink ? (
            <Button
              onClick={() => {
                setOpen(false);
                setInviteLink(null);
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => { setOpen(false); }}>
                Cancel
              </Button>
              <Button type="submit" form="invite-form" loading={loading}>
                Send invitation
              </Button>
            </>
          )
        }
      >
        {inviteLink ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Invitation created. Share this link with the new team member:
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteLink}
                className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700"
              />
              <Button variant="secondary" size="sm" onClick={copyLink}>
                Copy
              </Button>
            </div>
          </div>
        ) : (
          <form id="invite-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
            <Field label="Full name" htmlFor="name">
              <Input id="name" required value={name} onChange={(e) => { setName(e.target.value); }} />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" required value={email} onChange={(e) => { setEmail(e.target.value); }} />
            </Field>
            <Field label="Role" htmlFor="role">
              <Select id="role" value={role} onChange={(e) => { setRole(e.target.value); }}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </Field>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </form>
        )}
      </Modal>
    </>
  );
}
