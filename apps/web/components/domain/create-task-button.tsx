"use client";

import { useState } from "react";

import { CreateTaskModal } from "./create-task-modal";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import type { ProjectMember, User } from "@/lib/types";

export function CreateTaskButton({
  user,
  projectId,
  members,
}: {
  user: User;
  projectId: string;
  members: ProjectMember[];
}) {
  const [open, setOpen] = useState(false);

  if (!can("createTask", user.role)) return null;

  const assignable = members.map((m) => ({ id: m.user.id, name: m.user.name }));

  return (
    <>
      <Button onClick={() => { setOpen(true); }}>New task</Button>
      <CreateTaskModal open={open} onClose={() => { setOpen(false); }} projectId={projectId} members={assignable} />
    </>
  );
}
