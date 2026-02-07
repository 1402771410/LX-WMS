import { useState } from "react";
import { Button, Card, Form, Input, Modal, Space, Typography, message } from "antd";
import logo from "../assets/logo.png";

type SetupAdminProps = {
  onRegistered: () => void;
};

type FormValues = {
  username: string;
  email: string;
  emailCode: string;
  password: string;
  confirmPassword: string;
};

const SetupAdmin = ({ onRegistered }: SetupAdminProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<FormValues>();
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const [openRecovery, setOpenRecovery] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const result = await window.api.registerAdmin({
      username: values.username,
      email: values.email,
      emailCode: values.emailCode,
      password: values.password,
    });
    if (result.success) {
      setRecoveryKey(result.recoveryKey);
      setRecoveryUserId(result.user.id);
      setOpenRecovery(true);
    } else {
      messageApi.error(result.message);
    }
    setSubmitting(false);
  };

  const handleSendCode = async () => {
    if (!window.api?.sendAdminEmailCode) {
      messageApi.error("当前环境不支持邮箱验证");
      return;
    }
    try {
      setSendingCode(true);
      const values = await form.validateFields(["username", "email"]);
      const result = await window.api.sendAdminEmailCode({
        username: values.username,
        email: values.email,
      });
      if (result.success) {
        messageApi.success("验证码已发送");
      } else {
        messageApi.error(result.message);
      }
    } finally {
      setSendingCode(false);
    }
  };

  const handleConfirmRecovery = async () => {
    if (!recoveryKey || !recoveryUserId) {
      messageApi.error("恢复密钥未生成，请重试");
      return;
    }
    setConfirming(true);
    const result = await window.api.confirmRecoveryKey({
      userId: recoveryUserId,
      recoveryKey,
    });
    if (result.success) {
      messageApi.success("恢复密钥已绑定，请登录系统");
      setOpenRecovery(false);
      setRecoveryKey(null);
      setRecoveryUserId(null);
      onRegistered();
    } else {
      messageApi.error(result.message);
    }
    setConfirming(false);
  };

  const handleCopyKey = async () => {
    if (!recoveryKey) {
      return;
    }
    try {
      await navigator.clipboard.writeText(recoveryKey);
      messageApi.success("恢复密钥已复制");
    } catch {
      messageApi.error("复制失败，请手动保存");
    }
  };

  return (
    <div className="auth-page">
      {contextHolder}
      <Card className="auth-card">
        <div className="auth-header">
          <img className="auth-logo" src={logo} alt="LX-WMS" />
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              初始化管理员
            </Typography.Title>
            <Typography.Text type="secondary">
              首次使用请创建管理员账号
            </Typography.Text>
          </div>
        </div>
        <Form
          layout="vertical"
          form={form}
          onFinish={handleSubmit}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label="管理员账号"
            rules={[
              { required: true, message: "请输入管理员账号" },
              { min: 2, max: 32, message: "账号长度需为 2-32 个字符" },
              { pattern: /^\S+$/, message: "账号不能包含空格" },
            ]}
          >
            <Input placeholder="请输入管理员账号" autoFocus />
          </Form.Item>
          <Form.Item
            name="email"
            label="管理员邮箱"
            rules={[
              { required: true, message: "请输入管理员邮箱" },
              { type: "email", message: "邮箱格式不正确" },
            ]}
          >
            <Input placeholder="请输入管理员邮箱" />
          </Form.Item>
          <Form.Item
            name="emailCode"
            label="邮箱验证码"
            rules={[{ required: true, message: "请输入邮箱验证码" }]}
          >
            <Input
              placeholder="请输入邮箱验证码"
              addonAfter={
                <Button type="link" onClick={handleSendCode} loading={sendingCode}>
                  发送验证码
                </Button>
              }
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="管理员密码"
            rules={[
              { required: true, message: "请输入管理员密码" },
              { min: 8, max: 32, message: "密码长度需为 8-32 个字符" },
              {
                pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
                message: "密码需包含字母和数字",
              },
            ]}
          >
            <Input.Password placeholder="请输入管理员密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={["password"]}
            rules={[
              { required: true, message: "请再次输入密码" },
              ({ getFieldValue }) => ({
                validator: (_, value) => {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入密码" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
            >
              创建管理员
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <Modal
        title="请保存恢复密钥"
        open={openRecovery}
        onCancel={() => setOpenRecovery(false)}
        footer={
          <Space>
            <Button onClick={handleCopyKey}>复制恢复密钥</Button>
            <Button type="primary" onClick={handleConfirmRecovery} loading={confirming}>
              我已保存
            </Button>
          </Space>
        }
        maskClosable={false}
        closable={false}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Text>
            请务必保存此恢复密钥，忘记密码时仅凭该密钥可重置。
          </Typography.Text>
          <Input value={recoveryKey ?? ""} readOnly />
        </Space>
      </Modal>
    </div>
  );
};

export default SetupAdmin;
