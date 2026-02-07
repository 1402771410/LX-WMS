import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Tabs,
  Typography,
  message,
} from "antd";
import type { UserInfo } from "../types/runtime";
import logo from "../assets/logo.png";

type LoginProps = {
  onLoginSuccess: (user: UserInfo) => void;
};

type FormValues = {
  username: string;
  password: string;
};

type ResetFormValues = {
  username: string;
  recoveryKey: string;
  newPassword: string;
  confirmPassword: string;
};

type EmailResetValues = {
  username: string;
  email: string;
  emailCode: string;
  newPassword: string;
  confirmPassword: string;
};

const Login = ({ onLoginSuccess }: LoginProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [openReset, setOpenReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetForm] = Form.useForm<ResetFormValues>();
  const [emailResetForm] = Form.useForm<EmailResetValues>();
  const [emailResetting, setEmailResetting] = useState(false);
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [recoveryCheckStatus, setRecoveryCheckStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [recoveryCheckMessage, setRecoveryCheckMessage] = useState<string>("");
  const resetUsername = Form.useWatch("username", resetForm);
  const resetRecoveryKey = Form.useWatch("recoveryKey", resetForm);

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const result = await window.api.login(values);
    if (result.success) {
      messageApi.success("登录成功");
      onLoginSuccess(result.user);
    } else {
      messageApi.error(result.message);
    }
    setSubmitting(false);
  };

  const handleResetPassword = async (values: ResetFormValues) => {
    setResetting(true);
    const result = await window.api.resetPasswordByKey({
      username: values.username,
      recoveryKey: values.recoveryKey,
      newPassword: values.newPassword,
    });
    if (result.success) {
      messageApi.success("密码已重置，请使用新密码登录");
      setOpenReset(false);
      resetForm.resetFields();
    } else {
      messageApi.error(result.message);
    }
    setResetting(false);
  };

  const handleSendEmailCode = async () => {
    if (!window.api?.sendResetEmailCode) {
      messageApi.error("当前环境不支持邮箱重置");
      return;
    }
    try {
      setSendingEmailCode(true);
      const values = await emailResetForm.validateFields(["username", "email"]);
      const result = await window.api.sendResetEmailCode({
        username: values.username,
        email: values.email,
      });
      if (result.success) {
        messageApi.success("验证码已发送");
      } else {
        messageApi.error(result.message);
      }
    } finally {
      setSendingEmailCode(false);
    }
  };

  const handleResetByEmail = async (values: EmailResetValues) => {
    if (!window.api?.resetPasswordByEmail) {
      messageApi.error("当前环境不支持邮箱重置");
      return;
    }
    setEmailResetting(true);
    const result = await window.api.resetPasswordByEmail({
      username: values.username,
      email: values.email,
      emailCode: values.emailCode,
      newPassword: values.newPassword,
    });
    if (result.success) {
      messageApi.success("密码已重置，请使用新密码登录");
      setOpenReset(false);
      emailResetForm.resetFields();
    } else {
      messageApi.error(result.message);
    }
    setEmailResetting(false);
  };

  useEffect(() => {
    if (!resetUsername || !resetRecoveryKey) {
      setRecoveryCheckStatus("idle");
      setRecoveryCheckMessage("");
      return;
    }
    let active = true;
    setRecoveryCheckStatus("checking");
    setRecoveryCheckMessage("正在校验恢复密钥...");
    const timer = setTimeout(async () => {
      const result = await window.api.validateRecoveryKey({
        username: resetUsername,
        recoveryKey: resetRecoveryKey,
      });
      if (!active) {
        return;
      }
      if (result.success) {
        setRecoveryCheckStatus("valid");
        setRecoveryCheckMessage("恢复密钥正确");
      } else {
        setRecoveryCheckStatus("invalid");
        setRecoveryCheckMessage(result.message);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [resetRecoveryKey, resetUsername]);

  return (
    <div className="auth-page">
      {contextHolder}
      <Card className="auth-card">
        <div className="auth-header">
          <img className="auth-logo" src={logo} alt="LX-WMS" />
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              LX-WMS
            </Typography.Title>
            <Typography.Text type="secondary">
              请使用管理员账号登录
            </Typography.Text>
          </div>
        </div>
        <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="username"
            label="账号"
            rules={[{ required: true, message: "请输入账号" }]}
          >
            <Input placeholder="请输入账号" autoFocus />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
            >
              登录
            </Button>
          </Form.Item>
          <Form.Item>
            <Button type="link" block onClick={() => setOpenReset(true)}>
              找回密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <Modal
        title="找回密码"
        open={openReset}
        onCancel={() => setOpenReset(false)}
        footer={null}
        destroyOnClose
      >
        <Tabs
          defaultActiveKey="recovery"
          items={[
            {
              key: "recovery",
              label: "恢复密钥重置",
              children: (
                <Form
                  layout="vertical"
                  form={resetForm}
                  onFinish={handleResetPassword}
                  requiredMark={false}
                >
                  <Form.Item
                    name="username"
                    label="账号"
                    rules={[
                      { required: true, message: "请输入账号" },
                      { min: 2, max: 32, message: "账号长度需为 2-32 个字符" },
                      { pattern: /^\S+$/, message: "账号不能包含空格" },
                    ]}
                  >
                    <Input placeholder="请输入账号" />
                  </Form.Item>
                  <Form.Item
                    name="recoveryKey"
                    label="恢复密钥"
                    rules={[{ required: true, message: "请输入恢复密钥" }]}
                    validateStatus={
                      recoveryCheckStatus === "invalid"
                        ? "error"
                        : recoveryCheckStatus === "valid"
                          ? "success"
                          : undefined
                    }
                    help={recoveryCheckStatus === "idle" ? "" : recoveryCheckMessage}
                  >
                    <Input placeholder="请输入恢复密钥" />
                  </Form.Item>
                  <Form.Item
                    name="newPassword"
                    label="新密码"
                    rules={[
                      { required: true, message: "请输入新密码" },
                      { min: 8, max: 32, message: "密码长度需为 8-32 个字符" },
                      {
                        pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
                        message: "密码需包含字母和数字",
                      },
                    ]}
                  >
                    <Input.Password placeholder="请输入新密码" />
                  </Form.Item>
                  <Form.Item
                    name="confirmPassword"
                    label="确认新密码"
                    dependencies={["newPassword"]}
                    rules={[
                      { required: true, message: "请再次输入新密码" },
                      ({ getFieldValue }) => ({
                        validator: (_, value) => {
                          if (!value || getFieldValue("newPassword") === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error("两次输入的密码不一致"));
                        },
                      }),
                    ]}
                  >
                    <Input.Password placeholder="请再次输入新密码" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={resetting}>
                      重置密码
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: "email",
              label: "邮箱重置",
              children: (
                <Form
                  layout="vertical"
                  form={emailResetForm}
                  onFinish={handleResetByEmail}
                  requiredMark={false}
                >
                  <Form.Item
                    name="username"
                    label="账号"
                    rules={[
                      { required: true, message: "请输入账号" },
                      { min: 2, max: 32, message: "账号长度需为 2-32 个字符" },
                      { pattern: /^\S+$/, message: "账号不能包含空格" },
                    ]}
                  >
                    <Input placeholder="请输入账号" />
                  </Form.Item>
                  <Form.Item
                    name="email"
                    label="邮箱"
                    rules={[
                      { required: true, message: "请输入邮箱" },
                      { type: "email", message: "邮箱格式不正确" },
                    ]}
                  >
                    <Input placeholder="请输入邮箱" />
                  </Form.Item>
                  <Form.Item
                    name="emailCode"
                    label="邮箱验证码"
                    rules={[{ required: true, message: "请输入邮箱验证码" }]}
                  >
                    <Input
                      placeholder="请输入邮箱验证码"
                      addonAfter={
                        <Button
                          type="link"
                          onClick={handleSendEmailCode}
                          loading={sendingEmailCode}
                        >
                          发送验证码
                        </Button>
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    name="newPassword"
                    label="新密码"
                    rules={[
                      { required: true, message: "请输入新密码" },
                      { min: 8, max: 32, message: "密码长度需为 8-32 个字符" },
                      {
                        pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
                        message: "密码需包含字母和数字",
                      },
                    ]}
                  >
                    <Input.Password placeholder="请输入新密码" />
                  </Form.Item>
                  <Form.Item
                    name="confirmPassword"
                    label="确认新密码"
                    dependencies={["newPassword"]}
                    rules={[
                      { required: true, message: "请再次输入新密码" },
                      ({ getFieldValue }) => ({
                        validator: (_, value) => {
                          if (!value || getFieldValue("newPassword") === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error("两次输入的密码不一致"));
                        },
                      }),
                    ]}
                  >
                    <Input.Password placeholder="请再次输入新密码" />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      block
                      loading={emailResetting}
                    >
                      重置密码
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default Login;
