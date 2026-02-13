export type BaseRecord = {
  id: string;
  code: string;
  name: string;
  extra?: string;
  phone?: string;
  link?: string;
  address?: string;
};

type BaseKey = "category" | "location" | "warehouse" | "supplier" | "project";

const NS_BASE = "lx-wms.base";
const NS_RULE = "lx-wms.rule";
const NS_INV = "lx-wms.inventory";
const NS_PROC = "lx-wms.procurement";
const NS_PERMISSION = "lx-wms.permission";
const NS_ROLE = "lx-wms.role";
const NS_BACKUP = "lx-wms.backup";
const NS_UPDATE = "lx-wms.update";
const STORE_EVENT = "lx-wms.storage";

const notifyChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STORE_EVENT));
  }
};

export const onStoreChange = (handler: () => void) => {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(STORE_EVENT, handler);
  return () => window.removeEventListener(STORE_EVENT, handler);
};

export type UpdateStatus = {
  available: boolean;
  version?: string;
  checkedAt?: string;
};

export const readUpdateStatus = (): UpdateStatus => {
  try {
    const raw = localStorage.getItem(NS_UPDATE);
    if (!raw) return { available: false };
    const parsed = JSON.parse(raw) as UpdateStatus;
    if (!parsed || typeof parsed.available !== "boolean") {
      return { available: false };
    }
    return parsed;
  } catch {
    return { available: false };
  }
};

export const writeUpdateStatus = (value: UpdateStatus) => {
  try {
    localStorage.setItem(NS_UPDATE, JSON.stringify(value));
    notifyChange();
  } catch {
    return;
  }
};

const getBaseKey = (key: BaseKey) => `${NS_BASE}.${key}`;
const getInvKey = (key: "items" | "flows") => `${NS_INV}.${key}`;
const getProcKey = (key: "requests") => `${NS_PROC}.${key}`;

