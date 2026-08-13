import { EditCompanyForm } from "@/components/domain/edit-company-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState, PageHeader } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api-client";
import type { Company } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompanySettingsPage() {
  let company: Company | null = null;
  let error: string | null = null;

  try {
    company = await api.get<Company>("/company");
  } catch (err) {
    error = err instanceof ApiError ? err.message : "Failed to load company.";
  }

  return (
    <div>
      <PageHeader title="Company Settings" description="Manage your company profile." />
      {error ? (
        <ErrorState message={error} />
      ) : company ? (
        <Card className="max-w-2xl">
          <CardHeader title="Profile" description="Update your company name and branding." />
          <CardBody>
            <EditCompanyForm company={company} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
