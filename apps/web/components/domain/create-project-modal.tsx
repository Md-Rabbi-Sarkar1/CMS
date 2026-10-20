"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { User } from "@/lib/types";

export function CreateProjectModal({
  open,
  onClose,
  user,
  managers,
}: { open: boolean; onClose: () => void; user: User; managers: User[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [clientInfo, setClientInfo] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expectedEndDate, setExpectedEndDate] = useState("");
  const [managerId, setManagerId] = useState(user.role === "PROJECT_MANAGER" ? user.id : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setDescription("");
    setLocation("");
    setClientInfo("");
    setBudget("");
    setStartDate("");
    setExpectedEndDate("");
    setManagerId(user.role === "PROJECT_MANAGER" ? user.id : "");
    setError(null);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/projects", {
        name,
        description: description || undefined,
        location: location || undefined,
        clientInfo: clientInfo || undefined,
        budget: budget ? Number(budget) : undefined,
        startDate: startDate || undefined,
        expectedEndDate: expectedEndDate || undefined,
        managerId: managerId || undefined,
      });
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create project.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create project"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-project-form" loading={loading}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-project-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <Field label="Name" htmlFor="name">
          <Input id="name" required value={name} onChange={(e) => { setName(e.target.value); }} />
        </Field>
        <Field label="Description" htmlFor="description">
          <Textarea id="description" rows={3} value={description} onChange={(e) => { setDescription(e.target.value); }} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Location" htmlFor="location">
            <Input id="location" value={location} onChange={(e) => { setLocation(e.target.value); }} />
          </Field>
          <Field label="Client" htmlFor="clientInfo">
            <Input id="clientInfo" value={clientInfo} onChange={(e) => { setClientInfo(e.target.value); }} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date" htmlFor="startDate">
            <Input id="startDate" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); }} />
          </Field>
          <Field label="Expected end date" htmlFor="expectedEndDate">
            <Input
              id="expectedEndDate"
              type="date"
              value={expectedEndDate}
              onChange={(e) => { setExpectedEndDate(e.target.value); }}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Budget" htmlFor="budget">
            <Input id="budget" type="number" min="0" step="0.01" value={budget} onChange={(e) => { setBudget(e.target.value); }} />
          </Field>
          <Field label="Project manager" htmlFor="managerId">
            <Select id="managerId" value={managerId} onChange={(e) => { setManagerId(e.target.value); }}>
              <option value="">Unassigned</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name} ({manager.email})
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}