export const readBaseList = (key: BaseKey): BaseRecord[] => {
  try {
    const raw = localStorage.getItem(getBaseKey(key));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BaseRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeBaseList = (key: BaseKey, list: BaseRecord[]) => {
  try {
    localStorage.setItem(getBaseKey(key), JSON.stringify(list));
    notifyChange();
  } catch {
    return;
  }
};

export const addBaseItem = (key: BaseKey, item: BaseRecord) => {
  const list = readBaseList(key);
  writeBaseList(key, [...list, item]);
};

export const removeBaseItem = (key: BaseKey, id: string) => {
  const list = readBaseList(key);
  writeBaseList(
    key,
    list.filter((it) => it.id !== id),
  );
};

export type RuleSegment =
  | "major"
  | "middle"
  | "minor"
  | "spec"
  | "color"
  | "serial";

export const readRuleOrder = (): RuleSegment[] => {
  try {
    const raw = localStorage.getItem(`${NS_RULE}.order`);
    if (!raw) return ["major", "middle", "minor", "spec", "color", "serial"];
    const parsed = JSON.parse(raw) as RuleSegment[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : ["major", "middle", "minor", "spec", "color", "serial"];
  } catch {
    return ["major", "middle", "minor", "spec", "color", "serial"];
  }
};

export const writeRuleOrder = (order: RuleSegment[]) => {
  try {
    localStorage.setItem(`${NS_RULE}.order`, JSON.stringify(order));
    notifyChange();
  } catch {
    return;
  }
};

const readSerialSeed = (): number => {
  try {
    const raw = localStorage.getItem(`${NS_RULE}.serialSeed`);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num >= 0 ? num : 0;
  } catch {
    return 0;
  }
};

const writeSerialSeed = (next: number) => {
  try {
    localStorage.setItem(`${NS_RULE}.serialSeed`, String(next));
    notifyChange();
  } catch {
    return;
  }
};

const nextSerial = (): string => {
  const seed = readSerialSeed();
  const next = seed + 1;
  writeSerialSeed(next);
  return String(next).padStart(5, "0");
};

const readBaseSerialSeed = (key: BaseKey): number => {
  try {
    const raw = localStorage.getItem(`${NS_BASE}.serial.${key}`);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num >= 0 ? num : 0;
  } catch {
    return 0;
  }
};

const writeBaseSerialSeed = (key: BaseKey, next: number) => {
  try {
    localStorage.setItem(`${NS_BASE}.serial.${key}`, String(next));
    notifyChange();
  } catch {
    return;
  }
};

const nextBaseSerial = (key: BaseKey): string => {
  const seed = readBaseSerialSeed(key);
  const next = seed + 1;
  writeBaseSerialSeed(key, next);
  return String(next).padStart(4, "0");
};

const toCode = (text: string, max = 4): string => {
  const cleaned = (text || "").replace(/\s+/g, "");
  const letters = cleaned
    .split("")
    .filter((c) => /[A-Za-z0-9\u4e00-\u9fa5]/.test(c))
    .slice(0, max);
  return letters
    .map((c) => {
      if (/[A-Za-z0-9]/.test(c)) return c.toUpperCase();
      return "C";
    })
    .join("");
};

export const generateItemCode = (itemName: string, model: string): string => {
  const order = readRuleOrder();
  const map: Record<RuleSegment, string> = {
    major: toCode(itemName, 2),
    middle: toCode(itemName.slice(2), 2),
    minor: toCode(itemName.slice(4), 2),
    spec: toCode(model, 3),
    color: "NA",
    serial: nextSerial(),
  };
  const parts = order.map((seg) => map[seg]).filter(Boolean);
  return parts.join("-");
};

export const generatePreviewCode = (itemName: string, model: string): string => {
  const order = readRuleOrder();
  const map: Record<RuleSegment, string> = {
    major: toCode(itemName, 2),
    middle: toCode(itemName.slice(2), 2),
    minor: toCode(itemName.slice(4), 2),
    spec: toCode(model, 3),
    color: "NA",
    serial: "00001",
  };
  const parts = order.map((seg) => map[seg]).filter(Boolean);
  return parts.join("-");
};

export const generateBaseCode = (key: BaseKey): string => {
  const prefixMap: Record<BaseKey, string> = {
    category: "CAT",
    location: "LOC",
    warehouse: "WH",
    supplier: "SUP",
    project: "PRO",
  };
  const prefix = prefixMap[key];
  return `${prefix}-${nextBaseSerial(key)}`;
};

export type InventoryItem = {
  id: string;
  itemCode: string;
  itemName: string;
  model: string;
  warehouse: string;
  location: string;
  category: string;
  supplier: string;
  imageUrl?: string;
  inboundQty: number;
  outboundQty: number;
  remainQty: number;
  inboundAt: string;
};

export type InventoryFlow = {
  id: string;
  itemCode: string;
  itemName: string;
  action: string;
  quantity: number;
  operator: string;
  createdAt: string;
};

export const readInventoryItems = (): InventoryItem[] => {
  try {
    const raw = localStorage.getItem(getInvKey("items"));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InventoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeInventoryItems = (items: InventoryItem[]) => {
  try {
    localStorage.setItem(getInvKey("items"), JSON.stringify(items));
    notifyChange();
  } catch {
    return;
  }
};

export const readInventoryFlows = (): InventoryFlow[] => {
  try {
    const raw = localStorage.getItem(getInvKey("flows"));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InventoryFlow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeInventoryFlows = (items: InventoryFlow[]) => {
  try {
    localStorage.setItem(getInvKey("flows"), JSON.stringify(items));
    notifyChange();
  } catch {
    return;
  }
};

export type PurchaseRequest = {
  id: string;
  itemCode: string;
  itemName: string;
  model: string;
  quantity: number;
  estimatedPrice: number;
  actualPrice?: number;
  logisticsCompany?: string;
  logisticsNumber?: string;
  logisticsPhone?: string;
  deliveryImageUrl?: string;
  deliveredAt?: string;
  imageUrl?: string;
  status: string;
  createdAt: string;
  requesterId?: string;
  requesterName?: string;
  rejectReason?: string;
  rejectedAt?: string;
  purchasedAt?: string;
  inboundAt?: string;
};

export const readPurchaseRequests = (): PurchaseRequest[] => {
  try {
    const raw = localStorage.getItem(getProcKey("requests"));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PurchaseRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writePurchaseRequests = (items: PurchaseRequest[]) => {
  try {
    localStorage.setItem(getProcKey("requests"), JSON.stringify(items));
    notifyChange();
  } catch {
    return;
  }
};

export type PermissionRule = {
  id: string;
  name: string;
  roles: string[];
  permissions: string[];
  createdAt: string;
};

export const readPermissionRules = (): PermissionRule[] => {
  try {
    const raw = localStorage.getItem(`${NS_PERMISSION}.rules`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PermissionRule[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      roles: Array.isArray(item.roles) ? item.roles : [],
      permissions: Array.isArray(item.permissions) ? item.permissions : [],
    }));
  } catch {
    return [];
  }
};

export const writePermissionRules = (items: PermissionRule[]) => {
  try {
    localStorage.setItem(`${NS_PERMISSION}.rules`, JSON.stringify(items));
    notifyChange();
  } catch {
    return;
  }
};

export type RoleGroup = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
};

export const readRoleGroups = (): RoleGroup[] => {
  try {
    const raw = localStorage.getItem(`${NS_ROLE}.groups`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RoleGroup[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeRoleGroups = (items: RoleGroup[]) => {
  try {
    localStorage.setItem(`${NS_ROLE}.groups`, JSON.stringify(items));
    notifyChange();
  } catch {
    return;
  }
};

export type PermissionChecker = {
  hasPermission: (permission: string) => boolean;
  permissions: string[];
};

export const buildPermissionChecker = (
  role: string | undefined,
  rules: PermissionRule[],
): PermissionChecker => {
  if (role === "ADMIN") {
    const permissions = new Set<string>();
    rules.forEach((rule) => {
      (rule.permissions ?? []).forEach((permission) => {
        if (permission) permissions.add(permission);
      });
    });
    return {
      hasPermission: () => true,
      permissions: Array.from(permissions),
    };
  }
  if (!rules.length) {
    return {
      hasPermission: () => false,
      permissions: [],
    };
  }
  if (!role) {
    return {
      hasPermission: () => false,
      permissions: [],
    };
  }
  const permissions = new Set<string>();
  rules.forEach((rule) => {
    if (!rule.roles?.includes(role)) return;
    (rule.permissions ?? []).forEach((permission) => {
      if (permission) permissions.add(permission);
    });
  });
  return {
    hasPermission: (permission: string) => permissions.has(permission),
    permissions: Array.from(permissions),
  };
};

export type BackupSettings = {
  enabled: boolean;
  intervalMinutes: number;
  maxBackups: number;
};

const defaultBackupSettings: BackupSettings = {
  enabled: false,
  intervalMinutes: 60,
  maxBackups: 20,
};

export const readBackupSettings = (): BackupSettings => {
  try {
    const raw = localStorage.getItem(`${NS_BACKUP}.settings`);
    if (!raw) return defaultBackupSettings;
    const parsed = JSON.parse(raw) as BackupSettings;
    if (
      typeof parsed?.enabled === "boolean" &&
      typeof parsed?.intervalMinutes === "number" &&
      typeof parsed?.maxBackups === "number"
    ) {
      return parsed;
    }
    return defaultBackupSettings;
  } catch {
    return defaultBackupSettings;
  }
};

export const writeBackupSettings = (settings: BackupSettings) => {
  try {
    localStorage.setItem(`${NS_BACKUP}.settings`, JSON.stringify(settings));
    notifyChange();
  } catch {
    return;
  }
};

export type InboundOrder = {
  id: string;
  code: string;
  itemCode: string;
  itemName: string;
  model: string;
  quantity: number;
  warehouse: string;
  location: string;
  category: string;
  supplier: string;
  imageUrl?: string;
  operator: string;
  status: string;
  createdAt: string;
  source?: string;
};

export const readInboundOrders = (): InboundOrder[] => {
  try {
    const raw = localStorage.getItem(`${NS_INV}.inboundOrders`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InboundOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeInboundOrders = (items: InboundOrder[]) => {
  try {
    localStorage.setItem(`${NS_INV}.inboundOrders`, JSON.stringify(items));
    notifyChange();
  } catch {
    return;
  }
};

export type OutboundOrder = {
  id: string;
  code: string;
  itemCode: string;
  itemName: string;
  model: string;
  quantity: number;
  project: string;
  operator: string;
  status: string;
  createdAt: string;
};

export type ProjectConsumptionDetail = {
  project: string;
  itemCode: string;
  itemName: string;
  model: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type ProjectConsumptionSummary = {
  project: string;
  quantity: number;
  amount: number;
};

export const buildProjectConsumption = (
  outboundOrders: OutboundOrder[],
  purchaseRequests: PurchaseRequest[],
): {
  details: ProjectConsumptionDetail[];
  summary: ProjectConsumptionSummary[];
  totalQuantity: number;
  totalAmount: number;
} => {
  const getTimestamp = (value?: string) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  const priceMap = new Map<string, { price: number; time: number }>();
  purchaseRequests.forEach((request) => {
    const priceCandidate =
      Number(request.actualPrice) > 0
        ? Number(request.actualPrice)
        : Number(request.estimatedPrice);
    if (!Number.isFinite(priceCandidate) || priceCandidate <= 0) return;
    const time = Math.max(getTimestamp(request.purchasedAt), getTimestamp(request.createdAt));
    const existing = priceMap.get(request.itemCode);
    if (!existing || time >= existing.time) {
      priceMap.set(request.itemCode, { price: priceCandidate, time });
    }
  });
  const detailMap = new Map<string, ProjectConsumptionDetail>();
  outboundOrders.forEach((order) => {
    const unitPrice = priceMap.get(order.itemCode)?.price ?? 0;
    const qty = Number(order.quantity);
    const safeQty = Number.isFinite(qty) ? qty : 0;
    const key = `${order.project}__${order.itemCode}__${order.model}`;
    const existing = detailMap.get(key);
    if (existing) {
      const nextQty = existing.quantity + safeQty;
      detailMap.set(key, {
        ...existing,
        quantity: nextQty,
        amount: nextQty * existing.unitPrice,
      });
    } else {
      detailMap.set(key, {
        project: order.project,
        itemCode: order.itemCode,
        itemName: order.itemName,
        model: order.model,
        quantity: safeQty,
        unitPrice,
        amount: safeQty * unitPrice,
      });
    }
  });
  const summaryMap = new Map<string, ProjectConsumptionSummary>();
  let totalQuantity = 0;
  let totalAmount = 0;
  Array.from(detailMap.values()).forEach((detail) => {
    totalQuantity += detail.quantity;
    totalAmount += detail.amount;
    const current = summaryMap.get(detail.project);
    if (current) {
      summaryMap.set(detail.project, {
        project: detail.project,
        quantity: current.quantity + detail.quantity,
        amount: current.amount + detail.amount,
      });
    } else {
      summaryMap.set(detail.project, {
        project: detail.project,
        quantity: detail.quantity,
        amount: detail.amount,
      });
    }
  });
  return {
    details: Array.from(detailMap.values()),
    summary: Array.from(summaryMap.values()),
    totalQuantity,
    totalAmount,
  };
};

export const readOutboundOrders = (): OutboundOrder[] => {
  try {
    const raw = localStorage.getItem(`${NS_INV}.outboundOrders`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OutboundOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeOutboundOrders = (items: OutboundOrder[]) => {
  try {
    localStorage.setItem(`${NS_INV}.outboundOrders`, JSON.stringify(items));
    notifyChange();
  } catch {
    return;
  }
};
