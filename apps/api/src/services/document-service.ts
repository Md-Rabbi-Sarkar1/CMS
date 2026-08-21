import type { CreateDocumentInput } from "@construction-ops/validation";

import { prisma } from "../providers/database.js";
import {
  DocumentRepository,
  type DocumentListFilters,
  type DocumentRow,
  type CreateDocumentData,
} from "../repositories/document-repository.js";
import { NotificationEventService } from "./notification-event-service.js";
import { NotFoundError } from "../utils/errors.js";
import type { JWTPayload } from "../types/auth.js";

export interface DocumentResponse {
  id: string;
  projectId: string;
  uploadedById: string;
  name: string;
  type: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string | null;
  project: { id: string; name: string };
  uploadedBy: { id: string; name: string; email: string };
  createdAt: string;
}

export interface DocumentListResponse {
  items: DocumentResponse[];
  total: number;
  page: number;
  pageSize: number;
}

function toResponse(doc: DocumentRow): DocumentResponse {
  return {
    id: doc.id,
    projectId: doc.projectId,
    uploadedById: doc.uploadedById,
    name: doc.name,
    type: doc.type,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    storageKey: doc.storageKey,
    project: { id: doc.project.id, name: doc.project.name },
    uploadedBy: { id: doc.uploadedBy.id, name: doc.uploadedBy.name, email: doc.uploadedBy.email },
    createdAt: doc.createdAt.toISOString(),
  };
}

async function assertProjectAccess(user: JWTPayload, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
    select: { id: true, managerId: true },
  });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  if (user.role === "ADMIN") return;
  if (project.managerId === user.sub) return;

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.sub } },
    select: { id: true },
  });

  if (!membership) {
    throw new NotFoundError("Project not found");
  }
}

export class DocumentService {
  private readonly documentRepository: DocumentRepository;
  private readonly notificationEvents: NotificationEventService;

  constructor(
    documentRepository: DocumentRepository = new DocumentRepository(),
    notificationEvents: NotificationEventService = new NotificationEventService(),
  ) {
    this.documentRepository = documentRepository;
    this.notificationEvents = notificationEvents;
  }

  async create(user: JWTPayload, payload: CreateDocumentInput): Promise<DocumentResponse> {
    await assertProjectAccess(user, payload.projectId);

    const data: CreateDocumentData = {
      projectId: payload.projectId,
      uploadedById: user.sub,
      name: payload.name,
      type: payload.type,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes,
    };
    if (payload.storageKey !== undefined) data.storageKey = payload.storageKey;

    const doc = await this.documentRepository.create(data);

    await this.notificationEvents.documentUploaded({
      companyId: user.companyId,
      projectId: doc.projectId,
      actorId: user.sub,
      projectName: doc.project.name,
      uploaderName: doc.uploadedBy.name,
      documentName: doc.name,
    });

    return toResponse(doc);
  }

  async list(
    user: JWTPayload,
    query: { page: number; pageSize: number; projectId?: string | undefined },
  ): Promise<DocumentListResponse> {
    const filters: DocumentListFilters = {
      companyId: user.companyId,
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.projectId !== undefined) filters.projectId = query.projectId;

    const result = await this.documentRepository.list(filters);
    return {
      items: result.items.map(toResponse),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  async getById(user: JWTPayload, id: string): Promise<DocumentResponse> {
    const doc = await this.documentRepository.findOwnedById(id, user.companyId);
    if (!doc) {
      throw new NotFoundError("Document not found");
    }
    return toResponse(doc);
  }

  async delete(user: JWTPayload, id: string): Promise<void> {
    const doc = await this.documentRepository.findOwnedById(id, user.companyId);
    if (!doc) {
      throw new NotFoundError("Document not found");
    }

    if (user.role !== "ADMIN" && doc.uploadedById !== user.sub) {
      const project = await prisma.project.findFirst({
        where: { id: doc.projectId, companyId: user.companyId },
        select: { managerId: true },
      });
      if (project?.managerId !== user.sub) {
        throw new NotFoundError("Document not found");
      }
    }

    await this.documentRepository.delete(id);
  }
}
