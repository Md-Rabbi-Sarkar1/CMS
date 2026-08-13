"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function CreateTaskModal({
  open,
  onClose,
  projectId,
  members,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setAssigneeId("");
    setPriority("MEDIUM");
    setDueDate("");
    setError(null);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post(`/projects/${projectId}/tasks`, {
        title,
        description: description || undefined,
        assigneeId: assigneeId || undefined,
        priority,
        dueDate: dueDate || undefined,
      });
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create task.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create task"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-task-form" loading={loading}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-task-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <Field label="Title" htmlFor="title">
          <Input id="title" required value={title} onChange={(e) => { setTitle(e.target.value); }} />
        </Field>
        <Field label="Description" htmlFor="description">
          <Textarea id="description" rows={3} value={description} onChange={(e) => { setDescription(e.target.value); }} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Assignee" htmlFor="assigneeId">
            <Select id="assigneeId" value={assigneeId} onChange={(e) => { setAssigneeId(e.target.value); }}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" htmlFor="priority">
            <Select id="priority" value={priority} onChange={(e) => { setPriority(e.target.value); }}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Due date" htmlFor="dueDate">
          <Input id="dueDate" type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); }} />
        </Field>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}
