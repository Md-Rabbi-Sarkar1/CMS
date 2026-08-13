"use client";

import { useState } from "react";

import { CreateProjectModal } from "./create-project-modal";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import type { User } from "@/lib/types";

export function CreateProjectButton({ user }: { user: User }) {
  const [open, setOpen] = useState(false);

  if (!can("createProject", user.role)) return null;

  return (
    <>
      <Button onClick={() => { setOpen(true); }}>New project</Button>
      <CreateProjectModal open={open} onClose={() => { setOpen(false); }} />
    </>
  );
}
