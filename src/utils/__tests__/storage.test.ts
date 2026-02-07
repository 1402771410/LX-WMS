import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPermissionChecker,
  buildProjectConsumption,
  readBackupSettings,
  readInboundOrders,
  readPermissionRules,
  readRoleGroups,
  writeBackupSettings,
  writeInboundOrders,
  writePermissionRules,
  writeRoleGroups,
} from "../storage";

type LocalStorageStore = {
  [key: string]: string;
};

const createLocalStorageMock = () => {
  let store: LocalStorageStore = {};
  return {
    clear: () => {
      store = {};
    },
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
};

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: createLocalStorageMock(),
    configurable: true,
  });
});

describe("storage utils", () => {
  it("reads default backup settings when empty", () => {
    const settings = readBackupSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.intervalMinutes).toBe(60);
    expect(settings.maxBackups).toBe(20);
  });

  it("writes and reads backup settings", () => {
    writeBackupSettings({ enabled: true, intervalMinutes: 30, maxBackups: 10 });
    const settings = readBackupSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.intervalMinutes).toBe(30);
    expect(settings.maxBackups).toBe(10);
  });

  it("writes and reads permission rules", () => {
    writePermissionRules([
      {
        id: "RULE-1",
        name: "仓库管理员",
        roles: ["仓库组"],
        permissions: ["inbound", "outbound"],
        createdAt: "2026-02-06 10:00:00",
      },
    ]);
    const rules = readPermissionRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]?.name).toBe("仓库管理员");
    expect(rules[0]?.roles).toEqual(["仓库组"]);
    expect(rules[0]?.permissions).toEqual(["inbound", "outbound"]);
  });

  it("writes and reads role groups", () => {
    writeRoleGroups([
      {
        id: "ROLE-1",
        name: "仓库组",
        description: "负责入库出库",
        createdAt: "2026-02-06 10:10:00",
      },
    ]);
    const roles = readRoleGroups();
    expect(roles).toHaveLength(1);
    expect(roles[0]?.name).toBe("仓库组");
    expect(roles[0]?.description).toBe("负责入库出库");
  });

  it("writes and reads inbound orders with image", () => {
    writeInboundOrders([
      {
        id: "IN-1",
        code: "IN-20260207",
        itemCode: "IT-01",
        itemName: "测试物料",
        model: "T-01",
        quantity: 10,
        warehouse: "一号仓",
        location: "A-01",
        category: "配件",
        supplier: "测试供应商",
        imageUrl: "data:image/png;base64,AAA",
        operator: "管理员",
        status: "待上架",
        createdAt: "2026-02-07 10:00:00",
        source: "采购入库",
      },
    ]);
    const orders = readInboundOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0]?.imageUrl).toBe("data:image/png;base64,AAA");
  });

  it("builds permission checker from role rules", () => {
    const rules = [
      {
        id: "RULE-1",
        name: "仓库管理员",
        roles: ["仓库组"],
        permissions: ["inbound", "outbound"],
        createdAt: "2026-02-06 10:00:00",
      },
      {
        id: "RULE-2",
        name: "采购员",
        roles: ["采购组"],
        permissions: ["procurement:create"],
        createdAt: "2026-02-06 10:01:00",
      },
    ];
    const checker = buildPermissionChecker("仓库组", rules);
    expect(checker.permissions).toEqual(["inbound", "outbound"]);
    expect(checker.hasPermission("inbound")).toBe(true);
    expect(checker.hasPermission("procurement:create")).toBe(false);
  });

  it("allows admin role even when rules exist", () => {
    const rules = [
      {
        id: "RULE-1",
        name: "仓库管理员",
        roles: ["仓库组"],
        permissions: ["inbound", "outbound"],
        createdAt: "2026-02-06 10:00:00",
      },
      {
        id: "RULE-2",
        name: "采购员",
        roles: ["采购组"],
        permissions: ["procurement:create"],
        createdAt: "2026-02-06 10:01:00",
      },
    ];
    const checker = buildPermissionChecker("ADMIN", rules);
    expect(checker.hasPermission("inbound")).toBe(true);
    expect(checker.hasPermission("unknown:permission")).toBe(true);
    expect(checker.permissions.sort()).toEqual(
      ["inbound", "outbound", "procurement:create"].sort(),
    );
  });

  it("builds project consumption with latest prices", () => {
    const outboundOrders = [
      {
        id: "OUT-1",
        code: "OUT-20260207-01",
        itemCode: "IT-01",
        itemName: "测试物料A",
        model: "M-01",
        quantity: 2,
        project: "项目一",
        operator: "管理员",
        status: "已出库",
        createdAt: "2026-02-07 10:00:00",
      },
      {
        id: "OUT-2",
        code: "OUT-20260207-02",
        itemCode: "IT-02",
        itemName: "测试物料B",
        model: "M-02",
        quantity: 3,
        project: "项目一",
        operator: "管理员",
        status: "已出库",
        createdAt: "2026-02-07 11:00:00",
      },
      {
        id: "OUT-3",
        code: "OUT-20260207-03",
        itemCode: "IT-01",
        itemName: "测试物料A",
        model: "M-01",
        quantity: 1,
        project: "项目二",
        operator: "管理员",
        status: "已出库",
        createdAt: "2026-02-07 12:00:00",
      },
    ];
    const purchaseRequests = [
      {
        id: "PR-1",
        itemCode: "IT-01",
        itemName: "测试物料A",
        model: "M-01",
        quantity: 10,
        estimatedPrice: 8,
        actualPrice: 9,
        status: "已入库",
        createdAt: "2026-02-05 10:00:00",
      },
      {
        id: "PR-2",
        itemCode: "IT-01",
        itemName: "测试物料A",
        model: "M-01",
        quantity: 10,
        estimatedPrice: 10,
        actualPrice: 12,
        status: "已入库",
        createdAt: "2026-02-06 10:00:00",
      },
      {
        id: "PR-3",
        itemCode: "IT-02",
        itemName: "测试物料B",
        model: "M-02",
        quantity: 6,
        estimatedPrice: 5,
        status: "已入库",
        createdAt: "2026-02-06 12:00:00",
      },
    ];
    const result = buildProjectConsumption(outboundOrders, purchaseRequests);
    const projectOne = result.summary.find((item) => item.project === "项目一");
    const projectTwo = result.summary.find((item) => item.project === "项目二");
    expect(projectOne?.quantity).toBe(5);
    expect(projectOne?.amount).toBe(2 * 12 + 3 * 5);
    expect(projectTwo?.quantity).toBe(1);
    expect(projectTwo?.amount).toBe(12);
    expect(result.totalQuantity).toBe(6);
    expect(result.totalAmount).toBe(2 * 12 + 3 * 5 + 12);
  });
});
