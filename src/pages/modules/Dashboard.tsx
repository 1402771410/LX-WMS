import {
  Button,
  Card,
  Col,
  List,
  Modal,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import type { BaseRecord, InventoryItem, InboundOrder, OutboundOrder } from "../../utils/storage";
import { onStoreChange, readBaseList, readInboundOrders, readInventoryItems, readOutboundOrders } from "../../utils/storage";

type AlertItem = {
  id: string;
  itemCode: string;
  itemName: string;
  level: string;
  supplierName: string;
  supplierPhone: string;
  supplierAddress: string;
  supplierLink: string;
};

type DashboardProps = {
  onNavigate: (key: string) => void;
};

const Dashboard = ({ onNavigate }: DashboardProps) => {
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState<AlertItem | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(readInventoryItems());
  const [inboundOrders, setInboundOrders] = useState<InboundOrder[]>(readInboundOrders());
  const [outboundOrders, setOutboundOrders] = useState<OutboundOrder[]>(readOutboundOrders());
  const [supplierList, setSupplierList] = useState<BaseRecord[]>(readBaseList("supplier"));
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const sync = () => {
      setInventoryItems(readInventoryItems());
      setInboundOrders(readInboundOrders());
      setOutboundOrders(readOutboundOrders());
      setSupplierList(readBaseList("supplier"));
    };
    sync();
    return onStoreChange(sync);
  }, []);

  const alertData = useMemo<AlertItem[]>(() => {
    return inventoryItems
      .filter((item) => item.remainQty <= 10)
      .map((item, index) => {
        const supplier = supplierList.find((current) => current.name === item.supplier);
        return {
          id: `${item.itemCode ?? item.id ?? index}`,
          itemCode: item.itemCode,
          itemName: item.itemName,
          level: item.remainQty <= 0 ? "缺货" : item.remainQty <= 5 ? "高" : "低",
          supplierName: supplier?.name ?? item.supplier ?? "",
          supplierPhone: supplier?.phone ?? "",
          supplierAddress: supplier?.address ?? "",
          supplierLink: supplier?.link ?? "",
        };
      });
  }, [inventoryItems, supplierList]);

  const isSameDay = (value: string, target: Date) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return false;
    }
    return (
      date.getFullYear() === target.getFullYear() &&
      date.getMonth() === target.getMonth() &&
      date.getDate() === target.getDate()
    );
  };

  const todayInboundCount = useMemo(() => {
    const today = new Date();
    return inboundOrders.filter((item) => isSameDay(item.createdAt, today)).length;
  }, [inboundOrders]);

  const todayOutboundCount = useMemo(() => {
    const today = new Date();
    return outboundOrders.filter((item) => isSameDay(item.createdAt, today)).length;
  }, [outboundOrders]);

  const totalStock = useMemo(() => {
    return inventoryItems.reduce((sum, item) => sum + item.remainQty, 0);
  }, [inventoryItems]);

  const totalSku = useMemo(() => inventoryItems.length, [inventoryItems]);

  const healthRate = useMemo(() => {
    if (totalSku === 0) return 100;
    const healthy = Math.max(totalSku - alertData.length, 0);
    return Math.round((healthy / totalSku) * 100);
  }, [alertData.length, totalSku]);

  const supplierCoverage = useMemo(() => {
    const total = supplierList.length;
    if (!total) return 0;
    const complete = supplierList.filter(
      (item) => item.phone || item.link || item.address,
    ).length;
    return Math.round((complete / total) * 100);
  }, [supplierList]);

  const sortByTime = <T extends { createdAt: string }>(items: T[]) => {
    return [...items].sort((a, b) => {
      const left = new Date(a.createdAt).getTime();
      const right = new Date(b.createdAt).getTime();
      const leftValue = Number.isNaN(left) ? 0 : left;
      const rightValue = Number.isNaN(right) ? 0 : right;
      return rightValue - leftValue;
    });
  };

  const recentInbound = useMemo(
    () => sortByTime(inboundOrders).slice(0, 6),
    [inboundOrders],
  );

  const recentOutbound = useMemo(
    () => sortByTime(outboundOrders).slice(0, 6),
    [outboundOrders],
  );

  const categorySummary = useMemo(() => {
    const map = new Map<string, number>();
    inventoryItems.forEach((item) => {
      const key = item.category || "未分类";
      map.set(key, (map.get(key) ?? 0) + item.remainQty);
    });
    const items = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    items.sort((a, b) => b.value - a.value);
    const total = items.reduce((sum, item) => sum + item.value, 0);
    return {
      total,
      items: items.slice(0, 6).map((item) => ({
        ...item,
        percent: total > 0 ? Math.round((item.value / total) * 100) : 0,
      })),
    };
  }, [inventoryItems]);

  const trendData = useMemo(() => {
    const base = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const inbound = inboundOrders.filter((item) => isSameDay(item.createdAt, date)).length;
      const outbound = outboundOrders.filter((item) => isSameDay(item.createdAt, date)).length;
      return {
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        inbound,
        outbound,
      };
    });
    const maxValue = Math.max(
      1,
      ...base.map((item) => Math.max(item.inbound, item.outbound)),
    );
    return base.map((item) => ({
      ...item,
      inboundPercent: Math.round((item.inbound / maxValue) * 100),
      outboundPercent: Math.round((item.outbound / maxValue) * 100),
    }));
  }, [inboundOrders, outboundOrders]);

  const quickActions = [
    { key: "inbound", label: "新建入库单", targetKey: "inventory:inbound" },
    { key: "outbound", label: "新建出库单", targetKey: "inventory:outbound" },
    { key: "procurement", label: "发起采购", targetKey: "procurement:purchase" },
    { key: "inventory", label: "库存查询", targetKey: "inventory:list" },
    { key: "report", label: "导出报表", targetKey: "reports:purchase" },
    { key: "settings", label: "系统设置", targetKey: "system:backup" },
  ];

  const handleOpenSupplier = (record: AlertItem) => {
    setCurrentSupplier(record);
    setSupplierOpen(true);
  };

  const handlePurchase = (record: AlertItem) => {
    const link = record.supplierLink?.trim();
    if (!link || !/^https?:\/\//i.test(link)) {
      messageApi.error("未配置有效的采购链接");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const handleQuickAction = (targetKey: string) => {
    onNavigate(targetKey);
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {contextHolder}
      <div>
        <Typography.Title level={4}>运营概览</Typography.Title>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Card>
              <Statistic title="今日入库单" value={todayInboundCount} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="今日出库单" value={todayOutboundCount} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="当前库存总量" value={totalStock} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="低库存预警" value={alertData.length} />
            </Card>
          </Col>
        </Row>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card title="近7日出入库趋势">
            <Space direction="vertical" style={{ width: "100%" }}>
              {trendData.map((item) => (
                <Space key={item.label} style={{ width: "100%" }} align="center">
                  <Typography.Text style={{ width: 48 }}>{item.label}</Typography.Text>
                  <div style={{ flex: 1 }}>
                    <Progress
                      percent={item.inboundPercent}
                      status="active"
                      size="small"
                      strokeColor="#1677ff"
                      format={() => `入库 ${item.inbound}`}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Progress
                      percent={item.outboundPercent}
                      status="active"
                      size="small"
                      strokeColor="#faad14"
                      format={() => `出库 ${item.outbound}`}
                    />
                  </div>
                </Space>
              ))}
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="运营健康度">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Statistic title="SKU数量" value={totalSku} />
              <Statistic title="供应商覆盖" value={`${supplierCoverage}%`} />
              <Progress
                percent={healthRate}
                strokeColor={healthRate >= 80 ? "#00b96b" : "#faad14"}
              />
              <Typography.Text type="secondary">
                健康度基于低库存预警占比计算
              </Typography.Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card title="快捷入口">
            <Space wrap>
              {quickActions.map((item, index) => (
                <Button
                  key={item.key}
                  type={index === 0 ? "primary" : "default"}
                  onClick={() => handleQuickAction(item.targetKey)}
                >
                  {item.label}
                </Button>
              ))}
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="库存结构">
            <Space direction="vertical" style={{ width: "100%" }}>
              {categorySummary.items.length ? (
                categorySummary.items.map((item) => (
                  <Space key={item.name} style={{ width: "100%" }} align="center">
                    <Typography.Text style={{ width: 80 }} ellipsis>
                      {item.name}
                    </Typography.Text>
                    <Progress
                      percent={item.percent}
                      size="small"
                      strokeColor="#1677ff"
                      format={() => `${item.value}`}
                      style={{ flex: 1 }}
                    />
                  </Space>
                ))
              ) : (
                <Typography.Text type="secondary">暂无库存结构数据</Typography.Text>
              )}
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="最近入库">
            <List
              dataSource={recentInbound}
              locale={{ emptyText: "暂无入库记录" }}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={0}>
                    <Typography.Text>{item.itemName}</Typography.Text>
                    <Typography.Text type="secondary">
                      {item.code} · {item.createdAt}
                    </Typography.Text>
                  </Space>
                  <Tag color="blue">{item.quantity}</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card title="最近出库">
            <List
              dataSource={recentOutbound}
              locale={{ emptyText: "暂无出库记录" }}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={0}>
                    <Typography.Text>{item.itemName}</Typography.Text>
                    <Typography.Text type="secondary">
                      {item.code} · {item.createdAt}
                    </Typography.Text>
                  </Space>
                  <Tag color="gold">{item.quantity}</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={16}>
          <Card>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Space
                align="center"
                style={{ justifyContent: "space-between", width: "100%" }}
              >
                <Typography.Title level={5} style={{ margin: 0 }}>
                  库存预警列表
                </Typography.Title>
                <Button type="primary" onClick={() => handleQuickAction("procurement:purchase")}>
                  新建采购请求
                </Button>
              </Space>
              <Table
                rowKey="id"
                dataSource={alertData}
                pagination={{ pageSize: 6 }}
                columns={[
                  { title: "物料编码", dataIndex: "itemCode" },
                  { title: "物料名称", dataIndex: "itemName" },
                  {
                    title: "预警等级",
                    dataIndex: "level",
                    render: (value: string) => {
                      const color =
                        value === "缺货" ? "red" : value === "高" ? "orange" : "blue";
                      return <Tag color={color}>{value}</Tag>;
                    },
                  },
                  {
                    title: "操作",
                    dataIndex: "action",
                    render: (_, record) => (
                      <Space>
                        <Button onClick={() => handleOpenSupplier(record)}>供应商</Button>
                        <Button type="primary" onClick={() => handlePurchase(record)}>
                          采购
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            </Space>
          </Card>
        </Col>
      </Row>
      <Modal
        open={supplierOpen}
        title="供应商详情"
        onCancel={() => setSupplierOpen(false)}
        footer={null}
      >
        {currentSupplier ? (
          <Space direction="vertical">
            <Typography.Text>名称：{currentSupplier.supplierName}</Typography.Text>
            <Typography.Text>联系方式：{currentSupplier.supplierPhone}</Typography.Text>
            <Typography.Text>收货地址：{currentSupplier.supplierAddress}</Typography.Text>
            <Typography.Text>下单链接：{currentSupplier.supplierLink}</Typography.Text>
          </Space>
        ) : null}
      </Modal>
    </Space>
  );
};

export default Dashboard;
