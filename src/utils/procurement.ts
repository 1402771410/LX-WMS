import type { PurchaseRequest as StoredPurchaseRequest } from "./storage";
import { generateItemCode } from "./storage";

export type PurchaseRequestInput = {
  itemName: string;
  model: string;
  quantity: number;
  estimatedPrice: number;
  imageUrl?: string;
};

export type PurchaseRequest = StoredPurchaseRequest;

export type PurchaseRecord = {
  id: string;
  itemCode: string;
  itemName: string;
  model: string;
  quantity: number;
  status: string;
};

export type ReorderOptions = {
  id: string;
  createdAt: string;
  requesterId?: string;
  requesterName?: string;
};

export type LogisticsInfo = {
  company: string;
  number: string;
  phone?: string;
};

export const createPurchaseRequest = (
  input: PurchaseRequestInput,
  id: string,
  createdAt: string,
): PurchaseRequest => {
  const itemName = input.itemName.trim();
  const model = input.model.trim();
  if (!itemName) {
    throw new Error("物品名称不能为空");
  }
  if (!model) {
    throw new Error("型号不能为空");
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("数量必须大于0");
  }
  if (!Number.isFinite(input.estimatedPrice) || input.estimatedPrice <= 0) {
    throw new Error("预计单价必须大于0");
  }
  const itemCode = generateItemCode(itemName, model);
  return {
    id,
    itemCode,
    itemName,
    model,
    quantity: input.quantity,
    estimatedPrice: input.estimatedPrice,
    imageUrl: input.imageUrl?.trim() || undefined,
    status: "等待采购",
    createdAt,
  };
};

export const createReorderRequest = (
  request: PurchaseRequest,
  options: ReorderOptions,
): PurchaseRequest => {
  const nextRequest = createPurchaseRequest(
    {
      itemName: request.itemName,
      model: request.model,
      quantity: request.quantity,
      estimatedPrice: request.estimatedPrice,
      imageUrl: request.imageUrl,
    },
    options.id,
    options.createdAt,
  );
  return {
    ...nextRequest,
    requesterId: options.requesterId ?? request.requesterId,
    requesterName: options.requesterName ?? request.requesterName,
  };
};

export const toWaitingRecord = (request: PurchaseRequest): PurchaseRecord => ({
  id: request.id,
  itemCode: request.itemCode,
  itemName: request.itemName,
  model: request.model,
  quantity: request.quantity,
  status: "等待采购",
});

export const moveToPendingInbound = (record: PurchaseRecord): PurchaseRecord => ({
  ...record,
  status: "等待入库",
});

export const rejectPurchaseRequest = (
  request: PurchaseRequest,
  reason: string,
  rejectedAt: string,
): PurchaseRequest => {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error("驳回原因不能为空");
  }
  return {
    ...request,
    status: "已驳回",
    rejectReason: trimmed,
    rejectedAt,
  };
};

export const markPurchased = (
  request: PurchaseRequest,
  purchasedAt: string,
  actualPrice: number,
  logistics: LogisticsInfo,
): PurchaseRequest => {
  if (!Number.isFinite(actualPrice) || actualPrice <= 0) {
    throw new Error("实际采购单价必须大于0");
  }
  const company = logistics.company.trim();
  const number = logistics.number.trim();
  const phone = logistics.phone?.trim();
  if (!company) {
    throw new Error("物流公司不能为空");
  }
  if (!number) {
    throw new Error("物流单号不能为空");
  }
  return {
    ...request,
    status: "送货中",
    purchasedAt,
    actualPrice,
    logisticsCompany: company,
    logisticsNumber: number,
    logisticsPhone: phone || undefined,
  };
};

export const confirmDelivery = (
  request: PurchaseRequest,
  deliveredAt: string,
  deliveryImageUrl: string,
): PurchaseRequest => {
  const imageUrl = deliveryImageUrl.trim();
  if (!imageUrl) {
    throw new Error("收货照片不能为空");
  }
  return {
    ...request,
    status: "等待入库",
    deliveredAt,
    deliveryImageUrl: imageUrl,
  };
};
