"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Project } from "@/lib/types";

const DOC_TYPES = ["BLUEPRINT", "CONTRACT", "PERMIT", "INSPECTION", "REPORT", "PHOTO", "OTHER"];

export function CreateDocumentButton({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [name, setName] = useState("");
  const [type, setType] = useState("REPORT");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // In a real system this would be a file upload; here we register metadata.
      const fileInput = document.getElementById("file") as HTMLInputElement | null;
      const file = fileInput?.files?.[0];
      await api.post("/documents", {
        projectId,
        name: name.length > 0 ? name : (file?.name ?? "Untitled"),
        type,
        mimeType: file?.type ?? "application/octet-stream",
        sizeBytes: file?.size ?? 0,
      });
      setOpen(false);
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload document.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => { setOpen(true); }}>Upload document</Button>
      <Modal
        open={open}
        onClose={() => { setOpen(false); }}
        title="Upload document"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); }}>
              Cancel
            </Button>
            <Button type="submit" form="create-doc-form" loading={loading}>
              Upload
            </Button>
          </>
        }
      >
        <form id="create-doc-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <Field label="Project" htmlFor="projectId">
            <Select id="projectId" value={projectId} onChange={(e) => { setProjectId(e.target.value); }} required>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Name (optional)" htmlFor="name">
            <Input id="name" value={name} onChange={(e) => { setName(e.target.value); }} placeholder="Defaults to filename" />
          </Field>
          <Field label="Type" htmlFor="type">
            <Select id="type" value={type} onChange={(e) => { setType(e.target.value); }}>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="File" htmlFor="file">
            <Input id="file" type="file" />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}
