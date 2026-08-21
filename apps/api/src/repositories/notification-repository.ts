import type { Prisma, PrismaClient, NotificationType } from "@construction-ops/database";

import { prisma } from "../providers/database.js";

export interface NotificationListFilters {
  userId: string;
  page: number;
  pageSize: number;
  unreadOnly?: boolean | undefined;
}

export interface NotificationListResult {
  items: NotificationRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
}

export type NotificationRow = Prisma.NotificationGetPayload<Record<string, never>>;

export class NotificationRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(filters: NotificationListFilters): Promise<NotificationListResult> {
    const where: Prisma.NotificationWhereInput = { userId: filters.userId };
    if (filters.unreadOnly === true) {
      where.readAt = null;
    }

    const [items, total] = await this.client.$transaction([
      this.client.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.client.notification.count({ where }),
    ]);

    return { items, total, page: filters.page, pageSize: filters.pageSize };
  }

  findByIdAndUser(id: string, userId: string): Promise<NotificationRow | null> {
    return this.client.notification.findFirst({ where: { id, userId } });
  }

  create(data: CreateNotificationData): Promise<NotificationRow> {
    const createData: Prisma.NotificationCreateInput = {
      user: { connect: { id: data.userId } },
      type: data.type,
      title: data.title,
      message: data.message,
    };

    return this.client.notification.create({ data: createData });
  }

  findUnreadByTypeAndTitle(
    userId: string,
    type: NotificationType,
    title: string,
  ): Promise<NotificationRow | null> {
    return this.client.notification.findFirst({
      where: { userId, type, title, readAt: null },
    });
  }

  markAsRead(id: string): Promise<NotificationRow> {
    return this.client.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  markAllAsRead(userId: string): Promise<number> {
    return this.client.notification
      .updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      })
      .then((r) => r.count);
  }

  countUnread(userId: string): Promise<number> {
    return this.client.notification.count({ where: { userId, readAt: null } });
  }
}
