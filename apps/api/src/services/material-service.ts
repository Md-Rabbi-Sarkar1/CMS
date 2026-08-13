import type {
  CreateMaterialInput,
  InventoryTxInput,
  UpdateMaterialInput,
} from "@construction-ops/validation";

import {
  MaterialRepository,
  isLowStock,
  type InventoryTxRow,
  type MaterialListFilters,
  type MaterialRow,
  type CreateMaterialData,
  type UpdateMaterialData,
  type InventoryTxData,
} from "../repositories/material-repository.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import type { JWTPayload } from "../types/auth.js";

export interface MaterialResponse {
  id: string;
  name: string;
  unit: string;
  currentStock: string;
  reorderLevel: string;
  lowStock: boolean;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTxResponse {
  id: string;
  materialId: string;
  type: string;
  quantity: string;
  note: string | null;
  projectId: string | null;
  performedById: string;
  createdAt: string;
  material: { id: string; name: string; unit: string };
}

export interface MaterialListResponse {
  items: MaterialResponse[];
  total: number;
  page: number;
  pageSize: number;
}

function toResponse(material: MaterialRow): MaterialResponse {
  return {
    id: material.id,
    name: material.name,
    unit: material.unit,
    currentStock: material.currentStock.toString(),
    reorderLevel: material.reorderLevel.toString(),
    lowStock: isLowStock(material.currentStock, material.reorderLevel),
    transactionCount: material._count.transactions,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
  };
}

function toTxResponse(tx: InventoryTxRow): InventoryTxResponse {
  return {
    id: tx.id,
    materialId: tx.materialId,
    type: tx.type,
    quantity: tx.quantity.toString(),
    note: tx.note,
    projectId: tx.projectId,
    performedById: tx.performedById,
    createdAt: tx.createdAt.toISOString(),
    material: { id: tx.material.id, name: tx.material.name, unit: tx.material.unit },
  };
}

export class MaterialService {
  private readonly materialRepository: MaterialRepository;

  constructor(materialRepository: MaterialRepository = new MaterialRepository()) {
    this.materialRepository = materialRepository;
  }

  async create(user: JWTPayload, payload: CreateMaterialInput): Promise<MaterialResponse> {
    const data: CreateMaterialData = {
      companyId: user.companyId,
      name: payload.name,
      unit: payload.unit,
    };
    if (payload.currentStock !== undefined) data.currentStock = payload.currentStock;
    if (payload.reorderLevel !== undefined) data.reorderLevel = payload.reorderLevel;

    const material = await this.materialRepository.create(data);
    return toResponse(material);
  }

  async list(
    user: JWTPayload,
    query: { page: number; pageSize: number; lowStock?: boolean | undefined },
  ): Promise<MaterialListResponse> {
    const filters: MaterialListFilters = {
      companyId: user.companyId,
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.lowStock !== undefined) filters.lowStock = query.lowStock;

    const result = await this.materialRepository.list(filters);
    return {
      items: result.items.map(toResponse),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  async getById(user: JWTPayload, id: string): Promise<MaterialResponse> {
    const material = await this.materialRepository.findOwnedById(id, user.companyId);
    if (!material) {
      throw new NotFoundError("Material not found");
    }
    return toResponse(material);
  }

  async update(user: JWTPayload, id: string, payload: UpdateMaterialInput): Promise<MaterialResponse> {
    const material = await this.materialRepository.findOwnedById(id, user.companyId);
    if (!material) {
      throw new NotFoundError("Material not found");
    }

    const data: UpdateMaterialData = {};
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.unit !== undefined) data.unit = payload.unit;
    if (payload.reorderLevel !== undefined) data.reorderLevel = payload.reorderLevel;

    const updated = await this.materialRepository.update(id, data);
    return toResponse(updated);
  }

  async delete(user: JWTPayload, id: string): Promise<void> {
    const material = await this.materialRepository.findOwnedById(id, user.companyId);
    if (!material) {
      throw new NotFoundError("Material not found");
    }
    await this.materialRepository.delete(id);
  }

  async recordTransaction(
    user: JWTPayload,
    materialId: string,
    payload: InventoryTxInput,
  ): Promise<{ transaction: InventoryTxResponse; material: MaterialResponse }> {
    const material = await this.materialRepository.findOwnedById(materialId, user.companyId);
    if (!material) {
      throw new NotFoundError("Material not found");
    }

    if (payload.type === "USAGE" && payload.quantity > Number(material.currentStock)) {
      throw new ConflictError("Insufficient stock for this transaction");
    }

    const data: InventoryTxData = {
      materialId,
      performedById: user.sub,
      type: payload.type,
      quantity: payload.quantity,
    };
    if (payload.note !== undefined) data.note = payload.note;
    if (payload.projectId !== undefined) data.projectId = payload.projectId;

    const result = await this.materialRepository.recordTransaction(data, user.companyId);
    return {
      transaction: toTxResponse(result.tx),
      material: toResponse(result.material),
    };
  }

  async listTransactions(user: JWTPayload, materialId: string): Promise<InventoryTxResponse[]> {
    const material = await this.materialRepository.findOwnedById(materialId, user.companyId);
    if (!material) {
      throw new NotFoundError("Material not found");
    }
    const transactions = await this.materialRepository.listTransactions(materialId, user.companyId);
    return transactions.map(toTxResponse);
  }
}
