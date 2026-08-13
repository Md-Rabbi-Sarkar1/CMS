"use client";

import { useState } from "react";

import { CreateReportModal } from "./create-report-modal";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import type { Project, User } from "@/lib/types";

export function CreateReportButton({ user, projects }: { user: User; projects: Project[] }) {
  const [open, setOpen] = useState(false);

  if (!can("submitReport", user.role) || projects.length === 0) return null;

  return (
    <>
      <Button onClick={() => { setOpen(true); }}>New report</Button>
      <CreateReportModal open={open} onClose={() => { setOpen(false); }} projects={projects} />
    </>
  );
}
