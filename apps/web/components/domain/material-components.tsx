"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export function CreateMaterialButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [currentStock, setCurrentStock] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setUnit("");
    setCurrentStock("");
    setReorderLevel("");
    setError(null);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/materials", {
        name,
        unit,
        currentStock: currentStock ? Number(currentStock) : undefined,
        reorderLevel: reorderLevel ? Number(reorderLevel) : undefined,
      });
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create material.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => { setOpen(true); }}>New material</Button>
      <Modal
        open={open}
        onClose={() => { setOpen(false); }}
        title="Create material"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); }}>
              Cancel
            </Button>
            <Button type="submit" form="create-material-form" loading={loading}>
              Create
            </Button>
          </>
        }
      >
        <form id="create-material-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <Field label="Name" htmlFor="name">
            <Input id="name" required value={name} onChange={(e) => { setName(e.target.value); }} />
          </Field>
          <Field label="Unit" htmlFor="unit">
            <Input id="unit" required placeholder="e.g. bags, kg, m³" value={unit} onChange={(e) => { setUnit(e.target.value); }} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Current stock" htmlFor="currentStock">
              <Input id="currentStock" type="number" min="0" step="0.01" value={currentStock} onChange={(e) => { setCurrentStock(e.target.value); }} />
            </Field>
            <Field label="Reorder level" htmlFor="reorderLevel">
              <Input id="reorderLevel" type="number" min="0" step="0.01" value={reorderLevel} onChange={(e) => { setReorderLevel(e.target.value); }} />
            </Field>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}

export function RecordTransactionButton({
  materialId,
  projects,
}: {
  materialId: string;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("PURCHASE");
  const [quantity, setQuantity] = useState("");
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post(`/materials/${materialId}/transactions`, {
        type,
        quantity: Number(quantity),
        projectId: projectId || undefined,
        note: note || undefined,
      });
      setOpen(false);
      setQuantity("");
      setNote("");
      setProjectId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record transaction.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => { setOpen(true); }}>
        Record transaction
      </Button>
      <Modal
        open={open}
        onClose={() => { setOpen(false); }}
        title="Record inventory transaction"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); }}>
              Cancel
            </Button>
            <Button type="submit" form="tx-form" loading={loading}>
              Record
            </Button>
          </>
        }
      >
        <form id="tx-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <Field label="Type" htmlFor="type">
            <select
              id="type"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={type}
              onChange={(e) => { setType(e.target.value); }}
            >
              <option value="PURCHASE">Purchase</option>
              <option value="USAGE">Usage</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </Field>
          <Field label="Quantity" htmlFor="quantity">
            <Input id="quantity" type="number" min="0" step="0.01" required value={quantity} onChange={(e) => { setQuantity(e.target.value); }} />
          </Field>
          <Field label="Project (optional)" htmlFor="projectId">
            <select
              id="projectId"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={projectId}
              onChange={(e) => { setProjectId(e.target.value); }}
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Note (optional)" htmlFor="note">
            <Input id="note" value={note} onChange={(e) => { setNote(e.target.value); }} />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}
