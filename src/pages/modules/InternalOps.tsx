import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Table,
} from "antd";

type InternalRecord = {
  id: string;
  code: string;
  type: string;
  status: string;
  createdAt: string;
};

type InternalOpsProps = {
  activeKey?: string;
};

type InternalType = "move" | "freeze" | "loss";

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const InternalOps = ({ activeKey }: InternalOpsProps) => {
  const normalizeType = (value?: string): InternalType =>
    value === "freeze" || value === "loss" || value === "move" ? value : "move";
  const [activeType, setActiveType] = useState<InternalType>(normalizeType(activeKey));
  const [records, setRecords] = useState<InternalRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const columns = useMemo(
    () => [
      { title: "单号", dataIndex: "code" },
      { title: "类型", dataIndex: "type" },
      { title: "状态", dataIndex: "status" },
      { title: "创建时间", dataIndex: "createdAt" },
    ],
    [],
  );

  const handleCreate = async () => {
    const values = await form.validateFields();
    const typeLabel =
      activeType === "move"
        ? "移库"
        : activeType === "freeze"
          ? "冻结/解冻"
          : "报损报溢";
    setRecords((prev) => [
      ...prev,
      {
        id: createId(),
        code: values.code,
        type: typeLabel,
        status: "待处理",
        createdAt: new Date().toLocaleString(),
      },
    ]);
    setOpen(false);
    form.resetFields();
  };

  const openModal = (type: InternalType) => {
    setActiveType(type);
    form.resetFields();
    setOpen(true);
  };
  return (
    <div>
      <Card>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Button type="primary" onClick={() => openModal("move")}>
                新建移库单
              </Button>
            </Space>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={records.filter((item) => item.type === "移库")}
              pagination={{ pageSize: 8 }}
            />
          </div>
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Button type="primary" onClick={() => openModal("freeze")}>
                新建冻结/解冻单
              </Button>
            </Space>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={records.filter((item) => item.type === "冻结/解冻")}
              pagination={{ pageSize: 8 }}
            />
          </div>
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Button type="primary" onClick={() => openModal("loss")}>
                新建报损报溢单
              </Button>
            </Space>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={records.filter((item) => item.type === "报损报溢")}
              pagination={{ pageSize: 8 }}
            />
          </div>
        </Space>
        <Modal
          open={open}
          title="新建库内作业"
          onCancel={() => setOpen(false)}
          onOk={handleCreate}
          okText="保存"
          cancelText="取消"
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="code"
              label="单号"
              rules={[{ required: true, message: "请输入单号" }]}
            >
              <Input placeholder="请输入单号" />
            </Form.Item>
            <Form.Item name="remark" label="备注">
              <Input placeholder="请输入备注" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default InternalOps;
