"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { loginSchema } from "@construction-ops/validation";

import { ApiError, apiPost, type AuthUser } from "@/lib/api-client";

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });

    if (!parsed.success) {
      const errors: FieldErrors = {};

      for (const issue of parsed.error.issues) {
        const field = issue.path[0];

        if (field === "email" || field === "password") {
          errors[field] = issue.message;
        }
      }

      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      await apiPost<AuthUser>("/auth/login", parsed.data);
      router.push("/settings/company");
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError("Unable to sign in. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Construction Operations SaaS
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Sign in</h1>
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="mt-8 flex flex-col gap-4"
      >
        <label htmlFor="email" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Email
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
          />
          {fieldErrors.email != null && (
            <span className="text-sm text-red-600">{fieldErrors.email}</span>
          )}
        </label>
        <label htmlFor="password" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Password
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900"
          />
          {fieldErrors.password != null && (
            <span className="text-sm text-red-600">{fieldErrors.password}</span>
          )}
        </label>
        {formError != null && <p role="alert" className="text-sm text-red-600">{formError}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
