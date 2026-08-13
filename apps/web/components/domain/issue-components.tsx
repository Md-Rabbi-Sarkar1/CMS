"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Project } from "@/lib/types";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function CreateIssueButton({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/issues", {
        projectId,
        title,
        description,
        location: location || undefined,
        priority,
      });
      setOpen(false);
      setTitle("");
      setDescription("");
      setLocation("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create issue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => { setOpen(true); }}>New issue</Button>
      <Modal
        open={open}
        onClose={() => { setOpen(false); }}
        title="Report issue"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); }}>
              Cancel
            </Button>
            <Button type="submit" form="create-issue-form" loading={loading}>
              Create
            </Button>
          </>
        }
      >
        <form id="create-issue-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <Field label="Project" htmlFor="projectId">
            <Select id="projectId" value={projectId} onChange={(e) => { setProjectId(e.target.value); }} required>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title" htmlFor="title">
            <Input id="title" required value={title} onChange={(e) => { setTitle(e.target.value); }} />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" rows={3} required value={description} onChange={(e) => { setDescription(e.target.value); }} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Location" htmlFor="location">
              <Input id="location" value={location} onChange={(e) => { setLocation(e.target.value); }} />
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
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}
