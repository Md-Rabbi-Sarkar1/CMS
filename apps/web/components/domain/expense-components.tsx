"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Project } from "@/lib/types";

const CATEGORIES = ["MATERIALS", "LABOR", "TRANSPORTATION", "EQUIPMENT", "OTHER"];

export function CreateExpenseButton({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [category, setCategory] = useState("MATERIALS");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/expenses", {
        projectId,
        category,
        amount: Number(amount),
        description,
        expenseDate,
      });
      setOpen(false);
      setAmount("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create expense.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => { setOpen(true); }}>New expense</Button>
      <Modal
        open={open}
        onClose={() => { setOpen(false); }}
        title="Create expense"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); }}>
              Cancel
            </Button>
            <Button type="submit" form="create-expense-form" loading={loading}>
              Create
            </Button>
          </>
        }
      >
        <form id="create-expense-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <Field label="Project" htmlFor="projectId">
            <Select id="projectId" value={projectId} onChange={(e) => { setProjectId(e.target.value); }} required>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category" htmlFor="category">
              <Select id="category" value={category} onChange={(e) => { setCategory(e.target.value); }}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount" htmlFor="amount">
              <Input id="amount" type="number" min="0" step="0.01" required value={amount} onChange={(e) => { setAmount(e.target.value); }} />
            </Field>
          </div>
          <Field label="Expense date" htmlFor="expenseDate">
            <Input id="expenseDate" type="date" required value={expenseDate} onChange={(e) => { setExpenseDate(e.target.value); }} />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" rows={2} required value={description} onChange={(e) => { setDescription(e.target.value); }} />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}

export function ReviewExpenseButton({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("APPROVED");
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.patch(`/expenses/${expenseId}/review`, {
        status,
        rejectionReason: status === "REJECTED" ? rejectionReason : undefined,
      });
      setOpen(false);
      setRejectionReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to review expense.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => { setOpen(true); }}>
        Review
      </Button>
      <Modal
        open={open}
        onClose={() => { setOpen(false); }}
        title="Review expense"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); }}>
              Cancel
            </Button>
            <Button type="submit" form="review-expense-form" loading={loading}>
              Submit review
            </Button>
          </>
        }
      >
        <form id="review-expense-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <Field label="Decision" htmlFor="status">
            <Select id="status" value={status} onChange={(e) => { setStatus(e.target.value); }}>
              <option value="APPROVED">Approve</option>
              <option value="REJECTED">Reject</option>
            </Select>
          </Field>
          {status === "REJECTED" ? (
            <Field label="Rejection reason" htmlFor="rejectionReason">
              <Textarea id="rejectionReason" rows={2} value={rejectionReason} onChange={(e) => { setRejectionReason(e.target.value); }} />
            </Field>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}
