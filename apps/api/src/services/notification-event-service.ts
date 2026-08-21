import { prisma } from "../providers/database.js";
import {
  NotificationRepository,
  type CreateNotificationData,
} from "../repositories/notification-repository.js";
import { logger } from "../utils/logger.js";

/**
 * Phase 17 — Centralized notification event dispatcher.
 *
 * Business services emit domain events here; this service resolves recipients
 * and creates Notification rows. Tenant isolation: recipients are always
 * resolved against the actor's company from the JWT (never client input).
 *
 * Recipient rules (consistent with project-access semantics):
 * - TASK_ASSIGNED / TASK_DEADLINE → the task assignee.
 * - REPORT_SUBMITTED / ISSUE_CREATED / DOCUMENT_UPLOADED → project manager +
 *   company ADMINs, excluding the actor.
 * - EXPENSE_PENDING → project manager (when project-scoped) + company ADMINs,
 *   excluding the submitter.
 * - LOW_STOCK → company ADMINs and PROJECT_MANAGERs (materials are
 *   company-scoped).
 * - PROJECT_ASSIGNMENT → the added member.
 *
 * Duplicate prevention: a (userId, type, title) row is skipped while an
 * identical notification remains unread. Best-effort within a single process;
 * sufficient for the in-process dispatch used here.
 */

const DEADLINE_LOOKAHEAD_MS = 48 * 60 * 60 * 1000;

export interface TaskAssignedEvent {
  assigneeId: string;
  taskTitle: string;
  projectName: string;
  dueDate: Date | null;
}

export interface ProjectScopedEvent {
  companyId: string;
  projectId: string | null;
  actorId: string;
}

export interface ReportSubmittedEvent extends ProjectScopedEvent {
  projectName: string;
  submitterName: string;
}

export interface IssueCreatedEvent extends ProjectScopedEvent {
  projectName: string;
  reporterName: string;
  issueTitle: string;
  assigneeId: string | null;
}

export interface ExpensePendingEvent extends ProjectScopedEvent {
  projectName: string | null;
  submitterName: string;
  category: string;
  amount: string;
}

export interface LowStockEvent {
  companyId: string;
  materialName: string;
  unit: string;
  currentStock: string;
  reorderLevel: string;
}

export interface ProjectAssignedEvent {
  userId: string;
  projectName: string;
}

export interface DocumentUploadedEvent extends ProjectScopedEvent {
  projectName: string;
  uploaderName: string;
  documentName: string;
}

export class NotificationEventService {
  private readonly notificationRepository: NotificationRepository;

  constructor(notificationRepository: NotificationRepository = new NotificationRepository()) {
    this.notificationRepository = notificationRepository;
  }

  taskAssigned(event: TaskAssignedEvent): Promise<void> {
    return this.safeDispatch(async () => {
      const title = `Task assigned: ${event.taskTitle}`;
      const message = `You were assigned to task "${event.taskTitle}" in project "${event.projectName}".`;
      await this.dispatch([event.assigneeId], { type: "TASK_ASSIGNED", title, message });

      if (event.dueDate !== null && event.dueDate.getTime() - Date.now() <= DEADLINE_LOOKAHEAD_MS) {
        await this.dispatchForTaskDeadline(event.assigneeId, event.taskTitle, event.dueDate);
      }
    });
  }

  reportSubmitted(event: ReportSubmittedEvent): Promise<void> {
    return this.safeDispatch(async () => {
      const recipients = await this.resolveReviewers(event.companyId, event.projectId, event.actorId);
      const title = `New daily report: ${event.projectName}`;
      const message = `${event.submitterName} submitted a daily work report for project "${event.projectName}".`;
      await this.dispatch(recipients, { type: "REPORT_SUBMITTED", title, message });
    });
  }

  issueCreated(event: IssueCreatedEvent): Promise<void> {
    return this.safeDispatch(async () => {
      const recipients = await this.resolveReviewers(event.companyId, event.projectId, event.actorId);
      if (event.assigneeId !== null && event.assigneeId !== event.actorId) {
        recipients.push(event.assigneeId);
      }
      const title = `New issue: ${event.issueTitle}`;
      const message = `${event.reporterName} reported issue "${event.issueTitle}" on project "${event.projectName}".`;
      await this.dispatch(recipients, { type: "ISSUE_CREATED", title, message });
    });
  }

