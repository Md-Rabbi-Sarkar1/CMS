"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function handleClick() {
    setLoading(true);
    api
      .post("/notifications/mark-all-read")
      .then(() => {
        router.refresh();
      })
      .catch(() => {
        // ignore — the list will show stale state but no crash
      })
      .finally(() => {
        setLoading(false);
      });
  }

  return (
    <Button variant="secondary" loading={loading} onClick={handleClick}>
      Mark all as read
    </Button>
  );
}

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function handleClick() {
    setLoading(true);
    api
      .post(`/notifications/${notificationId}/read`)
      .then(() => {
        router.refresh();
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        setLoading(false);
      });
  }

  return (
    <Button variant="ghost" size="sm" loading={loading} onClick={handleClick}>
      Mark read
    </Button>
  );
}
