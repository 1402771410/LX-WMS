import { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Modal, Select, Space, Table, Upload, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { RcFile, UploadFile } from "antd/es/upload";
import type { UserInfo } from "../../types/runtime";
import type {
  BaseRecord,
  InboundOrder,
  InventoryFlow,
  InventoryItem,
  PermissionRule,
} from "../../utils/storage";
import {
  addBaseItem,
  buildPermissionChecker,
  generateItemCode,
  onStoreChange,
  readBaseList,
  readInboundOrders,
  readInventoryFlows,
  readInventoryItems,
  readPermissionRules,
  writeInboundOrders,
  writeInventoryFlows,
  writeInventoryItems,
} from "../../utils/storage";

type InboundProps = {
  currentUser?: UserInfo | null;
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const Inbound = ({ currentUser }: InboundProps) => {
  const [orders, setOrders] = useState<InboundOrder[]>(readInboundOrders());
  const [openOrder, setOpenOrder] = useState(false);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [warehouses, setWarehouses] = useState<BaseRecord[]>(readBaseList("warehouse"));
  const [locations, setLocations] = useState<BaseRecord[]>(readBaseList("location"));
  const [categories, setCategories] = useState<BaseRecord[]>(readBaseList("category"));
  const [suppliers, setSuppliers] = useState<BaseRecord[]>(readBaseList("supplier"));
  const [newWarehouse, setNewWarehouse] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [imageFiles, setImageFiles] = useState<UploadFile[]>([]);
  const [permissionRules, setPermissionRules] = useState<PermissionRule[]>(
    readPermissionRules(),
  );

  useEffect(() => {
    const sync = () => {
      setOrders(readInboundOrders());
      setWarehouses(readBaseList("warehouse"));
      setLocations(readBaseList("location"));
      setCategories(readBaseList("category"));
      setSuppliers(readBaseList("supplier"));
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
  const canInbound = hasPermission("inbound");

  const applyInboundToInventory = (record: InboundOrder) => {
    const items = readInventoryItems();
    const flows = readInventoryFlows();
    const existing = items.find((item) => item.itemCode === record.itemCode);
    let nextItems: InventoryItem[];
    if (existing) {
      nextItems = items.map((item) =>
        item.itemCode === record.itemCode
          ? {
              ...item,
              imageUrl: record.imageUrl ?? item.imageUrl,
              inboundQty: item.inboundQty + record.quantity,
              remainQty: item.remainQty + record.quantity,
            }
          : item,
      );
    } else {
      nextItems = [
        ...items,
        {
          id: createId(),
          itemCode: record.itemCode,
          itemName: record.itemName,
          model: record.model,
          warehouse: record.warehouse,
          location: record.location,
          category: record.category,
          supplier: record.supplier,
          imageUrl: record.imageUrl,
          inboundQty: record.quantity,
          outboundQty: 0,
          remainQty: record.quantity,
          inboundAt: record.createdAt,
        },
      ];
    }
    const nextFlows: InventoryFlow[] = [
      ...flows,
      {
        id: createId(),
        itemCode: record.itemCode,
        itemName: record.itemName,
        action: "入库",
        quantity: record.quantity,
        operator: record.operator,
        createdAt: new Date().toLocaleString(),
      },
    ];
    writeInventoryItems(nextItems);
    writeInventoryFlows(nextFlows);
  };

  const handleFinishInbound = (record: InboundOrder) => {
    if (!canInbound) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    if (record.status === "已入库") return;
    applyInboundToInventory(record);
    const current = readInboundOrders();
    const nextOrders = current.map((item) =>
      item.id === record.id ? { ...item, status: "已入库" } : item,
    );
    setOrders(nextOrders);
    writeInboundOrders(nextOrders);
    messageApi.success("入库完成");
  };

  const orderColumns: ColumnsType<InboundOrder> = [
    { title: "单号", dataIndex: "code" },
    { title: "编号", dataIndex: "itemCode" },
    { title: "物品名称", dataIndex: "itemName" },
    { title: "型号", dataIndex: "model" },
    { title: "数量", dataIndex: "quantity" },
    { title: "仓库", dataIndex: "warehouse" },
    { title: "库位", dataIndex: "location" },
    { title: "类别", dataIndex: "category" },
    { title: "供应商", dataIndex: "supplier" },
    { title: "操作人", dataIndex: "operator" },
    { title: "状态", dataIndex: "status" },
    { title: "创建时间", dataIndex: "createdAt" },
    {
      title: "操作",
      dataIndex: "action",
      render: (_, record) => (
        <Button
          type="link"
          disabled={record.status === "已入库" || !canInbound}
          onClick={() => handleFinishInbound(record)}
        >
          完成入库
        </Button>
      ),
    },
  ];

  const handleCreateOrder = async () => {
    if (!canInbound) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    const values = await form.validateFields();
    const code = values.code?.trim() || `IN-${Date.now()}`;
    const itemCode = values.itemCode?.trim() || generateItemCode(values.itemName, values.model);
    const createdAt = new Date().toLocaleString();
    const nextOrder: InboundOrder = {
      id: createId(),
      code,
      itemCode,
      itemName: values.itemName,
      model: values.model,
      quantity: Number(values.quantity),
      warehouse: values.warehouse,
      location: values.location,
      category: values.category,
      supplier: values.supplier,
      imageUrl: values.imageUrl,
      operator: operatorName,
      status: "已入库",
      createdAt,
      source: values.source,
    };
    const nextOrders = [...orders, nextOrder];
    setOrders(nextOrders);
    writeInboundOrders(nextOrders);
    applyInboundToInventory(nextOrder);
    setOpenOrder(false);
    form.resetFields();
    setImageFiles([]);
  };

  const openOrderModal = () => {
    form.resetFields();
    setImageFiles([]);
    setOpenOrder(true);
  };

  const handleBeforeUpload = (file: RcFile) => {
    const isValidType = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (!isValidType) {
      messageApi.error("仅支持 JPG、PNG、WEBP 格式图片");
      return Upload.LIST_IGNORE;
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      messageApi.error("图片大小需小于 2MB");
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const toBase64 = (file: RcFile) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(file);
    });

  const handleImageChange = async (info: { fileList: UploadFile[] }) => {
    const nextList = info.fileList.slice(-1);
    setImageFiles(nextList);
    const target = nextList[0];
    if (!target) {
      form.setFieldsValue({ imageUrl: undefined });
      return;
    }
    if (target.originFileObj) {
      try {
        const base64 = await toBase64(target.originFileObj as RcFile);
        form.setFieldsValue({ imageUrl: base64 });
      } catch {
        messageApi.error("图片读取失败");
        setImageFiles([]);
        form.setFieldsValue({ imageUrl: undefined });
      }
    }
  };

  const handleCreateWarehouse = () => {
    const value = newWarehouse.trim();
    if (!value) {
      messageApi.error("请输入仓库名称");
      return;
    }
    const record = { id: createId(), code: `WH-${Date.now()}`, name: value };
    addBaseItem("warehouse", record);
    setWarehouses((prev) => [...prev, record]);
    setNewWarehouse("");
    messageApi.success("仓库已新增");
  };

  const handleCreateLocation = () => {
    const value = newLocation.trim();
    if (!value) {
      messageApi.error("请输入库位名称");
      return;
    }
    const record = { id: createId(), code: `LC-${Date.now()}`, name: value };
    addBaseItem("location", record);
    setLocations((prev) => [...prev, record]);
    setNewLocation("");
    messageApi.success("库位已新增");
  };

  const handleCreateCategory = () => {
    const value = newCategory.trim();
    if (!value) {
      messageApi.error("请输入类别名称");
      return;
    }
    const record = { id: createId(), code: `CT-${Date.now()}`, name: value };
    addBaseItem("category", record);
    setCategories((prev) => [...prev, record]);
    setNewCategory("");
    messageApi.success("类别已新增");
  };

  const handleCreateSupplier = () => {
    const value = newSupplier.trim();
    if (!value) {
      messageApi.error("请输入供应商名称");
      return;
    }
    const record = { id: createId(), code: `SP-${Date.now()}`, name: value };
    addBaseItem("supplier", record);
    setSuppliers((prev) => [...prev, record]);
    setNewSupplier("");
    messageApi.success("供应商已新增");
  };

  return (
    <Card>
      {contextHolder}
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={openOrderModal} disabled={!canInbound}>
          新建入库单
        </Button>
      </Space>
      <Table rowKey="id" columns={orderColumns} dataSource={orders} pagination={{ pageSize: 8 }} />
      <Modal
        open={openOrder}
        title="新建入库单"
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
          <Form.Item name="itemCode" label="编号">
            <Input placeholder="留空自动生成" />
          </Form.Item>
          <Form.Item
            name="warehouse"
            label="仓库"
            rules={[{ required: true, message: "请选择仓库" }]}
          >
            <Select
              placeholder="选择仓库"
              options={warehouses.map((item) => ({ label: item.name, value: item.name }))}
            />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Input
              placeholder="输入新仓库"
              value={newWarehouse}
              onChange={(event) => setNewWarehouse(event.target.value)}
            />
            <Button onClick={handleCreateWarehouse}>新建</Button>
          </Space>
          <Form.Item
            name="location"
            label="库位"
            rules={[{ required: true, message: "请选择库位" }]}
          >
            <Select
              placeholder="选择库位"
              options={locations.map((item) => ({ label: item.name, value: item.name }))}
            />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Input
              placeholder="输入新库位"
              value={newLocation}
              onChange={(event) => setNewLocation(event.target.value)}
            />
            <Button onClick={handleCreateLocation}>新建</Button>
          </Space>
          <Form.Item
            name="category"
            label="类别"
            rules={[{ required: true, message: "请选择类别" }]}
          >
            <Select
              placeholder="选择类别"
              options={categories.map((item) => ({ label: item.name, value: item.name }))}
            />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Input
              placeholder="输入新类别"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
            />
            <Button onClick={handleCreateCategory}>新建</Button>
          </Space>
          <Form.Item
            name="itemName"
            label="物品名称"
            rules={[{ required: true, message: "请输入物品名称" }]}
          >
            <Input placeholder="请输入物品名称" />
          </Form.Item>
          <Form.Item
            name="model"
            label="型号"
            rules={[{ required: true, message: "请输入型号" }]}
          >
            <Input placeholder="请输入型号" />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="数量"
            rules={[{ required: true, message: "请输入数量" }]}
          >
            <Input type="number" min={1} placeholder="请输入数量" />
          </Form.Item>
          <Form.Item
            name="supplier"
            label="供应商"
            rules={[{ required: true, message: "请选择供应商" }]}
          >
            <Select
              placeholder="选择供应商"
              options={suppliers.map((item) => ({ label: item.name, value: item.name }))}
            />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Input
              placeholder="输入新供应商"
              value={newSupplier}
              onChange={(event) => setNewSupplier(event.target.value)}
            />
            <Button onClick={handleCreateSupplier}>新建</Button>
          </Space>
          <Form.Item label="物品图片">
            <Upload
              accept="image/png,image/jpeg,image/webp"
              listType="picture-card"
              maxCount={1}
              fileList={imageFiles}
              beforeUpload={handleBeforeUpload}
              onChange={handleImageChange}
              onRemove={() => {
                form.setFieldsValue({ imageUrl: undefined });
                setImageFiles([]);
                return true;
              }}
            >
              {imageFiles.length >= 1 ? null : "上传图片"}
            </Upload>
          </Form.Item>
          <Form.Item name="imageUrl" hidden>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Inbound;
