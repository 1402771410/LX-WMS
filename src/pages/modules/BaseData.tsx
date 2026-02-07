import { useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import { Button, Card, Form, Input, Modal, Select, Space, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { PermissionRule, RuleSegment } from "../../utils/storage";
import {
  addBaseItem,
  buildPermissionChecker,
  generatePreviewCode,
  generateBaseCode,
  onStoreChange,
  readBaseList,
  readPermissionRules,
  readRuleOrder,
  removeBaseItem,
  writeRuleOrder,
} from "../../utils/storage";
import type { UserInfo } from "../../types/runtime";

type BaseRecord = {
  id: string;
  code: string;
  name: string;
  extra?: string;
  phone?: string;
  link?: string;
  address?: string;
};

type BaseTab = {
  key: string;
  label: string;
  codeLabel: string;
  nameLabel: string;
  extraLabel?: string;
};

type BaseDataProps = {
  activeKey?: string;
  currentUser?: UserInfo | null;
};

type BaseKind = "category" | "location" | "warehouse" | "supplier" | "project";

const tabs: BaseTab[] = [
  { key: "category", label: "库存类别管理", codeLabel: "类别编码", nameLabel: "类别名称", extraLabel: "父级类别" },
  { key: "location", label: "库位管理", codeLabel: "库位编码", nameLabel: "库位名称", extraLabel: "所属仓库" },
  { key: "warehouse", label: "仓库管理", codeLabel: "仓库编码", nameLabel: "仓库名称", extraLabel: "负责人" },
  { key: "supplier", label: "供应商管理", codeLabel: "供应商编码", nameLabel: "供应商名称", extraLabel: "联系人" },
  { key: "project", label: "项目管理", codeLabel: "项目编码", nameLabel: "项目名称", extraLabel: "上级项目" },
  { key: "code", label: "编号规则", codeLabel: "规则编码", nameLabel: "规则名称", extraLabel: "示例" },
];

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const segmentLabels: Record<RuleSegment, string> = {
  major: "大类",
  middle: "中类",
  minor: "小类",
  spec: "规格码",
  color: "颜色码",
  serial: "序列号",
};

const BaseData = ({ activeKey, currentUser }: BaseDataProps) => {
  const currentTab = activeKey ?? "category";
  const [dataMap, setDataMap] = useState<Record<string, BaseRecord[]>>({});
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<Omit<BaseRecord, "id">>();
  const [messageApi, contextHolder] = message.useMessage();
  const [keyword, setKeyword] = useState("");
  const [searchMode, setSearchMode] = useState<"exact" | "fuzzy">("fuzzy");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [ruleOrder, setRuleOrder] = useState<RuleSegment[]>(readRuleOrder());
  const [warehouseList, setWarehouseList] = useState<BaseRecord[]>(readBaseList("warehouse"));
  const [categoryList, setCategoryList] = useState<BaseRecord[]>(readBaseList("category"));
  const [projectList, setProjectList] = useState<BaseRecord[]>(readBaseList("project"));
  const [permissionRules, setPermissionRules] = useState<PermissionRule[]>(readPermissionRules());

  const tabConfig = useMemo(
    () => tabs.find((item) => item.key === currentTab) ?? tabs[0],
    [currentTab],
  );

  useEffect(() => {
    const sync = () => {
      if (currentTab === "code") return;
      const list = readBaseList(currentTab as "category" | "location" | "warehouse" | "supplier" | "project");
      setDataMap((prev) => ({ ...prev, [currentTab]: list }));
      setPermissionRules(readPermissionRules());
    };
    sync();
    return onStoreChange(sync);
  }, [currentTab]);

  useEffect(() => {
    const sync = () => {
      setWarehouseList(readBaseList("warehouse"));
      setCategoryList(readBaseList("category"));
      setProjectList(readBaseList("project"));
      setPermissionRules(readPermissionRules());
    };
    sync();
    return onStoreChange(sync);
  }, []);

  const dataSource = useMemo(
    () => dataMap[currentTab] ?? [],
    [currentTab, dataMap],
  );
  const filteredData = useMemo(() => {
    const value = keyword.trim();
    if (!value) return dataSource;
    const matcher = (text?: string) => {
      if (!text) return false;
      return searchMode === "exact" ? text === value : text.includes(value);
    };
    return dataSource.filter(
      (item) => matcher(item.code) || matcher(item.name) || matcher(item.extra),
    );
  }, [dataSource, keyword, searchMode]);

  const extraOptions = useMemo(() => {
    if (currentTab === "location") return warehouseList;
    if (currentTab === "category") return categoryList;
    if (currentTab === "project") return projectList;
    return [];
  }, [categoryList, currentTab, projectList, warehouseList]);

  const { hasPermission } = useMemo(
    () => buildPermissionChecker(currentUser?.role, permissionRules),
    [currentUser?.role, permissionRules],
  );
  const createPermissionMap: Record<BaseKind, string> = {
    category: "category:create",
    location: "location:create",
    warehouse: "warehouse:create",
    supplier: "supplier:create",
    project: "project:create",
  };
  const deletePermissionMap: Record<BaseKind, string> = {
    category: "category:delete",
    location: "location:delete",
    warehouse: "warehouse:delete",
    supplier: "supplier:delete",
    project: "project:delete",
  };
  const canEditRule = hasPermission("code:rule");
  const canCreate =
    currentTab === "code"
      ? canEditRule
      : hasPermission(createPermissionMap[currentTab as BaseKind]);
  const canDelete =
    currentTab === "code"
      ? canEditRule
      : hasPermission(deletePermissionMap[currentTab as BaseKind]);

  const handleCreate = () => {
    if (!canCreate) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    form.resetFields();
    if (currentTab !== "code") {
      form.setFieldsValue({ code: generateBaseCode(currentTab as BaseKind) });
    }
    setOpen(true);
  };

  const handleSave = async () => {
    if (!canCreate) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    if (currentTab === "code") {
      writeRuleOrder(ruleOrder);
      setOpen(false);
      return;
    }
    const values = await form.validateFields();
    const next = {
      id: createId(),
      ...values,
      code: values.code || generateBaseCode(currentTab as BaseKind),
    };
    addBaseItem(currentTab as BaseKind, next);
    setOpen(false);
  };

  const handleRemove = (id: string) => {
    if (!canDelete) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    Modal.confirm({
      title: "确认删除？",
      content: "删除后不可恢复。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => {
        removeBaseItem(currentTab as "category" | "location" | "warehouse" | "supplier" | "project", id);
        setDataMap((prev) => ({
          ...prev,
          [currentTab]: (prev[currentTab] ?? []).filter((item) => item.id !== id),
        }));
        setSelectedRowKeys((keys) => keys.filter((key) => key !== id));
      },
    });
  };

  const handleBatchRemove = () => {
    if (!canDelete) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    if (selectedRowKeys.length === 0) return;
    Modal.confirm({
      title: "确认批量删除？",
      content: "删除后不可恢复。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => {
        selectedRowKeys.forEach((id) =>
          removeBaseItem(
            currentTab as "category" | "location" | "warehouse" | "supplier" | "project",
            String(id),
          ),
        );
        setDataMap((prev) => ({
          ...prev,
          [currentTab]: (prev[currentTab] ?? []).filter(
            (item) => !selectedRowKeys.includes(item.id),
          ),
        }));
        setSelectedRowKeys([]);
      },
    });
  };

  const columns: ColumnsType<BaseRecord> =
    currentTab === "supplier"
      ? [
          { title: "供应商编码", dataIndex: "code" },
          { title: "供应商名称", dataIndex: "name" },
          { title: "联系人", dataIndex: "extra" },
          { title: "联系方式", dataIndex: "phone" },
          { title: "下单链接", dataIndex: "link" },
          { title: "收件地址", dataIndex: "address" },
          {
            title: "操作",
            dataIndex: "action",
            render: (_, record) => (
              <Button type="link" onClick={() => handleRemove(record.id)} disabled={!canDelete}>
                删除
              </Button>
            ),
          },
        ]
      : [
          { title: tabConfig.codeLabel, dataIndex: "code" },
          { title: tabConfig.nameLabel, dataIndex: "name" },
          ...(tabConfig.extraLabel ? [{ title: tabConfig.extraLabel, dataIndex: "extra" }] : []),
          {
            title: "操作",
            dataIndex: "action",
            render: (_, record) => (
              <Button type="link" onClick={() => handleRemove(record.id)} disabled={!canDelete}>
                删除
              </Button>
            ),
          },
        ];

  return (
    <Card>
      {contextHolder}
      <div>
        <Space style={{ marginBottom: 16 }}>
          {currentTab === "code" ? (
            <Button type="primary" onClick={handleCreate} disabled={!canCreate}>
              保存编号规则
            </Button>
          ) : (
            <>
              <Button type="primary" onClick={handleCreate} disabled={!canCreate}>
                新增{tabConfig.label.replace("管理", "")}
              </Button>
              <Button
                danger
                disabled={selectedRowKeys.length === 0 || !canDelete}
                onClick={handleBatchRemove}
              >
                批量删除
              </Button>
            </>
          )}
        </Space>
        {currentTab === "code" ? (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Space>
              <span>排列方式</span>
              <Select
                mode="multiple"
                value={ruleOrder}
                onChange={(values) => setRuleOrder(values as RuleSegment[])}
                options={Object.entries(segmentLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
                style={{ minWidth: 360 }}
                placeholder="选择编号规则顺序"
              />
            </Space>
            <div>示例：{generatePreviewCode("示例物料", "AX-100")}</div>
          </Space>
        ) : (
          <>
            <Space style={{ marginBottom: 16 }}>
              <Input
                placeholder="搜索编码/名称/父级"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                style={{ width: 240 }}
              />
              <Select
                value={searchMode}
                onChange={(value) => setSearchMode(value)}
                options={[
                  { label: "模糊搜索", value: "fuzzy" },
                  { label: "精准搜索", value: "exact" },
                ]}
                style={{ width: 120 }}
              />
            </Space>
            <Table
              rowKey="id"
              dataSource={filteredData}
              pagination={{ pageSize: 8 }}
              columns={columns}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
              }}
            />
          </>
        )}
      </div>
      <Modal
        open={open}
        title={currentTab === "code" ? "保存编号规则" : `新增${tabConfig.label.replace("管理", "")}`}
        onCancel={() => setOpen(false)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
      >
        {currentTab === "code" ? (
          <Space direction="vertical" style={{ width: "100%" }}>
            <div>已选择：{ruleOrder.map((item) => segmentLabels[item]).join(" - ")}</div>
          </Space>
        ) : (
          <Form form={form} layout="vertical">
            <Form.Item
              label={tabConfig.codeLabel}
              name="code"
              rules={[{ required: true, message: `请输入${tabConfig.codeLabel}` }]}
            >
              <Input placeholder="系统自动生成" disabled />
            </Form.Item>
            <Form.Item
              label={tabConfig.nameLabel}
              name="name"
              rules={[{ required: true, message: `请输入${tabConfig.nameLabel}` }]}
            >
              <Input placeholder={`请输入${tabConfig.nameLabel}`} />
            </Form.Item>
            {tabConfig.extraLabel ? (
              <Form.Item label={tabConfig.extraLabel} name="extra">
                {currentTab === "category" || currentTab === "location" || currentTab === "project" ? (
                  <Select
                    placeholder={`选择${tabConfig.extraLabel}`}
                    allowClear
                    options={extraOptions.map((item) => ({
                      label: item.name,
                      value: item.name,
                    }))}
                  />
                ) : (
                  <Input placeholder={`请输入${tabConfig.extraLabel}`} />
                )}
              </Form.Item>
            ) : null}
            {currentTab === "supplier" ? (
              <>
                <Form.Item label="联系方式" name="phone">
                  <Input placeholder="请输入联系方式" />
                </Form.Item>
                <Form.Item label="下单链接" name="link">
                  <Input placeholder="请输入下单链接" />
                </Form.Item>
                <Form.Item label="收件地址" name="address">
                  <Input placeholder="请输入收件地址" />
                </Form.Item>
              </>
            ) : null}
          </Form>
        )}
      </Modal>
    </Card>
  );
};

export default BaseData;
