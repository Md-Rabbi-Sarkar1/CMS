"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { Company } from "@/lib/types";

export function EditCompanyForm({ company }: { company: Company }) {
  const router = useRouter();
  const [name, setName] = useState(company.name);
  const [logoUrl, setLogoUrl] = useState(company.logoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.patch("/company", {
        name,
        logoUrl: logoUrl || undefined,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update company.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
      <Field label="Company name" htmlFor="name">
        <Input id="name" required value={name} onChange={(e) => { setName(e.target.value); }} />
      </Field>
      <Field label="Logo URL (optional)" htmlFor="logoUrl">
        <Input id="logoUrl" type="url" value={logoUrl} onChange={(e) => { setLogoUrl(e.target.value); }} />
      </Field>
      <Field label="Slug">
        <Input value={company.slug} disabled />
      </Field>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" loading={loading}>
        Save changes
      </Button>
    </form>
  );
}
