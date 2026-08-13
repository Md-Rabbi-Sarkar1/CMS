import Link from "next/link";

import { PageHeader } from "@/components/ui/feedback";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <PageHeader
          title="Page not found"
          description="The page you are looking for does not exist or has been moved."
        />
        <Link
          href="/dashboard"
          className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
