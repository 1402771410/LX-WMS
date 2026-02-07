import { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Modal, Select, Space, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UserInfo } from "../../types/runtime";
import type {
  BaseRecord,
  InventoryFlow,
  InventoryItem,
  OutboundOrder,
  PermissionRule,
} from "../../utils/storage";
import {
  addBaseItem,
  buildPermissionChecker,
  onStoreChange,
  readBaseList,
  readInventoryFlows,
  readInventoryItems,
  readPermissionRules,
  readOutboundOrders,
  writeInventoryFlows,
  writeInventoryItems,
  writeOutboundOrders,
} from "../../utils/storage";

type OutboundProps = {
  currentUser?: UserInfo | null;
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const Outbound = ({ currentUser }: OutboundProps) => {
  const [orders, setOrders] = useState<OutboundOrder[]>(readOutboundOrders());
  const [openOrder, setOpenOrder] = useState(false);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [projects, setProjects] = useState<BaseRecord[]>(readBaseList("project"));
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(
    readInventoryItems(),
  );
  const [newProject, setNewProject] = useState("");
  const [permissionRules, setPermissionRules] = useState<PermissionRule[]>(
    readPermissionRules(),
  );

  useEffect(() => {
    const sync = () => {
      setOrders(readOutboundOrders());
      setProjects(readBaseList("project"));
      setInventoryItems(readInventoryItems());
      setPermissionRules(readPermissionRules());
    };
    sync();
    return onStoreChange(sync);
  }, []);

  const operatorName =
    currentUser?.displayName || currentUser?.username || "管理员";
  const { hasPermission } = useMemo(
    () => buildPermissionChecker(currentUser?.role, permissionRules),
    [currentUser?.role, permissionRules],
  );
  const canOutbound = hasPermission("outbound");

  const orderColumns = useMemo(
    (): ColumnsType<OutboundOrder> => [
      { title: "单号", dataIndex: "code" },
      { title: "编号", dataIndex: "itemCode" },
      { title: "物品名称", dataIndex: "itemName" },
      { title: "型号", dataIndex: "model" },
      { title: "出库数量", dataIndex: "quantity" },
      { title: "关联项目", dataIndex: "project" },
      { title: "操作人", dataIndex: "operator" },
      { title: "状态", dataIndex: "status" },
      { title: "创建时间", dataIndex: "createdAt" },
    ],
    [],
  );

  const handleCreateOrder = async () => {
    if (!canOutbound) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    const values = await form.validateFields();
    const selected = inventoryItems.find((item) => item.itemCode === values.itemCode);
    if (!selected) {
      messageApi.error("请选择有效物品");
      return;
    }
    const qty = Number(values.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      messageApi.error("出库数量必须大于 0");
      return;
    }
    if (selected.remainQty < qty) {
      messageApi.error("库存不足，无法出库");
      return;
    }
    const code = values.code?.trim() || `OUT-${Date.now()}`;
    const createdAt = new Date().toLocaleString();
    const nextOrder: OutboundOrder = {
      id: createId(),
      code,
      itemCode: selected.itemCode,
      itemName: selected.itemName,
      model: selected.model,
      quantity: qty,
      project: values.project,
      operator: operatorName,
      status: "已出库",
      createdAt,
    };
    const nextOrders = [...orders, nextOrder];
    const nextItems = inventoryItems.map((item) =>
      item.itemCode === selected.itemCode
        ? {
            ...item,
            outboundQty: item.outboundQty + qty,
            remainQty: item.remainQty - qty,
          }
        : item,
    );
    const flows = readInventoryFlows();
    const nextFlows: InventoryFlow[] = [
      ...flows,
      {
        id: createId(),
        itemCode: selected.itemCode,
        itemName: selected.itemName,
        action: "出库",
        quantity: qty,
        operator: operatorName,
        createdAt,
      },
    ];
    setOrders(nextOrders);
    setInventoryItems(nextItems);
    writeOutboundOrders(nextOrders);
    writeInventoryItems(nextItems);
    writeInventoryFlows(nextFlows);
    setOpenOrder(false);
    form.resetFields();
  };

  const openOrderModal = () => {
    form.resetFields();
    setOpenOrder(true);
  };

  const handleCreateProject = () => {
    const value = newProject.trim();
    if (!value) {
      messageApi.error("请输入项目名称");
      return;
    }
    const record = { id: createId(), code: `PJ-${Date.now()}`, name: value };
    addBaseItem("project", record);
    setProjects((prev) => [...prev, record]);
    setNewProject("");
    messageApi.success("项目已新增");
  };
  return (
    <Card>
      {contextHolder}
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={openOrderModal} disabled={!canOutbound}>
          新建出库单
        </Button>
      </Space>
      <Table rowKey="id" columns={orderColumns} dataSource={orders} pagination={{ pageSize: 8 }} />
      <Modal
        open={openOrder}
        title="新建出库单"
        onCancel={() => setOpenOrder(false)}
        onOk={handleCreateOrder}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="单号"
          >
            <Input placeholder="留空自动生成" />
          </Form.Item>
          <Form.Item
            name="project"
            label="关联项目"
            rules={[{ required: true, message: "请选择项目" }]}
          >
            <Select
              placeholder="选择项目"
              options={projects.map((item) => ({ label: item.name, value: item.name }))}
            />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Input
              placeholder="输入新项目"
              value={newProject}
              onChange={(event) => setNewProject(event.target.value)}
            />
            <Button onClick={handleCreateProject}>新建</Button>
          </Space>
          <Form.Item
            name="itemCode"
            label="选择物品"
            rules={[{ required: true, message: "请选择物品" }]}
          >
            <Select
              showSearch
              placeholder="输入物品名称或型号搜索"
              optionFilterProp="label"
              filterOption={(input, option) =>
                String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
              options={inventoryItems.map((item) => ({
                label: `${item.itemName}（${item.model || "—"}｜${item.itemCode}）`,
                value: item.itemCode,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="出库数量"
            rules={[{ required: true, message: "请输入出库数量" }]}
          >
            <Input type="number" min={1} placeholder="请输入出库数量" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Outbound;
