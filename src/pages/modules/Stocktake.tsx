import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Upload,
  message,
} from "antd";
import type { UploadFile } from "antd";

type StocktakeTask = {
  id: string;
  code: string;
  area: string;
  status: string;
  createdAt: string;
};

type StocktakeDiff = {
  id: string;
  code: string;
  item: string;
  diffQty: number;
  status: string;
};

type StocktakeProps = {
  activeKey?: string;
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const Stocktake = (_props: StocktakeProps) => {
  void _props;
  const [tasks, setTasks] = useState<StocktakeTask[]>([]);
  const [diffs, setDiffs] = useState<StocktakeDiff[]>([]);
  const [openTask, setOpenTask] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [form] = Form.useForm();
  const [uploadList, setUploadList] = useState<UploadFile[]>([]);
  const [messageApi, contextHolder] = message.useMessage();

  const taskColumns = useMemo(
    () => [
      { title: "单号", dataIndex: "code" },
      { title: "库区", dataIndex: "area" },
      { title: "状态", dataIndex: "status" },
      { title: "创建时间", dataIndex: "createdAt" },
    ],
    [],
  );

  const diffColumns = useMemo(
    () => [
      { title: "差异单号", dataIndex: "code" },
      { title: "物料", dataIndex: "item" },
      { title: "差异数量", dataIndex: "diffQty" },
      { title: "状态", dataIndex: "status" },
    ],
    [],
  );

  const handleCreateTask = async () => {
    const values = await form.validateFields();
    setTasks((prev) => [
      ...prev,
      {
        id: createId(),
        code: values.code,
        area: values.area,
        status: "进行中",
        createdAt: new Date().toLocaleString(),
      },
    ]);
    setOpenTask(false);
    form.resetFields();
  };

  const handleImport = () => {
    if (uploadList.length === 0) {
      messageApi.error("请先选择导入文件");
      return;
    }
    setDiffs((prev) => [
      ...prev,
      {
        id: createId(),
        code: `DIF-${Date.now()}`,
        item: "导入物料",
        diffQty: 5,
        status: "待确认",
      },
    ]);
    setUploadList([]);
    setOpenImport(false);
    messageApi.success("盘点结果已导入");
  };
  return (
    <Card>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" onClick={() => setOpenTask(true)}>
              新建盘点任务
            </Button>
            <Button onClick={() => setOpenImport(true)}>导入盘点结果</Button>
          </Space>
          <Table
            rowKey="id"
            columns={taskColumns}
            dataSource={tasks}
            pagination={{ pageSize: 8 }}
          />
        </div>
        <div>
          <Table
            rowKey="id"
            columns={diffColumns}
            dataSource={diffs}
            pagination={{ pageSize: 8 }}
          />
        </div>
      </Space>
      <Modal
        open={openTask}
        title="新建盘点任务"
        onCancel={() => setOpenTask(false)}
        onOk={handleCreateTask}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="任务单号"
            rules={[{ required: true, message: "请输入任务单号" }]}
          >
            <Input placeholder="请输入任务单号" />
          </Form.Item>
          <Form.Item
            name="area"
            label="库区"
            rules={[{ required: true, message: "请输入库区" }]}
          >
            <Input placeholder="请输入库区" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={openImport}
        title="导入盘点结果"
        onCancel={() => setOpenImport(false)}
        onOk={handleImport}
        okText="导入"
        cancelText="取消"
      >
        <Upload
          fileList={uploadList}
          beforeUpload={() => false}
          onChange={(info) => setUploadList(info.fileList)}
        >
          <Button>选择文件</Button>
        </Upload>
      </Modal>
    </Card>
  );
};


export default Stocktake;
