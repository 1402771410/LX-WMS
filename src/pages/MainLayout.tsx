import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Space,
  Tabs,
  Upload,
  Typography,
  message,
} from "antd";
import {
  AppstoreOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import type { UploadFile } from "antd";
import BaseData from "./modules/BaseData.tsx";
import type { UserInfo } from "../types/runtime";
import Dashboard from "./modules/Dashboard";
import Outbound from "./modules/Outbound";
import Inventory from "./modules/Inventory";
import Reports from "./modules/Reports";
import SystemSettings from "./modules/SystemSettings";
import Procurement from "./modules/Procurement.tsx";
import Inbound from "./modules/Inbound";
import logo from "../assets/logo.png";
import { buildPermissionChecker, onStoreChange, readPermissionRules } from "../utils/storage";
const { Sider, Content, Header } = Layout;

type MainLayoutProps = {
  currentUser: UserInfo | null;
  onLogout: () => void;
  onUpdateProfile: (nextUser: UserInfo) => void;
};

const menuItems: MenuProps["items"] = [
  { key: "dashboard", label: "仪表盘", icon: <AppstoreOutlined /> },
  {
    key: "inventory",
    label: "库存管理",
    icon: <DatabaseOutlined />,
    children: [
      { key: "inventory:list", label: "库存列表" },
      { key: "inventory:inbound", label: "入库管理" },
      { key: "inventory:outbound", label: "出库管理" },
      { key: "inventory:category", label: "库存类别" },
      { key: "inventory:location", label: "库位管理" },
      { key: "inventory:warehouse", label: "仓库管理" },
      { key: "inventory:supplier", label: "供应商" },
      { key: "inventory:project", label: "项目管理" },
    ],
  },
  {
    key: "procurement",
    label: "采购管理",
    icon: <ShoppingCartOutlined />,
    children: [
      { key: "procurement:finance", label: "财务管理" },
      { key: "procurement:purchase", label: "商品采购" },
      { key: "procurement:code", label: "编号规则" },
    ],
  },
  {
    key: "user",
    label: "用户管理",
    icon: <TeamOutlined />,
    children: [
      { key: "user:list", label: "用户列表" },
      { key: "user:permission", label: "用户权限" },
    ],
  },
  {
    key: "reports",
    label: "报表管理",
    icon: <BarChartOutlined />,
    children: [
      { key: "reports:purchase", label: "采购报表" },
      { key: "reports:outbound", label: "出库报表" },
      { key: "reports:inbound", label: "入库报表" },
      { key: "reports:project", label: "项目消耗" },
      { key: "reports:aging", label: "库龄报表" },
    ],
  },
  {
    key: "system",
    label: "系统设置",
    icon: <SettingOutlined />,
    children: [
      { key: "system:backup", label: "备份恢复" },
      { key: "system:mail", label: "邮件设置" },
      { key: "system:update", label: "在线更新" },
    ],
  },
];

const defaultKey = "dashboard";
const rootSubmenuKeys = ["inventory", "procurement", "user", "reports", "system"];

type ProfileValues = {
  displayName?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
};

type PasswordValues = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const MainLayout = ({ currentUser, onLogout, onUpdateProfile }: MainLayoutProps) => {
  const [activeKey, setActiveKey] = useState(defaultKey);
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [permissionRules, setPermissionRules] = useState(readPermissionRules());
  const [profileForm] = Form.useForm<ProfileValues>();
  const [passwordForm] = Form.useForm<PasswordValues>();
  const avatarUrl = Form.useWatch("avatarUrl", profileForm);
  const displayAvatar = avatarUrl || currentUser?.avatarUrl;
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [mailConfigured, setMailConfigured] = useState(true);
  const [adminEmailVerified, setAdminEmailVerified] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");

  const [groupKey, childKey] = activeKey.split(":");

  const displayName = currentUser?.displayName || currentUser?.username || "用户";

  const refreshCompliance = useCallback(async () => {
    if (!currentUser || currentUser.role !== "ADMIN") {
      setComplianceOpen(false);
      return;
    }
    if (!window.api?.getMailStatus || !window.api?.getAdminEmailStatus) {
      setComplianceOpen(false);
      return;
    }
    setComplianceLoading(true);
    try {
      const mailResult = await window.api.getMailStatus();
      const adminResult = await window.api.getAdminEmailStatus({
        userId: currentUser.id,
        username: currentUser.username,
      });
      const nextMailConfigured = mailResult.success ? Boolean(mailResult.configured) : true;
      const nextAdminVerified = adminResult.success ? Boolean(adminResult.verified) : true;
      setMailConfigured(nextMailConfigured);
      setAdminEmailVerified(nextAdminVerified);
      setAdminEmail(adminResult.success ? adminResult.email ?? "" : "");
      setComplianceOpen(
        activeKey !== "system:mail" && (!nextMailConfigured || !nextAdminVerified),
      );
    } catch {
      messageApi.error("读取邮箱配置状态失败");
      setComplianceOpen(false);
    } finally {
      setComplianceLoading(false);
    }
  }, [activeKey, currentUser, messageApi]);

  useEffect(() => {
    const sync = () => {
      setPermissionRules(readPermissionRules());
    };
    sync();
    return onStoreChange(sync);
  }, []);

  useEffect(() => {
    void refreshCompliance();
  }, [refreshCompliance]);

  const { hasPermission } = useMemo(
    () => buildPermissionChecker(currentUser?.role, permissionRules),
    [currentUser?.role, permissionRules],
  );
  const hasAnyPermission = useCallback(
    (permissions: string[]) =>
      permissions.some((permission) => hasPermission(permission)),
    [hasPermission],
  );
  const canAccessKey = useCallback((key: string) => {
    if (key === "dashboard") return true;
    if (key === "inventory:list") {
      return hasPermission("inbound") || hasPermission("outbound");
    }
    if (key === "inventory:inbound") return hasPermission("inbound");
    if (key === "inventory:outbound") return hasPermission("outbound");
    if (key === "inventory:category") {
      return hasAnyPermission(["category:create", "category:delete"]);
    }
    if (key === "inventory:location") {
      return hasAnyPermission(["location:create", "location:delete"]);
    }
    if (key === "inventory:warehouse") {
      return hasAnyPermission(["warehouse:create", "warehouse:delete"]);
    }
    if (key === "inventory:supplier") {
      return hasAnyPermission(["supplier:create", "supplier:delete"]);
    }
    if (key === "inventory:project") {
      return hasAnyPermission(["project:create", "project:delete"]);
    }
    if (key === "procurement:finance") {
      return hasAnyPermission([
        "procurement:create",
        "procurement:reject",
        "procurement:purchase",
        "procurement:delivery",
        "procurement:inbound",
      ]);
    }
    if (key === "procurement:purchase") {
      return hasAnyPermission([
        "procurement:create",
        "procurement:reject",
        "procurement:purchase",
        "procurement:delivery",
        "procurement:inbound",
      ]);
    }
    if (key === "procurement:code") return hasPermission("code:rule");
    if (key === "user:list") {
      return hasPermission("system:settings") ||
        hasAnyPermission([
          "user:create",
          "user:delete",
          "user:disable",
          "user:reset-password",
          "user:enable",
        ]);
    }
    if (key === "user:permission") return hasPermission("system:settings");
    if (key === "reports:purchase") {
      return hasAnyPermission([
        "procurement:create",
        "procurement:reject",
        "procurement:purchase",
        "procurement:delivery",
        "procurement:inbound",
      ]);
    }
    if (key === "reports:outbound") return hasPermission("outbound");
    if (key === "reports:inbound") return hasPermission("inbound");
    if (key === "reports:project") return hasPermission("outbound");
    if (key === "reports:aging") {
      return hasPermission("inbound") || hasPermission("outbound");
    }
    if (key === "system:backup") return hasPermission("system:settings");
    if (key === "system:mail") return hasPermission("system:settings");
    if (key === "system:update") return hasPermission("system:settings");
    return false;
  }, [hasAnyPermission, hasPermission]);

  const visibleMenuItems = useMemo(() => {
    const filterItems = (items: MenuProps["items"]): MenuProps["items"] =>
      (items ?? [])
        .map((item) => {
          if (!item) return null;
          if ("children" in item && item.children?.length) {
            const children = filterItems(item.children);
            if (!children?.length) return null;
            return { ...item, children };
          }
          if ("key" in item && typeof item.key === "string") {
            return canAccessKey(item.key) ? item : null;
          }
          return item;
        })
        .filter(Boolean) as MenuProps["items"];
    return filterItems(menuItems);
  }, [canAccessKey]);

  const allowedKeys = useMemo(() => {
    const keys: string[] = [];
    const collect = (items: MenuProps["items"]) => {
      (items ?? []).forEach((item) => {
        if (!item) return;
        if ("children" in item && item.children?.length) {
          collect(item.children);
        } else if ("key" in item && typeof item.key === "string") {
          keys.push(item.key);
        }
      });
    };
    collect(visibleMenuItems);
    return keys;
  }, [visibleMenuItems]);

  useEffect(() => {
    if (!allowedKeys.includes(activeKey)) {
      setActiveKey(allowedKeys[0] ?? defaultKey);
    }
  }, [activeKey, allowedKeys]);

  const confirmLogout = () => {
    Modal.confirm({
      title: "确认退出登录？",
      content: "退出后需要重新登录。",
      okText: "确认退出",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: onLogout,
    });
  };

  const confirmClearCache = () => {
    Modal.confirm({
      title: "确认清理缓存？",
      content: "将清除本地缓存并退出登录。",
      okText: "确认清理",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {
          messageApi.error("缓存清理失败，请稍后重试");
          return;
        }
        messageApi.success("缓存已清理");
        onLogout();
      },
    });
  };

  const openProfile = () => {
    if (!currentUser) {
      messageApi.error("请先登录");
      return;
    }
    profileForm.setFieldsValue({
      displayName: currentUser.displayName ?? "",
      phone: currentUser.phone ?? "",
      email: currentUser.email ?? "",
      avatarUrl: currentUser.avatarUrl ?? "",
    });
    setProfileOpen(true);
  };

  const handleProfileAvatarChange = (info: { file: UploadFile }) => {
    if (!info.file.originFileObj) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      profileForm.setFieldsValue({ avatarUrl: typeof result === "string" ? result : undefined });
    };
    reader.readAsDataURL(info.file.originFileObj);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) {
      messageApi.error("请先登录");
      return;
    }
    setProfileSaving(true);
    try {
      const values = await profileForm.validateFields();
      const nextUser: UserInfo = { ...currentUser, ...values };
      onUpdateProfile(nextUser);
      messageApi.success("个人资料已更新");
      setProfileOpen(false);
    } catch {
      return;
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (values: PasswordValues) => {
    if (!currentUser?.username) {
      messageApi.error("请先登录");
      return;
    }
    setPasswordSaving(true);
    try {
      const result = await window.api.changePassword({
        username: currentUser.username,
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      if (result.success) {
        messageApi.success("密码已更新");
        passwordForm.resetFields();
      } else {
        messageApi.error(result.message);
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleNavigate = useCallback(
    (key: string) => {
      if (!canAccessKey(key)) {
        messageApi.error("没有权限访问该功能");
        return;
      }
      setActiveKey(key);
      const [nextGroupKey] = key.split(":");
      if (rootSubmenuKeys.includes(nextGroupKey)) {
        setOpenKeys([nextGroupKey]);
      } else {
        setOpenKeys([]);
      }
    },
    [canAccessKey, messageApi],
  );

  const dropdownItems: MenuProps["items"] = [
    { key: "profile", label: "个人资料" },
    { key: "clear-cache", label: "清理缓存" },
    { key: "logout", label: "退出登录", danger: true },
  ];

  const contentNode = useMemo(() => {
    if (!canAccessKey(activeKey)) {
      return (
        <Card>
          <Typography.Text>没有权限访问该功能</Typography.Text>
        </Card>
      );
    }
    if (activeKey === "dashboard") return <Dashboard onNavigate={handleNavigate} />;
    if (groupKey === "inventory") {
      if (childKey === "list") return <Inventory key={activeKey} activeKey="list" currentUser={currentUser} />;
      if (childKey === "inbound") return <Inbound key={activeKey} currentUser={currentUser} />;
      if (childKey === "outbound") return <Outbound key={activeKey} currentUser={currentUser} />;
      if (
        ["category", "location", "warehouse", "supplier", "project"].includes(childKey ?? "")
      ) {
        return <BaseData key={activeKey} activeKey={childKey} currentUser={currentUser} />;
      }
      return <Inventory key={activeKey} activeKey={childKey} currentUser={currentUser} />;
    }
    if (groupKey === "procurement") {
      if (childKey === "code")
        return <BaseData key={activeKey} activeKey="code" currentUser={currentUser} />;
      return <Procurement key={activeKey} activeKey={childKey} currentUser={currentUser} />;
    }
    if (groupKey === "user") {
      const sysKey = childKey === "permission" ? "permission" : "user";
      return <SystemSettings key={activeKey} activeKey={sysKey} currentUser={currentUser} />;
    }
    if (groupKey === "reports") return <Reports key={activeKey} activeKey={childKey} />;
    if (groupKey === "system")
      return (
        <SystemSettings
          key={activeKey}
          activeKey={childKey}
          currentUser={currentUser}
        />
      );
    return <Dashboard onNavigate={handleNavigate} />;
  }, [activeKey, childKey, currentUser, groupKey, canAccessKey, handleNavigate]);

  return (
    <Layout className="main-layout">
      {contextHolder}
      <Sider
        width={240}
        theme="light"
        collapsible
        collapsed={collapsed}
        onCollapse={(v) => {
          setCollapsed(v);
          if (v) {
            setOpenKeys([]);
          }
        }}
        style={{ borderRight: "1px solid #e5e5e5" }}
      >
        <div className="logo-area" style={{ color: "#1f1f1f" }}>
          <img src={logo} alt="LX-WMS" />
          {!collapsed && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span>LX-WMS</span>
              {currentUser ? (
                <span style={{ fontSize: 12, color: "#8c8c8c" }}>
                  {displayName}
                </span>
              ) : null}
            </div>
          )}
        </div>
        <Menu
          items={visibleMenuItems}
          selectedKeys={[activeKey]}
          onClick={(info) => {
            setActiveKey(info.key);
            const [nextGroupKey] = info.key.split(":");
            if (rootSubmenuKeys.includes(nextGroupKey)) {
              setOpenKeys([nextGroupKey]);
            }
          }}
          openKeys={openKeys}
          onOpenChange={(keys) => {
            const latestOpenKey = keys.find((key) => !openKeys.includes(key));
            if (latestOpenKey && rootSubmenuKeys.includes(latestOpenKey)) {
              setOpenKeys([latestOpenKey]);
              return;
            }
            setOpenKeys(keys);
          }}
          mode="inline"
          theme="light"
          style={{ borderInline: 0 }}
        />
      </Sider>
      <Layout>
        <Header className="main-header">
          <Typography.Text>欢迎使用 LX-WMS</Typography.Text>
          <Dropdown
            menu={{
              items: dropdownItems,
              onClick: (info) => {
                if (info.key === "profile") {
                  openProfile();
                } else if (info.key === "clear-cache") {
                  confirmClearCache();
                } else if (info.key === "logout") {
                  confirmLogout();
                }
              },
            }}
            trigger={["click"]}
          >
            <Button type="text">
              <Space>
                <Avatar src={displayAvatar} icon={<UserOutlined />} />
                <span>{displayName}</span>
              </Space>
            </Button>
          </Dropdown>
        </Header>
        <Content className="main-content">{contentNode}</Content>
      </Layout>
      <Modal
        title="请先完成管理员邮箱配置"
        open={complianceOpen}
        closable={false}
        maskClosable={false}
        footer={
          <Button
            type="primary"
            loading={complianceLoading}
            onClick={() => {
              if (!canAccessKey("system:mail")) {
                messageApi.error("没有权限访问邮件设置");
                return;
              }
              setComplianceOpen(false);
              handleNavigate("system:mail");
            }}
          >
            去设置
          </Button>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {!mailConfigured ? (
            <Typography.Text>请先完成邮件设置，否则无法验证管理员邮箱。</Typography.Text>
          ) : null}
          {mailConfigured && !adminEmailVerified ? (
            <Typography.Text>
              请在邮件设置中绑定并验证管理员邮箱。
              {adminEmail ? `当前邮箱：${adminEmail}` : ""}
            </Typography.Text>
          ) : null}
        </Space>
      </Modal>
      <Modal
        title="个人资料"
        open={profileOpen}
        onCancel={() => setProfileOpen(false)}
        onOk={handleSaveProfile}
        okText="保存"
        cancelText="取消"
        confirmLoading={profileSaving}
        destroyOnClose
      >
        <Tabs
          defaultActiveKey="basic"
          items={[
            {
              key: "basic",
              label: "基本信息",
              children: (
                <Form form={profileForm} layout="vertical" requiredMark={false}>
                  <Form.Item name="avatarUrl" label="头像上传">
                    <Upload
                      accept="image/png,image/jpeg,image/webp"
                      maxCount={1}
                      beforeUpload={() => false}
                      onChange={handleProfileAvatarChange}
                    >
                      <Button>选择图片</Button>
                    </Upload>
                  </Form.Item>
                  <Form.Item name="displayName" label="姓名">
                    <Input placeholder="请输入姓名" />
                  </Form.Item>
                  <Form.Item
                    name="phone"
                    label="电话"
                    rules={[
                      { pattern: /^\d{6,20}$/, message: "请输入 6-20 位数字" },
                    ]}
                  >
                    <Input placeholder="请输入电话号码" />
                  </Form.Item>
                  <Form.Item
                    name="email"
                    label="邮箱"
                    rules={[{ type: "email", message: "请输入有效邮箱" }]}
                  >
                    <Input placeholder="请输入邮箱" />
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: "password",
              label: "修改密码",
              children: (
                <Form
                  form={passwordForm}
                  layout="vertical"
                  requiredMark={false}
                  onFinish={handleChangePassword}
                >
                  <Form.Item
                    name="oldPassword"
                    label="旧密码"
                    rules={[{ required: true, message: "请输入旧密码" }]}
                  >
                    <Input.Password placeholder="请输入旧密码" />
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
                      loading={passwordSaving}
                    >
                      更新密码
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Modal>
    </Layout>
  );
};

export default MainLayout;
