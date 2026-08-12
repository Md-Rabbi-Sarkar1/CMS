"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { updateCompanySchema } from "@construction-ops/validation";

import { ApiError, apiGet, apiPatch, type AuthUserWithCompany, type Company } from "@/lib/api-client";

interface CompanyFormValues {
  name: string;
  logoUrl: string;
  contactInfo: string;
  address: string;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function toPatchInput(values: CompanyFormValues) {
  return updateCompanySchema.safeParse({
    name: values.name.trim(),
    logoUrl: values.logoUrl.trim() === "" ? null : values.logoUrl.trim(),
    contactInfo: values.contactInfo.trim() === "" ? null : values.contactInfo.trim(),
    address: values.address.trim() === "" ? null : values.address.trim(),
  });
}

export default function CompanySettingsPage() {
  const [user, setUser] = useState<AuthUserWithCompany | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [values, setValues] = useState<CompanyFormValues>({
    name: "",
    logoUrl: "",
    contactInfo: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [me, companyData] = await Promise.all([
          apiGet<AuthUserWithCompany>("/auth/me"),
          apiGet<Company>("/company"),
        ]);

        if (cancelled) {
          return;
        }

        setUser(me);
        setCompany(companyData);
        setValues({
          name: companyData.name,
          logoUrl: companyData.logoUrl ?? "",
          contactInfo: companyData.contactInfo ?? "",
          address: companyData.address ?? "",
        });
      } catch (error) {
        if (!cancelled) {
          setLoadError(toErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    const parsed = toPatchInput(values);

    if (!parsed.success) {
      setSaveError(parsed.error.issues[0]?.message ?? "Please check the highlighted fields.");
      return;
    }

    setSaving(true);

    try {
      const updated = await apiPatch<Company>("/company", parsed.data);
      setCompany(updated);
      setSaveSuccess(true);
    } catch (error) {
      setSaveError(toErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6">
        <p className="text-sm text-slate-500">Loading company settings...</p>
      </main>
    );
  }

  if (loadError != null || user == null || company == null) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6">
        <h1 className="text-3xl font-semibold text-slate-900">Company settings</h1>
        <p role="alert" className="mt-4 text-sm text-red-600">
          {loadError ?? "Unable to load company settings."}
        </p>
      </main>
    );
  }

  const isAdmin = user.role === "ADMIN";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6">
      <Link href="/projects" className="text-sm font-medium text-slate-500 hover:text-slate-900">
        Back to projects
      </Link>
      <p className="mt-6 text-sm font-medium uppercase tracking-wide text-slate-500">
        {company.name}
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Company settings</h1>

      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="mt-8 flex flex-col gap-4"
      >
        <label htmlFor="company-name" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Company name
          <input
            id="company-name"
            value={values.name}
            disabled={!isAdmin}
            onChange={(event) => {
              setValues({ ...values, name: event.target.value });
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 disabled:bg-slate-100"
          />
        </label>

        <label htmlFor="company-slug" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Slug
          <input
            id="company-slug"
            value={company.slug}
            disabled
            readOnly
            className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-base text-slate-500"
          />
        </label>

        <label htmlFor="company-logo-url" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Logo URL
          <input
            id="company-logo-url"
            type="url"
            value={values.logoUrl}
            disabled={!isAdmin}
            onChange={(event) => {
              setValues({ ...values, logoUrl: event.target.value });
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 disabled:bg-slate-100"
          />
        </label>

        <label htmlFor="company-contact" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Contact info
          <textarea
            id="company-contact"
            rows={3}
            value={values.contactInfo}
            disabled={!isAdmin}
            onChange={(event) => {
              setValues({ ...values, contactInfo: event.target.value });
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 disabled:bg-slate-100"
          />
        </label>

        <label htmlFor="company-address" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Address
          <textarea
            id="company-address"
            rows={3}
            value={values.address}
            disabled={!isAdmin}
            onChange={(event) => {
              setValues({ ...values, address: event.target.value });
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 disabled:bg-slate-100"
          />
        </label>

        {saveError != null && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
        {saveSuccess && <p role="status" className="text-sm text-emerald-600">Company settings saved.</p>}

        {isAdmin && (
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        )}
      </form>
    </main>
  );
}
