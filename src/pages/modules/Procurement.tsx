import {
  Button,
  Card,
  Form,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  Upload,
  message,
} from "antd";
import type { RcFile, UploadFile } from "antd/es/upload/interface";
import { useEffect, useMemo, useState } from "react";
import {
  confirmDelivery,
  createPurchaseRequest,
  createReorderRequest,
  markPurchased,
  rejectPurchaseRequest,
  toWaitingRecord,
} from "../../utils/procurement";
import type { PurchaseRecord } from "../../utils/procurement";
import type { UserInfo } from "../../types/runtime";
import type { InboundOrder, PermissionRule, PurchaseRequest } from "../../utils/storage";
import {
  buildPermissionChecker,
  onStoreChange,
  readBaseList,
  readInboundOrders,
  readPermissionRules,
  readPurchaseRequests,
  writeInboundOrders,
  writePurchaseRequests,
} from "../../utils/storage";

type ProcurementProps = {
  activeKey?: string;
  currentUser?: UserInfo | null;
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const Procurement = ({ activeKey, currentUser }: ProcurementProps) => {
  const [messageApi, contextHolder] = message.useMessage();
  const [openRequest, setOpenRequest] = useState(false);
  const [form] = Form.useForm();
  const [requests, setRequests] = useState<PurchaseRequest[]>(readPurchaseRequests());
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<PurchaseRequest | null>(null);
  const [rejectForm] = Form.useForm();
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceTarget, setPriceTarget] = useState<PurchaseRequest | null>(null);
  const [priceForm] = Form.useForm();
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryTarget, setDeliveryTarget] = useState<PurchaseRequest | null>(null);
  const [deliveryForm] = Form.useForm();
  const [inboundOpen, setInboundOpen] = useState(false);
  const [inboundTarget, setInboundTarget] = useState<PurchaseRequest | null>(null);
  const [inboundForm] = Form.useForm();
  const [imageFiles, setImageFiles] = useState<UploadFile[]>([]);
  const [deliveryFiles, setDeliveryFiles] = useState<UploadFile[]>([]);
  const [inboundFiles, setInboundFiles] = useState<UploadFile[]>([]);
  const [permissionRules, setPermissionRules] = useState<PermissionRule[]>(
    readPermissionRules(),
  );
  const [warehouseOptions, setWarehouseOptions] = useState<string[]>(
    readBaseList("warehouse").map((item) => item.name),
  );
  const [locationOptions, setLocationOptions] = useState<string[]>(
    readBaseList("location").map((item) => item.name),
  );
  const [categoryOptions, setCategoryOptions] = useState<string[]>(
    readBaseList("category").map((item) => item.name),
  );
  const [supplierOptions, setSupplierOptions] = useState<string[]>(
    readBaseList("supplier").map((item) => item.name),
  );
  const [newWarehouse, setNewWarehouse] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const isAdmin = currentUser?.role === "ADMIN";
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  const toSafeNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };
  const { hasPermission } = useMemo(
    () => buildPermissionChecker(currentUser?.role, permissionRules),
    [currentUser?.role, permissionRules],
  );
  const canCreateRequest = hasPermission("procurement:create");
  const canRejectRequest = hasPermission("procurement:reject");
  const canConfirmPurchase = hasPermission("procurement:purchase");
  const canConfirmDelivery = hasPermission("procurement:delivery");
  const canCreateInbound = hasPermission("procurement:inbound");

  useEffect(() => {
    const sync = () => {
      const nextRequests = readPurchaseRequests();
      setRequests(nextRequests);
      setWarehouseOptions(readBaseList("warehouse").map((item) => item.name));
      setLocationOptions(readBaseList("location").map((item) => item.name));
      setCategoryOptions(readBaseList("category").map((item) => item.name));
      setSupplierOptions(readBaseList("supplier").map((item) => item.name));
      setPermissionRules(readPermissionRules());
    };
    sync();
    return onStoreChange(sync);
  }, []);

  const getImageUrl = (id: string) => {
    const target = requests.find((item) => item.id === id);
    return target?.deliveryImageUrl ?? target?.imageUrl;
  };

  const handleDeleteRequest = (record: PurchaseRequest) => {
    if (!isAdmin) {
      messageApi.error("仅管理员可删除采购记录");
      return;
    }
    Modal.confirm({
      title: "确认删除采购记录？",
      content: "删除后无法恢复。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => {
        const next = requests.filter((item) => item.id !== record.id);
        setRequests(next);
        writePurchaseRequests(next);
        messageApi.success("采购记录已删除");
      },
    });
  };

  const handleReorder = (record: PurchaseRequest) => {
    if (!canCreateRequest) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    try {
      if (!Number.isFinite(record.estimatedPrice) || record.estimatedPrice <= 0) {
        form.setFieldsValue({
          itemName: record.itemName,
          model: record.model,
          quantity: record.quantity,
          estimatedPrice: undefined,
          imageUrl: record.imageUrl,
        });
        if (record.imageUrl) {
          setImageFiles([
            {
              uid: record.id,
              name: "采购图片",
              status: "done",
              url: record.imageUrl,
            },
          ]);
        } else {
          setImageFiles([]);
        }
        setOpenRequest(true);
        messageApi.error("请补充预计单价后再发起采购");
        return;
      }
      const nextRequest = createReorderRequest(record, {
        id: createId(),
        createdAt: new Date().toLocaleString(),
        requesterId: record.requesterId,
        requesterName: record.requesterName ?? currentUser?.username,
      });
      const next = [
        ...requests,
        nextRequest,
      ];
      setRequests(next);
      writePurchaseRequests(next);
      messageApi.success("已重新加入采购列表");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "再次采购失败");
    }
  };

  const requestColumns = [
    { title: "物品编码", dataIndex: "itemCode" },
    { title: "物品名称", dataIndex: "itemName" },
    { title: "型号", dataIndex: "model" },
    { title: "数量", dataIndex: "quantity" },
    {
      title: "图片",
      dataIndex: "imageUrl",
      render: (value?: string) => (value ? <Image width={48} src={value} /> : "—"),
    },
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
    {
      title: "驳回信息",
      dataIndex: "rejectReason",
      render: (value?: string) => value || "—",
    },
    { title: "驳回时间", dataIndex: "rejectedAt", render: (value?: string) => value || "—" },
    { title: "创建时间", dataIndex: "createdAt" },
    {
      title: "操作",
      dataIndex: "action",
      render: (_: unknown, record: PurchaseRequest) =>
        record.status === "已驳回" ? (
          <Space>
            <Button
              type="primary"
              onClick={() => {
                if (!canCreateRequest) {
                  messageApi.error("没有权限执行该操作");
                  return;
                }
                form.setFieldsValue({
                  itemName: record.itemName,
                  model: record.model,
                  quantity: record.quantity,
                  estimatedPrice: record.estimatedPrice,
                  imageUrl: record.imageUrl,
                });
                if (record.imageUrl) {
                  setImageFiles([
                    {
                      uid: record.id,
                      name: "采购图片",
                      status: "done",
                      url: record.imageUrl,
                    },
                  ]);
                } else {
                  setImageFiles([]);
                }
                setOpenRequest(true);
              }}
            >
              再次发起
            </Button>
            <Button
              onClick={() => {
                if (!canCreateRequest) {
                  messageApi.error("没有权限执行该操作");
                  return;
                }
                handleReorder(record);
              }}
            >
              再次采购
            </Button>
            {isAdmin ? (
              <Button danger onClick={() => handleDeleteRequest(record)}>
                删除
              </Button>
            ) : null}
          </Space>
        ) : (
          <Space>
            <Button
              onClick={() => {
                if (!canCreateRequest) {
                  messageApi.error("没有权限执行该操作");
                  return;
                }
                handleReorder(record);
              }}
            >
              再次采购
            </Button>
            {isAdmin ? (
              <Button danger onClick={() => handleDeleteRequest(record)}>
                删除
              </Button>
            ) : null}
          </Space>
        ),
    },
  ];

  const purchaseColumns = [
    { title: "物品编码", dataIndex: "itemCode" },
    { title: "物品名称", dataIndex: "itemName" },
    { title: "型号", dataIndex: "model" },
    { title: "数量", dataIndex: "quantity" },
    {
      title: "预计单价",
      dataIndex: "estimatedPrice",
      render: (_: unknown, record: PurchaseRecord) => {
        const target = requests.find((item) => item.id === record.id);
        return target && toSafeNumber(target.estimatedPrice) > 0
          ? `￥${formatCurrency(toSafeNumber(target.estimatedPrice))}`
          : "—";
      },
    },
    {
      title: "图片",
      dataIndex: "image",
      render: (_: unknown, record: PurchaseRecord) => {
        const imageUrl = getImageUrl(record.id);
        return imageUrl ? <Image width={48} src={imageUrl} /> : "—";
      },
    },
    { title: "状态", dataIndex: "status" },
    {
      title: "操作",
      dataIndex: "action",
      render: (_: unknown, record: PurchaseRecord) => (
        <Space>
          <Button
            danger
            onClick={() => {
              if (!canRejectRequest) {
                messageApi.error("没有权限执行该操作");
                return;
              }
              const target = requests.find((item) => item.id === record.id) ?? null;
              setRejectTarget(target);
              rejectForm.setFieldsValue({ reason: "" });
              setRejectOpen(true);
            }}
            disabled={!canRejectRequest}
          >
            驳回
          </Button>
          <Button
            type="primary"
            onClick={() => {
              if (!canConfirmPurchase) {
                messageApi.error("没有权限执行该操作");
                return;
              }
              const target = requests.find((item) => item.id === record.id) ?? null;
              if (!target) {
                messageApi.error("未找到对应采购记录");
                return;
              }
              setPriceTarget(target);
              priceForm.setFieldsValue({
                actualPrice: target.actualPrice ?? target.estimatedPrice,
                logisticsCompany: target.logisticsCompany ?? "",
                logisticsNumber: target.logisticsNumber ?? "",
                logisticsPhone: target.logisticsPhone ?? "",
              });
              setPriceOpen(true);
            }}
            disabled={!canConfirmPurchase}
          >
            已采购
          </Button>
          {isAdmin ? (
            <Button danger onClick={() => handleDeleteRequest(record as PurchaseRequest)}>
              删除
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const deliveryColumns = [
    { title: "物品编码", dataIndex: "itemCode" },
    { title: "物品名称", dataIndex: "itemName" },
    { title: "型号", dataIndex: "model" },
    { title: "数量", dataIndex: "quantity" },
    {
      title: "实际单价",
      dataIndex: "actualPrice",
      render: (value?: number) =>
        toSafeNumber(value) > 0 ? `￥${formatCurrency(toSafeNumber(value))}` : "—",
    },
    {
      title: "物流公司",
      dataIndex: "logisticsCompany",
      render: (value?: string) => value || "—",
    },
    {
      title: "物流单号",
      dataIndex: "logisticsNumber",
      render: (value?: string) => value || "—",
    },
    {
      title: "联系电话",
      dataIndex: "logisticsPhone",
      render: (value?: string) => value || "—",
    },
    {
      title: "采购时间",
      dataIndex: "purchasedAt",
      render: (value?: string) => value || "—",
    },
    { title: "状态", dataIndex: "status" },
    {
      title: "操作",
      dataIndex: "action",
      render: (_: unknown, record: PurchaseRequest) => (
        <Space>
          <Button
            type="primary"
            onClick={() => {
              if (!canConfirmDelivery) {
                messageApi.error("没有权限执行该操作");
                return;
              }
              const target = requests.find((item) => item.id === record.id) ?? null;
              if (!target) {
                messageApi.error("未找到对应采购记录");
                return;
              }
              deliveryForm.resetFields();
              setDeliveryFiles([]);
              setDeliveryTarget(target);
              setDeliveryOpen(true);
            }}
            disabled={!canConfirmDelivery}
          >
            收货确认
          </Button>
          {isAdmin ? (
            <Button danger onClick={() => handleDeleteRequest(record)}>
              删除
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const pendingColumns = [
    { title: "物品编码", dataIndex: "itemCode" },
    { title: "物品名称", dataIndex: "itemName" },
    { title: "型号", dataIndex: "model" },
    { title: "数量", dataIndex: "quantity" },
    {
      title: "实际单价",
      dataIndex: "actualPrice",
      render: (_: unknown, record: PurchaseRecord) => {
        const target = requests.find((item) => item.id === record.id);
        return target && toSafeNumber(target.actualPrice) > 0
          ? `￥${formatCurrency(toSafeNumber(target.actualPrice))}`
          : "—";
      },
    },
    {
      title: "图片",
      dataIndex: "image",
      render: (_: unknown, record: PurchaseRecord) => {
        const imageUrl = getImageUrl(record.id);
        return imageUrl ? <Image width={48} src={imageUrl} /> : "—";
      },
    },
    { title: "状态", dataIndex: "status" },
    {
      title: "操作",
      dataIndex: "action",
      render: (_: unknown, record: PurchaseRecord) => (
        <Space>
          <Button
            type="primary"
            onClick={() => {
              if (!canCreateInbound) {
                messageApi.error("没有权限执行该操作");
                return;
              }
              const target = requests.find((item) => item.id === record.id) ?? null;
              if (!target) {
                messageApi.error("未找到对应采购记录");
                return;
              }
              const inboundImageUrl = target.deliveryImageUrl ?? target.imageUrl;
              inboundForm.resetFields();
              inboundForm.setFieldsValue({
                itemCode: target.itemCode,
                itemName: target.itemName,
                model: target.model,
                quantity: target.quantity,
                warehouse: warehouseOptions[0] ?? undefined,
                location: locationOptions[0] ?? undefined,
                category: categoryOptions[0] ?? undefined,
                supplier: supplierOptions[0] ?? undefined,
                imageUrl: inboundImageUrl,
              });
              if (inboundImageUrl) {
                setInboundFiles([
                  {
                    uid: target.id,
                    name: "收货图片",
                    status: "done",
                    url: inboundImageUrl,
                  },
                ]);
              } else {
                setInboundFiles([]);
              }
              setInboundTarget(target);
              setInboundOpen(true);
            }}
            disabled={!canCreateInbound}
          >
            入库
          </Button>
          {isAdmin ? (
            <Button danger onClick={() => handleDeleteRequest(record as PurchaseRequest)}>
              删除
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const waitingList = useMemo(
    () => requests.filter((item) => item.status === "等待采购").map(toWaitingRecord),
    [requests],
  );
  const deliveryList = useMemo(
    () => requests.filter((item) => item.status === "送货中"),
    [requests],
  );

  const pendingInbound = useMemo(
    () =>
      requests
        .filter((item) => item.status === "等待入库")
        .map((item) => ({
          id: item.id,
          itemCode: item.itemCode,
          itemName: item.itemName,
          model: item.model,
          quantity: item.quantity,
          status: "等待入库",
        })),
    [requests],
  );

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

  const handleDeliveryImageChange = async (info: { fileList: UploadFile[] }) => {
    const nextList = info.fileList.slice(-1);
    setDeliveryFiles(nextList);
    const target = nextList[0];
    if (!target) {
      deliveryForm.setFieldsValue({ deliveryImageUrl: undefined });
      return;
    }
    if (target.originFileObj) {
      try {
        const base64 = await toBase64(target.originFileObj as RcFile);
        deliveryForm.setFieldsValue({ deliveryImageUrl: base64 });
      } catch {
        messageApi.error("图片读取失败");
        setDeliveryFiles([]);
        deliveryForm.setFieldsValue({ deliveryImageUrl: undefined });
      }
    }
  };

  const handleInboundImageChange = async (info: { fileList: UploadFile[] }) => {
    const nextList = info.fileList.slice(-1);
    setInboundFiles(nextList);
    const target = nextList[0];
    if (!target) {
      inboundForm.setFieldsValue({ imageUrl: undefined });
      return;
    }
    if (target.originFileObj) {
      try {
        const base64 = await toBase64(target.originFileObj as RcFile);
        inboundForm.setFieldsValue({ imageUrl: base64 });
      } catch {
        messageApi.error("图片读取失败");
        setInboundFiles([]);
        inboundForm.setFieldsValue({ imageUrl: undefined });
      }
    }
  };

  const handleCreateRequest = async () => {
    if (!canCreateRequest) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    try {
      const values = await form.validateFields();
      const record = createPurchaseRequest(
        {
          itemName: values.itemName,
          model: values.model,
          quantity: Number(values.quantity),
          estimatedPrice: Number(values.estimatedPrice),
          imageUrl: values.imageUrl,
        },
        createId(),
        new Date().toLocaleString(),
      ) as PurchaseRequest;
      const next = [
        ...requests,
        {
          ...record,
          requesterName: "默认用户",
        },
      ];
      setRequests(next);
      writePurchaseRequests(next);
      setOpenRequest(false);
      form.resetFields();
      setImageFiles([]);
      messageApi.success("采购请求已创建");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "提交失败";
      messageApi.error(messageText);
    }
  };

  const viewKey = activeKey ?? "finance";

  const handleReject = async () => {
    if (!canRejectRequest) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    if (!rejectTarget) {
      setRejectOpen(false);
      return;
    }
    try {
      const values = await rejectForm.validateFields();
      const nextRequests = requests.map((item) =>
        item.id === rejectTarget.id
          ? rejectPurchaseRequest(item, String(values.reason), new Date().toLocaleString())
          : item,
      );
      setRequests(nextRequests);
      writePurchaseRequests(nextRequests);
      setRejectOpen(false);
      setRejectTarget(null);
      rejectForm.resetFields();
      messageApi.success("已驳回采购请求");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "驳回失败";
      messageApi.error(messageText);
    }
  };
  const handleConfirmPrice = async () => {
    if (!canConfirmPurchase) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    if (!priceTarget) {
      setPriceOpen(false);
      return;
    }
    try {
      const values = await priceForm.validateFields();
      const actualPrice = Number(values.actualPrice);
      const nextRequests = requests.map((item) =>
        item.id === priceTarget.id
          ? markPurchased(item, new Date().toLocaleString(), actualPrice, {
              company: String(values.logisticsCompany ?? ""),
              number: String(values.logisticsNumber ?? ""),
              phone: values.logisticsPhone ? String(values.logisticsPhone) : undefined,
            })
          : item,
      );
      setRequests(nextRequests);
      writePurchaseRequests(nextRequests);
      setPriceOpen(false);
      setPriceTarget(null);
      priceForm.resetFields();
      messageApi.success("已进入送货中列表");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "确认采购失败";
      messageApi.error(messageText);
    }
  };
  const handleConfirmDelivery = async () => {
    if (!canConfirmDelivery) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    if (!deliveryTarget) {
      setDeliveryOpen(false);
      return;
    }
    try {
      const values = await deliveryForm.validateFields();
      const nextRequests = requests.map((item) =>
        item.id === deliveryTarget.id
          ? confirmDelivery(item, new Date().toLocaleString(), String(values.deliveryImageUrl))
          : item,
      );
      setRequests(nextRequests);
      writePurchaseRequests(nextRequests);
      setDeliveryOpen(false);
      setDeliveryTarget(null);
      deliveryForm.resetFields();
      setDeliveryFiles([]);
      messageApi.success("已进入未入库列表");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "收货确认失败";
      messageApi.error(messageText);
    }
  };

  const addOption = (
    value: string,
    current: string[],
    setter: (next: string[]) => void,
    onReset: () => void,
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
  };

  const handleCreateInbound = async () => {
    if (!canCreateInbound) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    if (!inboundTarget) {
      setInboundOpen(false);
      return;
    }
    const values = await inboundForm.validateFields();
    const inboundOrders = readInboundOrders();
    const nextInbound: InboundOrder = {
      id: createId(),
      code: values.code?.trim() || `IN-${Date.now()}`,
      itemCode: inboundTarget.itemCode,
      itemName: values.itemName,
      model: values.model,
      quantity: Number(values.quantity),
      warehouse: values.warehouse,
      location: values.location,
      category: values.category,
      supplier: values.supplier,
      imageUrl: values.imageUrl,
      operator: "采购员",
      status: "待上架",
      createdAt: new Date().toLocaleString(),
      source: "采购入库",
    };
    writeInboundOrders([...inboundOrders, nextInbound]);
    const nextRequests = requests.map((item) =>
      item.id === inboundTarget.id
        ? { ...item, status: "已入库", inboundAt: new Date().toLocaleString() }
        : item,
    );
    setRequests(nextRequests);
    writePurchaseRequests(nextRequests);
    setInboundOpen(false);
    setInboundTarget(null);
    inboundForm.resetFields();
    setInboundFiles([]);
    messageApi.success("已生成入库单");
  };
  const procurementSummary = useMemo(() => {
    const totals = requests.reduce(
      (acc, item) => {
        const estimated = toSafeNumber(item.estimatedPrice);
        const actual = toSafeNumber(item.actualPrice);
        if (estimated > 0) {
          acc.totalEstimated += estimated * item.quantity;
        }
        if (actual > 0 && ["送货中", "等待入库", "已入库"].includes(item.status)) {
          acc.totalSpent += actual * item.quantity;
        }
        if (actual > 0 && item.status === "已入库") {
          acc.warehouseValue += actual * item.quantity;
        }
        return acc;
      },
      { totalEstimated: 0, totalSpent: 0, warehouseValue: 0 },
    );
    return totals;
  }, [requests]);

  return (
    <Card>
      {contextHolder}
      <Typography.Title level={4}>采购管理</Typography.Title>
      {viewKey === "purchase" ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Text>待采购列表</Typography.Text>
          <Table
            rowKey="id"
            columns={purchaseColumns}
            dataSource={waitingList}
            pagination={{ pageSize: 6 }}
          />
          <Typography.Text>送货中列表</Typography.Text>
          <Table
            rowKey="id"
            columns={deliveryColumns}
            dataSource={deliveryList}
            pagination={{ pageSize: 6 }}
          />
          <Typography.Text>未入库列表</Typography.Text>
          <Table
            rowKey="id"
            columns={pendingColumns}
            dataSource={pendingInbound}
            pagination={{ pageSize: 6 }}
          />
        </Space>
      ) : (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Space>
            <Card>
              <Typography.Text>仓库总价值</Typography.Text>
              <Typography.Title level={4} style={{ margin: 0 }}>
                ￥{formatCurrency(procurementSummary.warehouseValue)}
              </Typography.Title>
            </Card>
            <Card>
              <Typography.Text>累计支出</Typography.Text>
              <Typography.Title level={4} style={{ margin: 0 }}>
                ￥{formatCurrency(procurementSummary.totalSpent)}
              </Typography.Title>
            </Card>
            <Card>
              <Typography.Text>采购总额</Typography.Text>
              <Typography.Title level={4} style={{ margin: 0 }}>
                ￥{formatCurrency(procurementSummary.totalEstimated)}
              </Typography.Title>
            </Card>
          </Space>
          <Space>
            <Button
              type="primary"
              onClick={() => {
                if (!canCreateRequest) {
                  messageApi.error("没有权限执行该操作");
                  return;
                }
                setOpenRequest(true);
              }}
              disabled={!canCreateRequest}
            >
              新建采购请求
            </Button>
          </Space>
          <Table
            rowKey="id"
            columns={requestColumns}
            dataSource={requests}
            pagination={{ pageSize: 8 }}
          />
        </Space>
      )}
      <Modal
        open={openRequest}
        title="新建采购请求"
        onCancel={() => {
          setOpenRequest(false);
          setImageFiles([]);
          form.resetFields();
        }}
        onOk={handleCreateRequest}
        okText="提交"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
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
            name="estimatedPrice"
            label="预计单价"
            rules={[
              { required: true, message: "请输入预计单价" },
              {
                validator: (_rule, value) => {
                  const price = Number(value);
                  if (Number.isFinite(price) && price > 0) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("预计单价必须大于0"));
                },
              },
            ]}
          >
            <Input type="number" min={0.01} step="0.01" placeholder="请输入预计单价" />
          </Form.Item>
          <Form.Item label="图片">
            <Upload
              listType="picture-card"
              fileList={imageFiles}
              maxCount={1}
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
      <Modal
        open={rejectOpen}
        title="驳回采购请求"
        onCancel={() => {
          setRejectOpen(false);
          setRejectTarget(null);
        }}
        onOk={handleReject}
        okText="确认驳回"
        cancelText="取消"
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="驳回原因"
            rules={[{ required: true, message: "请输入驳回原因" }]}
          >
            <Input.TextArea rows={4} placeholder="请输入驳回原因" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={priceOpen}
        title="核定采购价格"
        onCancel={() => {
          setPriceOpen(false);
          setPriceTarget(null);
        }}
        onOk={handleConfirmPrice}
        okText="确认"
        cancelText="取消"
      >
        <Form form={priceForm} layout="vertical">
          <Form.Item
            name="actualPrice"
            label="实际采购单价"
            rules={[
              { required: true, message: "请输入实际采购单价" },
              {
                validator: (_rule, value) => {
                  const price = Number(value);
                  if (Number.isFinite(price) && price > 0) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("实际采购单价必须大于0"));
                },
              },
            ]}
          >
            <Input type="number" min={0.01} step="0.01" placeholder="请输入实际采购单价" />
          </Form.Item>
          <Form.Item
            name="logisticsCompany"
            label="物流公司"
            rules={[{ required: true, message: "请输入物流公司" }]}
          >
            <Input placeholder="请输入物流公司" />
          </Form.Item>
          <Form.Item
            name="logisticsNumber"
            label="物流单号"
            rules={[{ required: true, message: "请输入物流单号" }]}
          >
            <Input placeholder="请输入物流单号" />
          </Form.Item>
          <Form.Item
            name="logisticsPhone"
            label="物流联系电话"
            rules={[
              {
                validator: (_rule, value) => {
                  if (!value) {
                    return Promise.resolve();
                  }
                  if (/^\d{6,20}$/.test(String(value))) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("物流联系电话格式不正确"));
                },
              },
            ]}
          >
            <Input placeholder="可选，输入 6-20 位数字" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={deliveryOpen}
        title="收货确认"
        onCancel={() => {
          setDeliveryOpen(false);
          setDeliveryTarget(null);
          setDeliveryFiles([]);
        }}
        onOk={handleConfirmDelivery}
        okText="确认收货"
        cancelText="取消"
      >
        <Form form={deliveryForm} layout="vertical">
          <Form.Item label="收货照片">
            <Upload
              accept="image/png,image/jpeg,image/webp"
              listType="picture-card"
              maxCount={1}
              fileList={deliveryFiles}
              beforeUpload={handleBeforeUpload}
              onChange={handleDeliveryImageChange}
              onRemove={() => {
                deliveryForm.setFieldsValue({ deliveryImageUrl: undefined });
                setDeliveryFiles([]);
                return true;
              }}
            >
              {deliveryFiles.length >= 1 ? null : "上传图片"}
            </Upload>
          </Form.Item>
          <Form.Item
            name="deliveryImageUrl"
            rules={[{ required: true, message: "请上传收货照片" }]}
            hidden
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={inboundOpen}
        title="新建入库单"
        onCancel={() => {
          setInboundOpen(false);
          setInboundTarget(null);
          inboundForm.resetFields();
          setInboundFiles([]);
        }}
        onOk={handleCreateInbound}
        okText="保存"
        cancelText="取消"
      >
        <Form form={inboundForm} layout="vertical">
          <Form.Item name="code" label="单号">
            <Input placeholder="留空自动生成" />
          </Form.Item>
          <Form.Item name="itemCode" label="物品编码">
            <Input disabled />
          </Form.Item>
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
            name="warehouse"
            label="仓库"
            rules={[{ required: true, message: "请选择仓库" }]}
          >
            <Select
              placeholder="选择仓库"
              options={warehouseOptions.map((item) => ({ label: item, value: item }))}
            />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Input
              placeholder="输入新仓库"
              value={newWarehouse}
              onChange={(event) => setNewWarehouse(event.target.value)}
            />
            <Button
              onClick={() =>
                addOption(newWarehouse, warehouseOptions, setWarehouseOptions, () =>
                  setNewWarehouse(""),
                )
              }
            >
              新建
            </Button>
          </Space>
          <Form.Item
            name="location"
            label="库位"
            rules={[{ required: true, message: "请选择库位" }]}
          >
            <Select
              placeholder="选择库位"
              options={locationOptions.map((item) => ({ label: item, value: item }))}
            />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Input
              placeholder="输入新库位"
              value={newLocation}
              onChange={(event) => setNewLocation(event.target.value)}
            />
            <Button
              onClick={() =>
                addOption(newLocation, locationOptions, setLocationOptions, () =>
                  setNewLocation(""),
                )
              }
            >
              新建
            </Button>
          </Space>
          <Form.Item
            name="category"
            label="类别"
            rules={[{ required: true, message: "请选择类别" }]}
          >
            <Select
              placeholder="选择类别"
              options={categoryOptions.map((item) => ({ label: item, value: item }))}
            />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Input
              placeholder="输入新类别"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
            />
            <Button
              onClick={() =>
                addOption(newCategory, categoryOptions, setCategoryOptions, () =>
                  setNewCategory(""),
                )
              }
            >
              新建
            </Button>
          </Space>
          <Form.Item
            name="supplier"
            label="供应商"
            rules={[{ required: true, message: "请选择供应商" }]}
          >
            <Select
              placeholder="选择供应商"
              options={supplierOptions.map((item) => ({ label: item, value: item }))}
            />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Input
              placeholder="输入新供应商"
              value={newSupplier}
              onChange={(event) => setNewSupplier(event.target.value)}
            />
            <Button
              onClick={() =>
                addOption(newSupplier, supplierOptions, setSupplierOptions, () =>
                  setNewSupplier(""),
                )
              }
            >
              新建
            </Button>
          </Space>
          <Form.Item label="收货图片">
            <Upload
              accept="image/png,image/jpeg,image/webp"
              listType="picture-card"
              maxCount={1}
              fileList={inboundFiles}
              beforeUpload={handleBeforeUpload}
              onChange={handleInboundImageChange}
              onRemove={() => {
                inboundForm.setFieldsValue({ imageUrl: undefined });
                setInboundFiles([]);
                return true;
              }}
            >
              {inboundFiles.length >= 1 ? null : "上传图片"}
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

export default Procurement;
