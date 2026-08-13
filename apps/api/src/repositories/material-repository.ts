import { Prisma, type PrismaClient, type InventoryTxType } from "@construction-ops/database";

import { prisma } from "../providers/database.js";

export interface MaterialListFilters {
  companyId: string;
  page: number;
  pageSize: number;
  lowStock?: boolean | undefined;
}

export interface MaterialListResult {
  items: MaterialRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateMaterialData {
  companyId: string;
  name: string;
  unit: string;
  currentStock?: number;
  reorderLevel?: number;
}

export interface UpdateMaterialData {
  name?: string;
  unit?: string;
  reorderLevel?: number;
}

export interface InventoryTxData {
  materialId: string;
  performedById: string;
  type: InventoryTxType;
  quantity: number;
  note?: string;
  projectId?: string;
}

export type MaterialRow = Prisma.MaterialGetPayload<{
  include: { _count: { select: { transactions: true } } };
}>;

export type InventoryTxRow = Prisma.InventoryTransactionGetPayload<{
  include: { material: { select: { id: true; name: true; unit: true } } };
}>;

const materialInclude = {
  _count: { select: { transactions: true } },
} satisfies Prisma.MaterialInclude;

const txInclude = {
  material: { select: { id: true, name: true, unit: true } },
} satisfies Prisma.InventoryTransactionInclude;

function isLowStock(current: Prisma.Decimal, reorder: Prisma.Decimal): boolean {
  return reorder.gt(0) && current.lte(reorder);
}

export { isLowStock };

export class MaterialRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(filters: MaterialListFilters): Promise<MaterialListResult> {
    const where: Prisma.MaterialWhereInput = { companyId: filters.companyId };

    const [items, total] = await this.client.$transaction([
      this.client.material.findMany({
        where,
        include: materialInclude,
        orderBy: { name: "asc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.client.material.count({ where }),
    ]);

    const filtered =
      filters.lowStock === true
        ? items.filter((m) => isLowStock(m.currentStock, m.reorderLevel))
        : items;

    return {
      items: filtered,
      total: filters.lowStock === true ? filtered.length : total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  findOwnedById(id: string, companyId: string): Promise<MaterialRow | null> {
    return this.client.material.findFirst({
      where: { id, companyId },
      include: materialInclude,
    });
  }

  create(data: CreateMaterialData): Promise<MaterialRow> {
    const createData: Prisma.MaterialCreateInput = {
      company: { connect: { id: data.companyId } },
      name: data.name,
      unit: data.unit,
    };
    if (data.currentStock !== undefined) createData.currentStock = data.currentStock;
    if (data.reorderLevel !== undefined) createData.reorderLevel = data.reorderLevel;

    return this.client.material.create({ data: createData, include: materialInclude });
  }

  update(id: string, data: UpdateMaterialData): Promise<MaterialRow> {
    return this.client.material.update({ where: { id }, data, include: materialInclude });
  }

  delete(id: string): Promise<void> {
    return this.client.material.delete({ where: { id } }).then(() => undefined);
  }

  async recordTransaction(
    data: InventoryTxData,
    companyId: string,
  ): Promise<{ tx: InventoryTxRow; material: MaterialRow }> {
    return this.client.$transaction(async (tx) => {
      await tx.material.findFirstOrThrow({
        where: { id: data.materialId, companyId },
      });

      const delta = data.type === "USAGE" ? -data.quantity : data.quantity;

      const updated = await tx.material.update({
        where: { id: data.materialId },
        data: { currentStock: { increment: delta } },
        include: materialInclude,
      });

      const createData: Prisma.InventoryTransactionCreateInput = {
        material: { connect: { id: data.materialId } },
        performedBy: { connect: { id: data.performedById } },
        type: data.type,
        quantity: data.quantity,
      };
      if (data.note !== undefined) createData.note = data.note;
      if (data.projectId !== undefined) createData.project = { connect: { id: data.projectId } };

      const txRecord = await tx.inventoryTransaction.create({
        data: createData,
        include: txInclude,
      });

      return { tx: txRecord, material: updated };
    });
  }

  listTransactions(materialId: string, companyId: string): Promise<InventoryTxRow[]> {
    return this.client.inventoryTransaction.findMany({
      where: { materialId, material: { companyId } },
      include: txInclude,
      orderBy: { createdAt: "desc" },
    });
  }
}
