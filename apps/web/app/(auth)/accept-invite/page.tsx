"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/feedback";

interface VerificationResponse {
  email: string;
  role: string;
  companyName: string;
}

function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [status, setStatus] = useState<"loading" | "invalid" | "ready">("loading");
  const [invitation, setInvitation] = useState<VerificationResponse | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    api
      .get<VerificationResponse>(`/users/invitations/verify/${token}`)
      .then((data) => {
        if (cancelled) return;
        setInvitation(data);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/users/invitations/accept", { token, name, password });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to accept invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  const onSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    void handleSubmit(e);
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    );
  }

  if (status === "invalid" || !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm rounded-lg border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-red-900">Invalid invitation</h1>
          <p className="mt-2 text-sm text-slate-600">
            This invitation link is invalid, expired, or has already been used.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => { router.replace("/login"); }}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Accept Invitation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Join <span className="font-medium">{invitation.companyName}</span> as{" "}
            <span className="font-medium">{invitation.role.replace(/_/g, " ")}</span>
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Field label="Email">
            <Input value={invitation.email} disabled />
          </Field>
          <Field label="Full name" htmlFor="name">
            <Input id="name" required value={name} onChange={(e) => { setName(e.target.value); }} placeholder="Your name" />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => { setPassword(e.target.value); }}
              placeholder="At least 8 characters"
            />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" loading={submitting}>
            Create account & sign in
          </Button>
                  </form>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Spinner />
        </div>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
