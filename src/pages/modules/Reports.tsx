import { Button, Card, Space, Table, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import {
  onStoreChange,
  readInboundOrders,
  readInventoryItems,
  readOutboundOrders,
  readPurchaseRequests,
  buildProjectConsumption,
} from "../../utils/storage";

type ReportsProps = {
  activeKey?: string;
};

const downloadCsv = (fileName: string, rows: string[][]) => {
  const csv = rows.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const reportNow = Date.now();

const Reports = ({ activeKey }: ReportsProps) => {
  const [messageApi, contextHolder] = message.useMessage();
  const [purchaseRequests, setPurchaseRequests] = useState(readPurchaseRequests());
  const [inboundOrders, setInboundOrders] = useState(readInboundOrders());
  const [outboundOrders, setOutboundOrders] = useState(readOutboundOrders());
  const [inventoryItems, setInventoryItems] = useState(readInventoryItems());

  useEffect(() => {
    const sync = () => {
      setPurchaseRequests(readPurchaseRequests());
      setInboundOrders(readInboundOrders());
      setOutboundOrders(readOutboundOrders());
      setInventoryItems(readInventoryItems());
    };
    sync();
    return onStoreChange(sync);
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  const toSafeNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };
  const projectConsumption = useMemo(
    () => buildProjectConsumption(outboundOrders, purchaseRequests),
    [outboundOrders, purchaseRequests],
  );
  const projectSummary = projectConsumption.summary;
  const projectDetails = projectConsumption.details;
  const agingRows = useMemo(
    () =>
      inventoryItems.map((item) => {
        const inboundTime = new Date(item.inboundAt).getTime();
        const days =
          inboundTime && reportNow > 0
            ? Math.max(0, Math.floor((reportNow - inboundTime) / 86400000))
            : 0;
        return {
          itemCode: item.itemCode,
          itemName: item.itemName,
          days,
          inboundAt: item.inboundAt,
        };
      }),
    [inventoryItems],
  );

  const handleExport = (type: string) => {
    if (type === "purchase") {
      const rows = purchaseRequests.map((item) => [
        item.createdAt,
        item.itemCode,
        item.itemName,
        item.model,
        String(item.quantity),
        String(item.estimatedPrice ?? ""),
        String(item.actualPrice ?? ""),
        item.status,
      ]);
      downloadCsv("采购报表", [
        ["日期", "物品编码", "物品名称", "型号", "数量", "预计单价", "实际单价", "状态"],
        ...rows,
      ]);
    }
    if (type === "outbound") {
      const rows = outboundOrders.map((item) => [
        item.createdAt,
        item.code,
        item.itemCode,
        item.itemName,
        item.model,
        String(item.quantity),
        item.project,
        item.status,
      ]);
      downloadCsv("出库报表", [
        ["日期", "出库单", "物品编码", "物品名称", "型号", "数量", "项目", "状态"],
        ...rows,
      ]);
    }
    if (type === "inbound") {
      const rows = inboundOrders.map((item) => [
        item.createdAt,
        item.code,
        item.itemCode,
        item.itemName,
        item.model,
        String(item.quantity),
        item.warehouse,
        item.location,
        item.status,
      ]);
      downloadCsv("入库报表", [
        ["日期", "入库单", "物品编码", "物品名称", "型号", "数量", "仓库", "库位", "状态"],
        ...rows,
      ]);
    }
    if (type === "project") {
      const rows = projectDetails.map((item) => [
        item.project,
        item.itemCode,
        item.itemName,
        item.model,
        String(item.quantity),
        String(item.unitPrice),
        String(item.amount),
      ]);
      downloadCsv("项目消耗分析", [
        ["项目", "物品编码", "物品名称", "型号", "数量", "单价", "金额"],
        ...rows,
      ]);
    }
    if (type === "aging") {
      const rows = agingRows.map((item) => [
        item.itemCode,
        item.itemName,
        String(item.days),
        item.inboundAt,
      ]);
      downloadCsv("库龄报表", [["物料编码", "物品名称", "库龄(天)", "入库时间"], ...rows]);
    }
    messageApi.success("报表已导出");
  };

  const viewKey = activeKey ?? "purchase";
  const buttonLabel =
    viewKey === "outbound"
      ? "导出出库报表"
      : viewKey === "inbound"
        ? "导出入库报表"
        : viewKey === "project"
          ? "导出项目消耗分析"
          : viewKey === "aging"
            ? "导出库龄报表"
            : "导出采购报表";

  return (
    <Card>
      {contextHolder}
      <Space direction="vertical" style={{ width: "100%" }}>
        <Space>
          <Button type="primary" onClick={() => handleExport(viewKey)}>
            {buttonLabel}
          </Button>
        </Space>
        {viewKey === "purchase" ? (
          <Table
            rowKey="id"
            dataSource={purchaseRequests}
            pagination={{ pageSize: 8 }}
            columns={[
              { title: "日期", dataIndex: "createdAt" },
              { title: "物品编码", dataIndex: "itemCode" },
              { title: "物品名称", dataIndex: "itemName" },
              { title: "型号", dataIndex: "model" },
              { title: "数量", dataIndex: "quantity" },
              {
                title: "预计单价",
                dataIndex: "estimatedPrice",
                render: (value?: number) =>
                  toSafeNumber(value) > 0 ? `￥${formatCurrency(toSafeNumber(value))}` : "—",
              },
              {
                title: "实际单价",
                dataIndex: "actualPrice",
                render: (value?: number) =>
                  toSafeNumber(value) > 0 ? `￥${formatCurrency(toSafeNumber(value))}` : "—",
              },
              { title: "状态", dataIndex: "status" },
            ]}
          />
        ) : null}
        {viewKey === "outbound" ? (
          <Table
            rowKey="id"
            dataSource={outboundOrders}
            pagination={{ pageSize: 8 }}
            columns={[
              { title: "日期", dataIndex: "createdAt" },
              { title: "出库单", dataIndex: "code" },
              { title: "物品编码", dataIndex: "itemCode" },
              { title: "物品名称", dataIndex: "itemName" },
              { title: "型号", dataIndex: "model" },
              { title: "数量", dataIndex: "quantity" },
              { title: "项目", dataIndex: "project" },
              { title: "状态", dataIndex: "status" },
            ]}
          />
        ) : null}
        {viewKey === "inbound" ? (
          <Table
            rowKey="id"
            dataSource={inboundOrders}
            pagination={{ pageSize: 8 }}
            columns={[
              { title: "日期", dataIndex: "createdAt" },
              { title: "入库单", dataIndex: "code" },
              { title: "物品编码", dataIndex: "itemCode" },
              { title: "物品名称", dataIndex: "itemName" },
              { title: "型号", dataIndex: "model" },
              { title: "数量", dataIndex: "quantity" },
              { title: "仓库", dataIndex: "warehouse" },
              { title: "库位", dataIndex: "location" },
              { title: "状态", dataIndex: "status" },
            ]}
          />
        ) : null}
        {viewKey === "project" ? (
          <>
            <Typography.Text>
              项目消耗总计：数量 {projectConsumption.totalQuantity}，金额
              {projectConsumption.totalAmount > 0
                ? `￥${formatCurrency(projectConsumption.totalAmount)}`
                : "—"}
            </Typography.Text>
            <Typography.Text>项目消耗汇总</Typography.Text>
            <Table
              rowKey="project"
              dataSource={projectSummary}
              pagination={{ pageSize: 8 }}
              columns={[
                { title: "项目", dataIndex: "project" },
                { title: "消耗数量", dataIndex: "quantity" },
                {
                  title: "消耗金额",
                  dataIndex: "amount",
                  render: (value?: number) =>
                    Number(value) > 0 ? `￥${formatCurrency(Number(value))}` : "—",
                },
              ]}
            />
            <Typography.Text>项目物料清单</Typography.Text>
            <Table
              rowKey={(record) => `${record.project}-${record.itemCode}-${record.model}`}
              dataSource={projectDetails}
              pagination={{ pageSize: 8 }}
              columns={[
                { title: "项目", dataIndex: "project" },
                { title: "物品编码", dataIndex: "itemCode" },
                { title: "物品名称", dataIndex: "itemName" },
                { title: "型号", dataIndex: "model" },
                { title: "数量", dataIndex: "quantity" },
                {
                  title: "单价",
                  dataIndex: "unitPrice",
                  render: (value?: number) =>
                    Number(value) > 0 ? `￥${formatCurrency(Number(value))}` : "—",
                },
                {
                  title: "金额",
                  dataIndex: "amount",
                  render: (value?: number) =>
                    Number(value) > 0 ? `￥${formatCurrency(Number(value))}` : "—",
                },
              ]}
            />
          </>
        ) : null}
        {viewKey === "aging" ? (
          <Table
            rowKey="itemCode"
            dataSource={agingRows}
            pagination={{ pageSize: 8 }}
            columns={[
              { title: "物料编码", dataIndex: "itemCode" },
              { title: "物品名称", dataIndex: "itemName" },
              { title: "库龄(天)", dataIndex: "days" },
              { title: "入库时间", dataIndex: "inboundAt" },
            ]}
          />
        ) : null}
      </Space>
    </Card>
  );
};

export default Reports;
