import type { Prisma, PrismaClient } from "@construction-ops/database";

import { prisma } from "../providers/database.js";

export interface DocumentListFilters {
  companyId: string;
  page: number;
  pageSize: number;
  projectId?: string | undefined;
}

export interface DocumentListResult {
  items: DocumentRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateDocumentData {
  projectId: string;
  uploadedById: string;
  name: string;
  type: string;
  mimeType: string;
  sizeBytes: number;
  storageKey?: string;
}

export type DocumentRow = Prisma.DocumentGetPayload<{
  include: {
    project: { select: { id: true; name: true } };
    uploadedBy: { select: { id: true; name: true; email: true } };
  };
}>;

const documentInclude = {
  project: { select: { id: true, name: true } },
  uploadedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.DocumentInclude;

export class DocumentRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(filters: DocumentListFilters): Promise<DocumentListResult> {
    const where: Prisma.DocumentWhereInput = { project: { companyId: filters.companyId } };
    if (filters.projectId !== undefined) where.projectId = filters.projectId;

    const [items, total] = await this.client.$transaction([
      this.client.document.findMany({
        where,
        include: documentInclude,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.client.document.count({ where }),
    ]);

    return { items, total, page: filters.page, pageSize: filters.pageSize };
  }

  findOwnedById(id: string, companyId: string): Promise<DocumentRow | null> {
    return this.client.document.findFirst({
      where: { id, project: { companyId } },
      include: documentInclude,
    });
  }

  create(data: CreateDocumentData): Promise<DocumentRow> {
    const createData: Prisma.DocumentCreateInput = {
      project: { connect: { id: data.projectId } },
      uploadedBy: { connect: { id: data.uploadedById } },
      name: data.name,
      type: data.type,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
    };
    if (data.storageKey !== undefined) createData.storageKey = data.storageKey;

    return this.client.document.create({ data: createData, include: documentInclude });
  }

  delete(id: string): Promise<void> {
    return this.client.document.delete({ where: { id } }).then(() => undefined);
  }
}
