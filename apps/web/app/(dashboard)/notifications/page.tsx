import { MarkAllReadButton, MarkReadButton } from "@/components/domain/notification-components";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api-client";
import type { Notification } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  let notifications: Notification[] = [];
  let error: string | null = null;

  try {
    const result = await api.get<{ items: Notification[] }>(`/notifications`, { pageSize: 50 });
    notifications = result.items;
  } catch (err) {
    error = err instanceof ApiError ? err.message : "Failed to load notifications.";
  }

  const unreadCount = notifications.filter((n) => n.readAt === null).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${String(unreadCount)} unread notification${unreadCount === 1 ? "" : "s"}.` : "You're all caught up."}
        action={unreadCount > 0 ? <MarkAllReadButton /> : null}
      />

      {error ? (
        <ErrorState message={error} />
      ) : notifications.length === 0 ? (
        <EmptyState title="No notifications" description="You'll see updates here as they happen." />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const unread = notification.readAt === null;
            return (
              <Card key={notification.id} className={unread ? "border-blue-200 bg-blue-50/30" : ""}>
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{notification.title}</p>
                        {unread ? <Badge tone="blue">New</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {unread ? <MarkReadButton notificationId={notification.id} /> : null}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
