import { describe, expect, it } from "vitest";
import {
  confirmDelivery,
  createPurchaseRequest,
  createReorderRequest,
  markPurchased,
  moveToPendingInbound,
  rejectPurchaseRequest,
  toWaitingRecord,
} from "../procurement";

describe("procurement utils", () => {
  it("creates a valid purchase request", () => {
    const request = createPurchaseRequest(
      {
        itemName: "电机",
        model: "M-1",
        quantity: 2,
        estimatedPrice: 1200,
        imageUrl: "https://img.test/1",
      },
      "REQ-1",
      "2026-02-06 10:00:00",
    );
    expect(request.id).toBe("REQ-1");
    expect(request.itemName).toBe("电机");
    expect(request.model).toBe("M-1");
    expect(request.quantity).toBe(2);
    expect(request.estimatedPrice).toBe(1200);
    expect(request.status).toBe("等待采购");
  });

  it("moves a request to waiting and pending states", () => {
    const request = createPurchaseRequest(
      { itemName: "传感器", model: "S-9", quantity: 5, estimatedPrice: 88 },
      "REQ-2",
      "2026-02-06 11:00:00",
    );
    const waiting = toWaitingRecord(request);
    const pending = moveToPendingInbound(waiting);
    expect(waiting.status).toBe("等待采购");
    expect(pending.status).toBe("等待入库");
  });

  it("marks a request as rejected with reason", () => {
    const request = createPurchaseRequest(
      { itemName: "轴承", model: "BR-2", quantity: 1, estimatedPrice: 35 },
      "REQ-3",
      "2026-02-06 12:00:00",
    );
    const rejected = rejectPurchaseRequest(request, "规格不符合要求", "2026-02-06 12:10:00");
    expect(rejected.status).toBe("已驳回");
    expect(rejected.rejectReason).toBe("规格不符合要求");
  });

  it("marks a request as purchased", () => {
    const request = createPurchaseRequest(
      { itemName: "电源", model: "PS-5", quantity: 3, estimatedPrice: 230 },
      "REQ-4",
      "2026-02-06 12:30:00",
    );
    const purchased = markPurchased(request, "2026-02-06 12:40:00", 210, {
      company: "顺丰",
      number: "SF1234567890",
      phone: "13800000000",
    });
    expect(purchased.status).toBe("送货中");
    expect(purchased.purchasedAt).toBe("2026-02-06 12:40:00");
    expect(purchased.actualPrice).toBe(210);
    expect(purchased.logisticsCompany).toBe("顺丰");
    expect(purchased.logisticsNumber).toBe("SF1234567890");
    expect(purchased.logisticsPhone).toBe("13800000000");
  });
  it("confirms a delivery with photo", () => {
    const request = createPurchaseRequest(
      { itemName: "阀门", model: "V-2", quantity: 4, estimatedPrice: 90 },
      "REQ-7",
      "2026-02-06 15:00:00",
    );
    const purchased = markPurchased(request, "2026-02-06 15:10:00", 88, {
      company: "京东物流",
      number: "JD99887766",
    });
    const confirmed = confirmDelivery(
      purchased,
      "2026-02-06 16:00:00",
      "data:image/png;base64,AAA",
    );
    expect(confirmed.status).toBe("等待入库");
    expect(confirmed.deliveredAt).toBe("2026-02-06 16:00:00");
    expect(confirmed.deliveryImageUrl).toBe("data:image/png;base64,AAA");
  });

  it("creates a reorder request with new id and requester", () => {
    const request = createPurchaseRequest(
      { itemName: "控制器", model: "CTRL-1", quantity: 1, estimatedPrice: 860 },
      "REQ-5",
      "2026-02-06 13:00:00",
    );
    const reordered = createReorderRequest(request, {
      id: "REQ-6",
      createdAt: "2026-02-06 14:00:00",
      requesterId: "USER-1",
      requesterName: "张三",
    });
    expect(reordered.id).toBe("REQ-6");
    expect(reordered.itemName).toBe("控制器");
    expect(reordered.model).toBe("CTRL-1");
    expect(reordered.quantity).toBe(1);
    expect(reordered.estimatedPrice).toBe(860);
    expect(reordered.status).toBe("等待采购");
    expect(reordered.requesterId).toBe("USER-1");
    expect(reordered.requesterName).toBe("张三");
  });
});
