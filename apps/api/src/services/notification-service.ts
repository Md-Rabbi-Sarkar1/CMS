import type { NotificationType } from "@construction-ops/database";

import {
  NotificationRepository,
  type NotificationListFilters,
  type NotificationRow,
} from "../repositories/notification-repository.js";
import { NotFoundError } from "../utils/errors.js";
import type { JWTPayload } from "../types/auth.js";

export interface NotificationResponse {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationResponse[];
  total: number;
  page: number;
  pageSize: number;
}

function toResponse(notification: NotificationRow): NotificationResponse {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export class NotificationService {
  private readonly notificationRepository: NotificationRepository;

  constructor(notificationRepository: NotificationRepository = new NotificationRepository()) {
    this.notificationRepository = notificationRepository;
  }

  async list(
    user: JWTPayload,
    query: { page: number; pageSize: number; unreadOnly?: boolean | undefined },
  ): Promise<NotificationListResponse> {
    const filters: NotificationListFilters = {
      userId: user.sub,
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.unreadOnly !== undefined) filters.unreadOnly = query.unreadOnly;

    const result = await this.notificationRepository.list(filters);
    return {
      items: result.items.map(toResponse),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  async markAsRead(user: JWTPayload, id: string): Promise<NotificationResponse> {
    const notification = await this.notificationRepository.findByIdAndUser(id, user.sub);
    if (!notification) {
      throw new NotFoundError("Notification not found");
    }

    const updated = await this.notificationRepository.markAsRead(id);
    return toResponse(updated);
  }

  async markAllAsRead(user: JWTPayload): Promise<{ updated: number }> {
    const count = await this.notificationRepository.markAllAsRead(user.sub);
    return { updated: count };
  }

  async countUnread(user: JWTPayload): Promise<{ unread: number }> {
    const unread = await this.notificationRepository.countUnread(user.sub);
    return { unread };
  }

  /** Internal helper used by other services to create notifications. */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
  ): Promise<NotificationResponse> {
    const notification = await this.notificationRepository.create({
      userId,
      type,
      title,
      message,
    });
    return toResponse(notification);
  }
}
