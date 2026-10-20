"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { login } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/feedback";

const DEMO_LOGINS = [
  { label: "Login as Admin", email: "admin@demo.local", password: "Password123!" },
  { label: "Login as Project Manager", email: "mdrabbisarkar70@gmail.com", password: "11111111" },
  { label: "Login as Engineer", email: "mdrabbisarkar71@gmail.com", password: "11111111" },
  { label: "Login as Worker", email: "mdrabbisarkar72@gmail.com", password: "11111111" },
] as const;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin(demoEmail: string, demoPassword: string) {
    setError(null);
    setLoading(true);
    try {
      await login(demoEmail, demoPassword);
      router.replace(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Demo login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    void handleSubmit(e);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Construction Operations</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your workspace</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); }}
              placeholder="you@company.com"
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => { setPassword(e.target.value); }}
              placeholder="••••••••"
            />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
          {process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true" ? (
            <div className="border-t border-slate-200 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Development quick login</p>
              <div className="grid grid-cols-1 gap-2">
                {DEMO_LOGINS.map((demo) => (
                  <Button
                    key={demo.email}
                    type="button"
                    variant="secondary"
                    className="w-full"
                    loading={loading && email === demo.email}
                    disabled={loading}
                    onClick={() => { void handleDemoLogin(demo.email, demo.password); }}
                  >
                    {demo.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Spinner />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
