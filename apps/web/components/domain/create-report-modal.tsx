"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Project } from "@/lib/types";

interface WorkerEntry {
  name: string;
  role: string;
  hoursWorked: string;
}

export function CreateReportModal({
  open,
  onClose,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  projects: Project[];
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [workCompleted, setWorkCompleted] = useState("");
  const [hoursWorked, setHoursWorked] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [progressPct, setProgressPct] = useState("0");
  const [problemsEncountered, setProblemsEncountered] = useState("");
  const [notes, setNotes] = useState("");
  const [workers, setWorkers] = useState<WorkerEntry[]>([{ name: "", role: "", hoursWorked: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setWorkCompleted("");
    setHoursWorked("");
    setMaterialsUsed("");
    setProgressPct("0");
    setProblemsEncountered("");
    setNotes("");
    setWorkers([{ name: "", role: "", hoursWorked: "" }]);
    setError(null);
  }

  function updateWorker(index: number, field: keyof WorkerEntry, value: string) {
    setWorkers((prev) => prev.map((w, i) => (i === index ? { ...w, [field]: value } : w)));
  }

  function addWorker() {
    setWorkers((prev) => [...prev, { name: "", role: "", hoursWorked: "" }]);
  }

  function removeWorker(index: number) {
    setWorkers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/reports", {
        projectId,
        reportDate,
        workCompleted,
        hoursWorked: Number(hoursWorked),
        materialsUsed: materialsUsed || undefined,
        progressPct: Number(progressPct),
        problemsEncountered: problemsEncountered || undefined,
        notes: notes || undefined,
        workers: workers
          .filter((w) => w.name.trim() !== "")
          .map((w) => ({
            name: w.name,
            role: w.role || undefined,
            hoursWorked: w.hoursWorked ? Number(w.hoursWorked) : undefined,
          })),
      });
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create report.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit daily work report"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-report-form" loading={loading}>
            Submit
          </Button>
        </>
      }
    >
      <form id="create-report-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Project" htmlFor="projectId">
            <Select id="projectId" value={projectId} onChange={(e) => { setProjectId(e.target.value); }} required>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Report date" htmlFor="reportDate">
            <Input id="reportDate" type="date" value={reportDate} onChange={(e) => { setReportDate(e.target.value); }} required />
          </Field>
        </div>
        <Field label="Work completed" htmlFor="workCompleted">
          <Textarea id="workCompleted" rows={3} required value={workCompleted} onChange={(e) => { setWorkCompleted(e.target.value); }} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Hours worked" htmlFor="hoursWorked">
            <Input id="hoursWorked" type="number" min="0" step="0.01" required value={hoursWorked} onChange={(e) => { setHoursWorked(e.target.value); }} />
          </Field>
          <Field label="Progress %" htmlFor="progressPct">
            <Input id="progressPct" type="number" min="0" max="100" required value={progressPct} onChange={(e) => { setProgressPct(e.target.value); }} />
          </Field>
        </div>
        <Field label="Materials used" htmlFor="materialsUsed">
          <Textarea id="materialsUsed" rows={2} value={materialsUsed} onChange={(e) => { setMaterialsUsed(e.target.value); }} />
        </Field>
        <Field label="Problems encountered" htmlFor="problemsEncountered">
          <Textarea id="problemsEncountered" rows={2} value={problemsEncountered} onChange={(e) => { setProblemsEncountered(e.target.value); }} />
        </Field>
        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" rows={2} value={notes} onChange={(e) => { setNotes(e.target.value); }} />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Workers</p>
            <Button variant="ghost" size="sm" type="button" onClick={addWorker}>
              + Add worker
            </Button>
          </div>
          <div className="space-y-2">
            {workers.map((w, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Name" required value={w.name} onChange={(e) => { updateWorker(i, "name", e.target.value); }} />
                <Input placeholder="Role" value={w.role} onChange={(e) => { updateWorker(i, "role", e.target.value); }} />
                <Input
                  placeholder="Hours"
                  type="number"
                  min="0"
                  step="0.01"
                  value={w.hoursWorked}
                  onChange={(e) => { updateWorker(i, "hoursWorked", e.target.value); }}
                  className="w-24"
                />
                {workers.length > 1 ? (
                  <Button variant="ghost" size="sm" type="button" onClick={() => { removeWorker(i); }}>
                    ✕
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}