  expensePending(event: ExpensePendingEvent): Promise<void> {
    return this.safeDispatch(async () => {
      const recipients = await this.resolveReviewers(event.companyId, event.projectId, event.actorId);
      const where = event.projectName !== null ? ` for project "${event.projectName}"` : "";
      const title = "Expense pending approval";
      const message = `${event.submitterName} submitted a ${event.category} expense of ${event.amount}${where}.`;
      await this.dispatch(recipients, { type: "EXPENSE_PENDING", title, message });
    });
  }

  lowStock(event: LowStockEvent): Promise<void> {
    return this.safeDispatch(async () => {
      const recipients = await this.resolveCompanyManagers(event.companyId);
      const title = `Low stock: ${event.materialName}`;
      const message = `Material "${event.materialName}" is at ${event.currentStock} ${event.unit} (reorder level: ${event.reorderLevel}).`;
      await this.dispatch(recipients, { type: "LOW_STOCK", title, message });
    });
  }

  projectAssigned(event: ProjectAssignedEvent): Promise<void> {
    return this.safeDispatch(async () => {
      const title = `Added to project: ${event.projectName}`;
      const message = `You were assigned to project "${event.projectName}".`;
      await this.dispatch([event.userId], { type: "PROJECT_ASSIGNMENT", title, message });
    });
  }

  documentUploaded(event: DocumentUploadedEvent): Promise<void> {
    return this.safeDispatch(async () => {
      const recipients = await this.resolveReviewers(event.companyId, event.projectId, event.actorId);
      const title = `New document: ${event.documentName}`;
      const message = `${event.uploaderName} uploaded document "${event.documentName}" to project "${event.projectName}".`;
      await this.dispatch(recipients, { type: "DOCUMENT_UPLOADED", title, message });
    });
  }

  /** ADMINs, and the project manager when a project context exists. */
  private async resolveReviewers(
    companyId: string,
    projectId: string | null,
    excludeUserId: string,
  ): Promise<string[]> {
    const recipients = new Set<string>();

    if (projectId !== null) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, companyId },
        select: { managerId: true },
      });
      if (project?.managerId !== null && project?.managerId !== undefined) {
        recipients.add(project.managerId);
      }
    }

    const admins = await prisma.user.findMany({
      where: { companyId, role: "ADMIN" },
      select: { id: true },
    });
    for (const admin of admins) {
      recipients.add(admin.id);
    }

    recipients.delete(excludeUserId);
    return [...recipients];
  }

  /** All ADMIN + PROJECT_MANAGER users of the company (materials are company-scoped). */
  private async resolveCompanyManagers(companyId: string): Promise<string[]> {
    const managers = await prisma.user.findMany({
      where: { companyId, role: { in: ["ADMIN", "PROJECT_MANAGER"] } },
      select: { id: true },
    });
    return managers.map((u) => u.id);
  }

  private async dispatchForTaskDeadline(
    assigneeId: string,
    taskTitle: string,
    dueDate: Date,
  ): Promise<void> {
    const title = `Deadline approaching: ${taskTitle}`;
    const message = `Task "${taskTitle}" is due on ${dueDate.toISOString().slice(0, 10)}.`;
    await this.dispatch([assigneeId], { type: "TASK_DEADLINE", title, message });
  }

  private async dispatch(
    recipientIds: string[],
    payload: Omit<CreateNotificationData, "userId">,
  ): Promise<void> {
    for (const userId of new Set(recipientIds)) {
      const existing = await this.notificationRepository.findUnreadByTypeAndTitle(
        userId,
        payload.type,
        payload.title,
      );
      if (existing !== null) {
        continue;
      }
      await this.notificationRepository.create({ userId, ...payload });
    }
  }

  /**
   * Notification failure must never fail the business operation; dispatch
   * errors are logged and swallowed.
   */
  private async safeDispatch(run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      logger.error("Notification event dispatch failed", error);
    }
  }
}
