import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import type { Dayjs } from "dayjs";
import type { UserInfo } from "../../types/runtime";
import type { InventoryFlow, InventoryItem } from "../../utils/storage";
import {
  onStoreChange,
  readBaseList,
  readInventoryFlows,
  readInventoryItems,
  writeInventoryFlows,
  writeInventoryItems,
} from "../../utils/storage";

type InventoryRecord = InventoryItem;
type FlowRecord = InventoryFlow;

type AlertRecord = {
  id: string;
  itemCode: string;
  itemName: string;
  warehouse: string;
  location: string;
  supplier: string;
  supplierPhone?: string;
  supplierAddress?: string;
  supplierLink?: string;
  level: string;
  message: string;
};

type InventoryProps = {
  activeKey?: string;
  currentUser?: UserInfo | null;
};

const Inventory = ({ currentUser }: InventoryProps) => {
  const [keyword, setKeyword] = useState("");
  const [warehouse, setWarehouse] = useState<string | undefined>();
  const [location, setLocation] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();
  const [supplier, setSupplier] = useState<string | undefined>();
  const [model, setModel] = useState<string | undefined>();
  const [inboundRange, setInboundRange] = useState<[Dayjs | null, Dayjs | null] | null>(
    null,
  );
  const [balances, setBalances] = useState<InventoryRecord[]>(readInventoryItems());
  const [flows, setFlows] = useState<FlowRecord[]>(readInventoryFlows());
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [currentLogs, setCurrentLogs] = useState<FlowRecord[]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState<AlertRecord | null>(null);
  const [extraWarehouses, setExtraWarehouses] = useState<string[]>([]);
  const [extraLocations, setExtraLocations] = useState<string[]>([]);
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [extraSuppliers, setExtraSuppliers] = useState<string[]>([]);
  const [newWarehouse, setNewWarehouse] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const isAdmin = currentUser?.role === "ADMIN";

  const operatorName =
    currentUser?.displayName || currentUser?.username || "管理员";

  useEffect(() => {
    const sync = () => {
      const nextBalances = readInventoryItems();
      const nextFlows = readInventoryFlows();
      const nextSuppliers = readBaseList("supplier");
      setBalances(nextBalances);
      setFlows(nextFlows);
      setAlerts(
        nextBalances
          .filter((item) => item.remainQty <= 10)
          .map((item) => {
            const supplierInfo = nextSuppliers.find(
              (supplier) => supplier.name === item.supplier,
            );
            return {
              id: `alert-${item.itemCode}`,
              itemCode: item.itemCode,
              itemName: item.itemName,
              warehouse: item.warehouse,
              location: item.location,
              supplier: item.supplier,
              supplierPhone: supplierInfo?.phone,
              supplierAddress: supplierInfo?.address,
              supplierLink: supplierInfo?.link,
              level: "低库存",
              message: "库存低于安全线",
            };
          }),
      );
    };
    sync();
    return onStoreChange(sync);
  }, []);

  const warehouseOptions = useMemo(() => {
    const base = balances.map((item) => item.warehouse);
    return Array.from(new Set([...base, ...extraWarehouses]));
  }, [balances, extraWarehouses]);
  const locationOptions = useMemo(() => {
    const base = balances.map((item) => item.location);
    return Array.from(new Set([...base, ...extraLocations]));
  }, [balances, extraLocations]);
  const categoryOptions = useMemo(() => {
    const base = balances.map((item) => item.category);
    return Array.from(new Set([...base, ...extraCategories]));
  }, [balances, extraCategories]);
  const supplierOptions = useMemo(() => {
    const base = balances.map((item) => item.supplier);
    return Array.from(new Set([...base, ...extraSuppliers]));
  }, [balances, extraSuppliers]);
  const modelOptions = useMemo(
    () => Array.from(new Set(balances.map((item) => item.model))),
    [balances],
  );

  const filteredBalances = useMemo(
    () =>
      balances.filter(
        (item) =>
          (item.itemCode.includes(keyword) ||
            item.itemName.includes(keyword) ||
            item.model.includes(keyword)) &&
          (!warehouse || item.warehouse === warehouse) &&
          (!location || item.location === location) &&
          (!category || item.category === category) &&
          (!supplier || item.supplier === supplier) &&
          (!model || item.model === model) &&
          (!inboundRange ||
            (!inboundRange[0] && !inboundRange[1]) ||
            (() => {
              const inboundTime = new Date(item.inboundAt).getTime();
              const start = inboundRange[0]?.startOf("day").valueOf();
              const end = inboundRange[1]?.endOf("day").valueOf();
              if (start && inboundTime < start) return false;
              if (end && inboundTime > end) return false;
              return true;
            })()),
      ),
    [balances, category, inboundRange, keyword, location, model, supplier, warehouse],
  );

  const filteredFlows = useMemo(
    () =>
      flows.filter(
        (item) =>
          item.itemCode.includes(keyword) ||
          item.itemName.includes(keyword) ||
          item.action.includes(keyword),
      ),
    [flows, keyword],
  );

  const filteredAlerts = useMemo(
    () =>
      alerts.filter(
        (item) =>
          item.itemCode.includes(keyword) || item.itemName.includes(keyword),
      ),
    [alerts, keyword],
  );

  const handleOpenLogs = (record: InventoryRecord) => {
    const logs = flows.filter((flow) => flow.itemCode === record.itemCode);
    setCurrentLogs(
      logs.length > 0
        ? logs
        : [
            {
              id: `log-${record.id}`,
              itemCode: record.itemCode,
              itemName: record.itemName,
              action: "入库",
              quantity: record.remainQty + record.outboundQty,
              operator: "管理员",
              createdAt: new Date().toLocaleString(),
            },
          ],
    );
    setLogOpen(true);
  };

  const handleDeleteItem = (record: InventoryRecord) => {
    if (!isAdmin) {
      messageApi.error("仅管理员可删除库存记录");
      return;
    }
    Modal.confirm({
      title: "确认删除库存记录？",
      content: "删除后无法恢复。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => {
        const nextBalances = balances.filter((item) => item.id !== record.id);
        const nextFlows = flows.filter((item) => item.itemCode !== record.itemCode);
        setBalances(nextBalances);
        setFlows(nextFlows);
        writeInventoryItems(nextBalances);
        writeInventoryFlows(nextFlows);
        messageApi.success("库存记录已删除");
      },
    });
  };

  const addExtraOption = (
    value: string,
    current: string[],
    setter: (next: string[]) => void,
    onReset: () => void,
    onSelect: (nextValue: string) => void,
  ) => {
    const trimmed = value.trim();
    if (!trimmed) {
      messageApi.error("请输入有效值");
      return;
    }
    if (!current.includes(trimmed)) {
      setter([...current, trimmed]);
    }
    onReset();
    onSelect(trimmed);
    messageApi.success("已新增选项");
  };

  const handleOpenSupplier = (record: AlertRecord) => {
    setCurrentSupplier(record);
    setSupplierOpen(true);
    const nextFlow = {
      id: `flow-${record.id}-${Date.now()}`,
      itemCode: record.itemCode,
      itemName: record.itemName,
      action: "联系供应商",
      quantity: 0,
      operator: operatorName,
      createdAt: new Date().toLocaleString(),
    };
    const nextFlows = [...flows, nextFlow];
    setFlows(nextFlows);
    writeInventoryFlows(nextFlows);
  };

  const handlePurchase = (record: AlertRecord) => {
    const link = record.supplierLink?.trim();
    if (!link || !/^https?:\/\//i.test(link)) {
      messageApi.error("未配置有效的采购链接");
      return;
    }
    Modal.confirm({
      title: "确认发起采购？",
      content: "将打开供应商采购页面。",
      okText: "确认前往",
      cancelText: "取消",
      onOk: () => {
        window.open(link, "_blank", "noopener,noreferrer");
        const nextFlow = {
          id: `flow-${record.id}-${Date.now()}`,
          itemCode: record.itemCode,
          itemName: record.itemName,
          action: "发起采购",
          quantity: 0,
          operator: operatorName,
          createdAt: new Date().toLocaleString(),
        };
        const nextFlows = [...flows, nextFlow];
        setFlows(nextFlows);
        writeInventoryFlows(nextFlows);
      },
    });
  };

  return (
    <Card>
      {contextHolder}
      <Typography.Title level={4}>库存管理</Typography.Title>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索物料/型号/编码"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 220 }}
        />
        <Select
          placeholder="选择仓库"
          allowClear
          value={warehouse}
          onChange={(value) => setWarehouse(value)}
          options={warehouseOptions.map((item) => ({ label: item, value: item }))}
          style={{ width: 160 }}
          dropdownRender={(menu) => (
            <>
              {menu}
              <Space style={{ padding: 8 }}>
                <Input
                  placeholder="新增仓库"
                  value={newWarehouse}
                  onChange={(event) => setNewWarehouse(event.target.value)}
                />
                <Button
                  type="primary"
                  onClick={() =>
                    addExtraOption(
                      newWarehouse,
                      warehouseOptions,
                      setExtraWarehouses,
                      () => setNewWarehouse(""),
                      (value) => setWarehouse(value),
                    )
                  }
                >
                  新增
                </Button>
              </Space>
            </>
          )}
        />
        <Select
          placeholder="选择库位"
          allowClear
          value={location}
          onChange={(value) => setLocation(value)}
          options={locationOptions.map((item) => ({ label: item, value: item }))}
          style={{ width: 160 }}
          dropdownRender={(menu) => (
            <>
              {menu}
              <Space style={{ padding: 8 }}>
                <Input
                  placeholder="新增库位"
                  value={newLocation}
                  onChange={(event) => setNewLocation(event.target.value)}
                />
                <Button
                  type="primary"
                  onClick={() =>
                    addExtraOption(
                      newLocation,
                      locationOptions,
                      setExtraLocations,
                      () => setNewLocation(""),
                      (value) => setLocation(value),
                    )
                  }
                >
                  新增
                </Button>
              </Space>
            </>
          )}
        />
        <Select
          placeholder="选择类别"
          allowClear
          value={category}
          onChange={(value) => setCategory(value)}
          options={categoryOptions.map((item) => ({ label: item, value: item }))}
          style={{ width: 160 }}
          dropdownRender={(menu) => (
            <>
              {menu}
              <Space style={{ padding: 8 }}>
                <Input
                  placeholder="新增类别"
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                />
                <Button
                  type="primary"
                  onClick={() =>
                    addExtraOption(
                      newCategory,
                      categoryOptions,
                      setExtraCategories,
                      () => setNewCategory(""),
                      (value) => setCategory(value),
                    )
                  }
                >
                  新增
                </Button>
              </Space>
            </>
          )}
        />
        <Select
          placeholder="选择供应商"
          allowClear
          value={supplier}
          onChange={(value) => setSupplier(value)}
          options={supplierOptions.map((item) => ({ label: item, value: item }))}
          style={{ width: 180 }}
          dropdownRender={(menu) => (
            <>
              {menu}
              <Space style={{ padding: 8 }}>
                <Input
                  placeholder="新增供应商"
                  value={newSupplier}
                  onChange={(event) => setNewSupplier(event.target.value)}
                />
                <Button
                  type="primary"
                  onClick={() =>
                    addExtraOption(
                      newSupplier,
                      supplierOptions,
                      setExtraSuppliers,
                      () => setNewSupplier(""),
                      (value) => setSupplier(value),
                    )
                  }
                >
                  新增
                </Button>
              </Space>
            </>
          )}
        />
        <Select
          placeholder="选择型号"
          allowClear
          value={model}
          onChange={(value) => setModel(value)}
          options={modelOptions.map((item) => ({ label: item, value: item }))}
          style={{ width: 160 }}
        />
        <DatePicker.RangePicker
          value={inboundRange ?? undefined}
          onChange={(value) => setInboundRange(value)}
          format="YYYY年MM月DD日"
          placeholder={["开始日期", "结束日期"]}
        />
      </Space>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <div>
          <Typography.Title level={5}>库存列表</Typography.Title>
          <Table
            rowKey="id"
            columns={[
              {
                title: "图片",
                dataIndex: "imageUrl",
                render: (value?: string) =>
                  value ? <Image width={48} src={value} preview={{ mask: "查看大图" }} /> : "—",
              },
              { title: "仓库", dataIndex: "warehouse" },
              { title: "库位", dataIndex: "location" },
              { title: "类别", dataIndex: "category" },
              { title: "物料编码", dataIndex: "itemCode" },
              { title: "物料名称", dataIndex: "itemName" },
              { title: "型号", dataIndex: "model" },
              { title: "已出库数量", dataIndex: "outboundQty" },
              { title: "剩余数量", dataIndex: "remainQty" },
              {
                title: "操作",
                dataIndex: "action",
                render: (_, record) => (
                  <Space>
                    <Button type="link" onClick={() => handleOpenLogs(record)}>
                      查看记录
                    </Button>
                    {isAdmin ? (
                      <Button danger onClick={() => handleDeleteItem(record)}>
                        删除
                      </Button>
                    ) : null}
                  </Space>
                ),
              },
            ]}
            dataSource={filteredBalances}
            pagination={{ pageSize: 8 }}
          />
        </div>
        <div>
          <Typography.Title level={5}>库存流水</Typography.Title>
          <Table
            rowKey="id"
            columns={[
              { title: "物料编码", dataIndex: "itemCode" },
              { title: "物料名称", dataIndex: "itemName" },
              { title: "动作", dataIndex: "action" },
              { title: "数量", dataIndex: "quantity" },
              { title: "操作人", dataIndex: "operator" },
              { title: "发生时间", dataIndex: "createdAt" },
            ]}
            dataSource={filteredFlows}
            pagination={{ pageSize: 8 }}
          />
        </div>
        <div>
          <Typography.Title level={5}>库存预警</Typography.Title>
          <Table
            rowKey="id"
            columns={[
              { title: "物料编码", dataIndex: "itemCode" },
              { title: "物料名称", dataIndex: "itemName" },
              { title: "仓库", dataIndex: "warehouse" },
              { title: "库位", dataIndex: "location" },
              { title: "供应商", dataIndex: "supplier" },
              { title: "等级", dataIndex: "level" },
              { title: "说明", dataIndex: "message" },
              {
                title: "操作",
                dataIndex: "action",
                render: (_, record: AlertRecord) => (
                  <Space>
                    <Button onClick={() => handleOpenSupplier(record)}>供应商</Button>
                    <Button type="primary" onClick={() => handlePurchase(record)}>
                      采购
                    </Button>
                  </Space>
                ),
              },
            ]}
            dataSource={filteredAlerts}
            pagination={{ pageSize: 8 }}
          />
        </div>
      </Space>
      <Modal
        open={logOpen}
        title="操作记录"
        onCancel={() => setLogOpen(false)}
        footer={null}
      >
        <Table
          rowKey="id"
          columns={[
            { title: "物料编码", dataIndex: "itemCode" },
            { title: "物料名称", dataIndex: "itemName" },
            { title: "动作", dataIndex: "action" },
            { title: "数量", dataIndex: "quantity" },
            { title: "操作人", dataIndex: "operator" },
            { title: "时间", dataIndex: "createdAt" },
          ]}
          dataSource={currentLogs}
          pagination={{ pageSize: 6 }}
        />
      </Modal>
      <Modal
        open={supplierOpen}
        title="供应商详情"
        onCancel={() => setSupplierOpen(false)}
        footer={null}
      >
        {currentSupplier ? (
          <Space direction="vertical">
            <Typography.Text>名称：{currentSupplier.supplier}</Typography.Text>
            <Typography.Text>
              联系方式：{currentSupplier.supplierPhone ?? "未维护"}
            </Typography.Text>
            <Typography.Text>
              收货地址：{currentSupplier.supplierAddress ?? "未维护"}
            </Typography.Text>
            <Typography.Text>
              下单链接：{currentSupplier.supplierLink ?? "未维护"}
            </Typography.Text>
          </Space>
        ) : null}
      </Modal>
    </Card>
  );
};


export default Inventory;
