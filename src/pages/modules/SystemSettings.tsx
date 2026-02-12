import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Typography,
  Upload,
  message,
} from "antd";
import type { UploadFile } from "antd";
import type { UserInfo } from "../../types/runtime";
import {
  type BackupSettings,
  type PermissionRule,
  type RoleGroup,
  buildPermissionChecker,
  readBackupSettings,
  readPermissionRules,
  readRoleGroups,
  writeBackupSettings,
  writePermissionRules,
  writeRoleGroups,
} from "../../utils/storage";

type UserRow = {
  id: string;
  username: string;
  role: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  displayName?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  userCode?: string;
  recoveryBoundAt?: string;
};

type RoleRow = RoleGroup;

type AuditRow = {
  id: string;
  action: string;
  actor: string;
  createdAt: string;
};

type SystemSettingsProps = {
  activeKey?: string;
  currentUser?: UserInfo | null;
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getStatusLabel = (status: string) => {
  if (status === "ACTIVE") return "启用";
  if (status === "DISABLED") return "封禁";
  return status;
};

const getKeyStatusLabel = (value?: string) => (value ? "已绑定" : "未绑定");

const permissionOptions = [
  { value: "inbound", label: "入库" },
  { value: "outbound", label: "出库" },
  { value: "user:create", label: "新增用户" },
  { value: "user:delete", label: "删除用户" },
  { value: "user:disable", label: "封禁用户" },
  { value: "user:reset-password", label: "修改用户密码" },
  { value: "user:enable", label: "解封用户" },
  { value: "category:create", label: "新增类别" },
  { value: "category:delete", label: "删除类别" },
  { value: "location:create", label: "新增库位" },
  { value: "location:delete", label: "删除库位" },
  { value: "warehouse:create", label: "新增仓库" },
  { value: "warehouse:delete", label: "删除仓库" },
  { value: "supplier:create", label: "新增供应商" },
  { value: "supplier:delete", label: "删除供应商" },
  { value: "project:create", label: "新增项目" },
  { value: "project:delete", label: "删除项目" },
  { value: "procurement:create", label: "新增采购请求" },
  { value: "procurement:reject", label: "驳回采购" },
  { value: "procurement:purchase", label: "确认采购" },
  { value: "procurement:delivery", label: "收货确认" },
  { value: "procurement:inbound", label: "采购入库" },
  { value: "code:rule", label: "设定编号规则" },
  { value: "system:settings", label: "系统设置" },
];

type ChangePasswordWithOldValues = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type ChangePasswordWithRecoveryValues = {
  recoveryKey: string;
  newPassword: string;
  confirmPassword: string;
};

type RevealRecoveryValues = {
  password: string;
};

type CreateUserValues = {
  displayName: string;
  userCode?: string;
  role: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  password: string;
  confirmPassword: string;
};

type UpdateRoleValues = {
  role: string;
};

type ResetPasswordValues = {
  newPassword: string;
  confirmPassword: string;
};

type PermissionRuleValues = {
  name: string;
  roles: string[];
  permissions: string[];
};

type BackupItem = {
  id: string;
  createdAt: string;
  size: number;
};

type UpdateCheckInfo = {
  available: boolean;
  version?: string;
  releaseName?: string;
  releaseNotes?: string | string[] | Array<Record<string, unknown>>;
};

type MailSettingsValues = {
  user: string;
  pass: string;
  host: string;
  port: number;
  secure: boolean;
  testTo?: string;
};

const SystemSettings = ({ activeKey, currentUser }: SystemSettingsProps) => {
  const [messageApi, contextHolder] = message.useMessage();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [roles, setRoles] = useState<RoleRow[]>(readRoleGroups());
  const [auditLogs] = useState<AuditRow[]>([
    {
      id: "1",
      action: "登录系统",
      actor: "admin",
      createdAt: new Date().toLocaleString(),
    },
  ]);
  const [openUser, setOpenUser] = useState(false);
  const [openRole, setOpenRole] = useState(false);
  const [openUserRole, setOpenUserRole] = useState(false);
  const [openUserPassword, setOpenUserPassword] = useState(false);
  const [openUserRecovery, setOpenUserRecovery] = useState(false);
  const [openPassword, setOpenPassword] = useState(false);
  const [openRecoveryView, setOpenRecoveryView] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [savingUserPassword, setSavingUserPassword] = useState(false);
  const [recoveryKeyValue, setRecoveryKeyValue] = useState<string | null>(null);
  const [createdRecoveryKey, setCreatedRecoveryKey] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null);
  const [changing, setChanging] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [permissionRules, setPermissionRules] = useState<PermissionRule[]>(
    readPermissionRules(),
  );
  const [permissionTarget, setPermissionTarget] = useState<PermissionRule | null>(null);
  const [openPermission, setOpenPermission] = useState(false);
  const [backupItems, setBackupItems] = useState<BackupItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupSettings, setBackupSettings] = useState<BackupSettings>(readBackupSettings());
  const [backupSaving, setBackupSaving] = useState(false);
  const [backupRestoring, setBackupRestoring] = useState(false);
  const [backupUploading, setBackupUploading] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("—");
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [mailLoading, setMailLoading] = useState(false);
  const [mailSaving, setMailSaving] = useState(false);
  const [mailTesting, setMailTesting] = useState(false);
  const [userForm] = Form.useForm<CreateUserValues>();
  const [userRoleForm] = Form.useForm<UpdateRoleValues>();
  const [userPasswordForm] = Form.useForm<ResetPasswordValues>();
  const [permissionForm] = Form.useForm<PermissionRuleValues>();
  const [backupForm] = Form.useForm<BackupSettings>();
  const [mailForm] = Form.useForm<MailSettingsValues>();
  const [roleForm] = Form.useForm();
  const [oldPasswordForm] = Form.useForm<ChangePasswordWithOldValues>();
  const [recoveryResetForm] = Form.useForm<ChangePasswordWithRecoveryValues>();
  const [recoveryForm] = Form.useForm<RevealRecoveryValues>();
  const [avatarFiles, setAvatarFiles] = useState<UploadFile[]>([]);
  const autoBackupTimerRef = useRef<number | null>(null);

  const viewKey = activeKey ?? "company";

  const roleSelectOptions = useMemo(
    () => roles.map((role) => ({ label: role.name, value: role.name })),
    [roles],
  );

  const getRoleLabel = useCallback(
    (role: string) => roleSelectOptions.find((item) => item.value === role)?.label ?? role,
    [roleSelectOptions],
  );

  const permissionLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    permissionOptions.forEach((item) => map.set(item.value, item.label));
    return map;
  }, []);
  const { hasPermission } = useMemo(
    () => buildPermissionChecker(currentUser?.role, permissionRules),
    [currentUser?.role, permissionRules],
  );
  const canManageSystem = hasPermission("system:settings");
  const canCreateUser = hasPermission("user:create");
  const canDeleteUser = hasPermission("user:delete");
  const canDisableUser = hasPermission("user:disable");
  const canEnableUser = hasPermission("user:enable");
  const canResetUserPassword = hasPermission("user:reset-password");
  const loadUsers = useCallback(async () => {
    if (!window.api?.listUsers) {
      messageApi.error("当前环境不支持用户管理");
      return;
    }
    setLoadingUsers(true);
    const result = await window.api.listUsers();
    if (result.success && Array.isArray(result.users)) {
      setUsers(result.users as UserRow[]);
    } else {
      messageApi.error(result.message ?? "读取用户失败");
    }
    setLoadingUsers(false);
  }, [messageApi]);

  useEffect(() => {
    if (viewKey === "user") {
      loadUsers();
    }
  }, [loadUsers, viewKey]);

  useEffect(() => {
    if (viewKey === "backup") {
      backupForm.setFieldsValue(backupSettings);
    }
  }, [backupForm, backupSettings, viewKey]);

  const getNextUserCode = useCallback(() => {
    const maxValue = users.reduce((max, user) => {
      const match = user.userCode?.match(/^U-(\d+)$/);
      const value = match ? Number(match[1]) : 0;
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);
    return `U-${String(maxValue + 1).padStart(4, "0")}`;
  }, [users]);

  const buildLocalStorageSnapshot = useCallback(() => {
    const snapshot: Record<string, string> = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      snapshot[key] = localStorage.getItem(key) ?? "";
    }
    return snapshot;
  }, []);

  const loadBackups = useCallback(async () => {
    if (!window.api?.listBackups) {
      messageApi.error("当前环境不支持备份管理");
      return;
    }
    setLoadingBackups(true);
    const result = await window.api.listBackups();
    if (result.success && Array.isArray(result.items)) {
      setBackupItems(result.items as BackupItem[]);
    } else {
      messageApi.error(result.message ?? "读取备份失败");
    }
    setLoadingBackups(false);
  }, [messageApi]);

  const enforceBackupLimit = useCallback(
    async (items: BackupItem[]) => {
      if (!window.api?.deleteBackup) return;
      if (backupSettings.maxBackups <= 0) return;
      if (items.length <= backupSettings.maxBackups) return;
      const sorted = [...items].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      );
      const overflow = sorted.slice(0, items.length - backupSettings.maxBackups);
      for (const item of overflow) {
        await window.api.deleteBackup({ id: item.id });
      }
      loadBackups();
    },
    [backupSettings.maxBackups, loadBackups],
  );

  const createBackup = useCallback(async () => {
    if (!window.api?.createBackup) {
      messageApi.error("当前环境不支持备份管理");
      return;
    }
    const result = await window.api.createBackup({
      localStorage: buildLocalStorageSnapshot(),
    });
    if (result.success) {
      messageApi.success("备份完成");
      if (window.api?.listBackups) {
        const listResult = await window.api.listBackups();
        if (listResult.success && Array.isArray(listResult.items)) {
          setBackupItems(listResult.items as BackupItem[]);
          await enforceBackupLimit(listResult.items as BackupItem[]);
        } else {
          await loadBackups();
        }
      } else {
        await loadBackups();
      }
    } else {
      messageApi.error(result.message ?? "备份失败");
    }
  }, [buildLocalStorageSnapshot, enforceBackupLimit, loadBackups, messageApi]);

  const applyBackup = useCallback(
    async (backup: { localStorage: Record<string, string>; database?: string }) => {
      try {
        localStorage.clear();
        Object.entries(backup.localStorage || {}).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      } catch {
        messageApi.error("本地缓存恢复失败");
        return;
      }
      if (!window.api?.restoreDatabase) {
        messageApi.error("当前环境不支持数据库恢复");
        return;
      }
      setBackupRestoring(true);
      const result = await window.api.restoreDatabase({ database: backup.database });
      if (!result.success) {
        messageApi.error(result.message ?? "恢复失败");
      }
      setBackupRestoring(false);
    },
    [messageApi],
  );

  useEffect(() => {
    if (viewKey === "backup") {
      loadBackups();
    }
  }, [loadBackups, viewKey]);

  useEffect(() => {
    if (!backupSettings.enabled) {
      if (autoBackupTimerRef.current) {
        window.clearInterval(autoBackupTimerRef.current);
        autoBackupTimerRef.current = null;
      }
      return;
    }
    if (autoBackupTimerRef.current) {
      window.clearInterval(autoBackupTimerRef.current);
    }
    const intervalMs = Math.max(5, backupSettings.intervalMinutes) * 60 * 1000;
    autoBackupTimerRef.current = window.setInterval(() => {
      createBackup();
    }, intervalMs);
    return () => {
      if (autoBackupTimerRef.current) {
        window.clearInterval(autoBackupTimerRef.current);
        autoBackupTimerRef.current = null;
      }
    };
  }, [backupSettings.enabled, backupSettings.intervalMinutes, createBackup]);

  const loadCurrentVersion = useCallback(async () => {
    if (!window.api?.getAppVersion) {
      setCurrentVersion("未知");
      return;
    }
    const result = await window.api.getAppVersion();
    setCurrentVersion(result.version || "未知");
  }, []);

  const handleCheckUpdates = useCallback(async () => {
    if (!window.api?.checkForUpdates) {
      messageApi.error("当前环境不支持在线更新");
      return;
    }
    setCheckingUpdate(true);
    const result = await window.api.checkForUpdates();
    if (result.available) {
      setUpdateInfo(result as UpdateCheckInfo);
      messageApi.success("检测到可用更新");
    } else {
      setUpdateInfo({ available: false });
      messageApi.info("当前已是最新版本");
    }
    setCheckingUpdate(false);
  }, [messageApi]);

  const handleDownloadUpdate = useCallback(async () => {
    if (!window.api?.downloadUpdate) {
      messageApi.error("当前环境不支持在线更新");
      return;
    }
    setDownloadingUpdate(true);
    const result = await window.api.downloadUpdate();
    if (result.success) {
      messageApi.success(result.message ?? "已开始下载更新");
    } else {
      messageApi.error(result.message ?? "更新失败");
    }
    setDownloadingUpdate(false);
  }, [messageApi]);

  const loadMailSettings = useCallback(async () => {
    if (!window.api?.getMailSettings) {
      messageApi.error("当前环境不支持邮件设置");
      return;
    }
    setMailLoading(true);
    const result = await window.api.getMailSettings();
    if (result.success && result.settings) {
      mailForm.setFieldsValue({
        user: result.settings.user,
        pass: result.settings.pass,
        host: result.settings.host,
        port: result.settings.port,
        secure: result.settings.secure,
      });
    } else {
      messageApi.error(result.message ?? "读取邮件设置失败");
    }
    setMailLoading(false);
  }, [mailForm, messageApi]);

  const handleSaveMailSettings = useCallback(async () => {
    if (!window.api?.saveMailSettings) {
      messageApi.error("当前环境不支持邮件设置");
      return;
    }
    setMailSaving(true);
    try {
      const values = await mailForm.validateFields([
        "user",
        "pass",
        "host",
        "port",
        "secure",
      ]);
      const result = await window.api.saveMailSettings({
        user: values.user,
        pass: values.pass,
        host: values.host,
        port: Number(values.port),
        secure: Boolean(values.secure),
      });
      if (result.success) {
        messageApi.success(result.message ?? "邮件设置已保存");
      } else {
        messageApi.error(result.message ?? "保存失败");
      }
    } catch {
      messageApi.error("请检查邮件设置信息");
    } finally {
      setMailSaving(false);
    }
  }, [mailForm, messageApi]);

  const handleTestMail = useCallback(async () => {
    if (!window.api?.testMail) {
      messageApi.error("当前环境不支持邮件设置");
      return;
    }
    setMailTesting(true);
    try {
      const values = await mailForm.validateFields(["testTo"]);
      const result = await window.api.testMail({ to: values.testTo.trim() });
      if (result.success) {
        messageApi.success(result.message ?? "测试邮件已发送");
      } else {
        messageApi.error(result.message ?? "测试邮件发送失败");
      }
    } catch {
      messageApi.error("请输入测试收件邮箱");
    } finally {
      setMailTesting(false);
    }
  }, [mailForm, messageApi]);

  const updateNotes = useMemo(() => {
    if (!updateInfo?.releaseNotes) return [];
    const raw = updateInfo.releaseNotes;
    if (Array.isArray(raw)) {
      return raw
        .flatMap((item) => {
          if (typeof item === "string") return [item];
          if (item && typeof item === "object") {
            const note =
              (item as { note?: string; notes?: string }).note ??
              (item as { notes?: string }).notes;
            if (note) return [String(note)];
            if (typeof (item as { title?: string }).title === "string") {
              return [String((item as { title?: string }).title)];
            }
          }
          return [];
        })
        .map((text) => text.trim())
        .filter(Boolean);
    }
    if (typeof raw === "string") {
      return raw
        .split(/\r?\n/)
        .map((text) => text.trim())
        .filter(Boolean);
    }
    return [];
  }, [updateInfo]);

  useEffect(() => {
    if (viewKey === "update") {
      loadCurrentVersion();
      handleCheckUpdates();
    }
  }, [handleCheckUpdates, loadCurrentVersion, viewKey]);

  useEffect(() => {
    if (viewKey === "mail") {
      loadMailSettings();
    }
  }, [loadMailSettings, viewKey]);

  const handleAvatarChange = (info: { file: UploadFile; fileList: UploadFile[] }) => {
    setAvatarFiles(info.fileList.slice(-1));
    if (!info.file.originFileObj) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      userForm.setFieldsValue({ avatarUrl: typeof result === "string" ? result : undefined });
    };
    reader.readAsDataURL(info.file.originFileObj);
  };

  const openRoleModal = (record: UserRow) => {
    setRoleTarget(record);
    userRoleForm.setFieldsValue({ role: record.role });
    setOpenUserRole(true);
  };

  const openPasswordModal = (record: UserRow) => {
    setPasswordTarget(record);
    userPasswordForm.resetFields();
    setOpenUserPassword(true);
  };

  const handleToggleStatus = (record: UserRow) => {
    const nextStatus = record.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const canToggle = nextStatus === "DISABLED" ? canDisableUser : canEnableUser;
    if (!canToggle) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    Modal.confirm({
      title: nextStatus === "DISABLED" ? "确认封禁用户？" : "确认解封用户？",
      content: nextStatus === "DISABLED" ? "封禁后该用户无法登录。" : "解封后该用户可正常登录。",
      okText: nextStatus === "DISABLED" ? "确认封禁" : "确认解封",
      cancelText: "取消",
      okButtonProps: nextStatus === "DISABLED" ? { danger: true } : undefined,
      onOk: async () => {
        if (!window.api?.updateUserStatus) {
          messageApi.error("当前环境不支持用户管理");
          return;
        }
        const result = await window.api.updateUserStatus({
          userId: record.id,
          status: nextStatus,
        });
        if (result.success) {
          messageApi.success(result.message ?? "状态已更新");
          loadUsers();
        } else {
          messageApi.error(result.message ?? "状态更新失败");
        }
      },
    });
  };

  const handleDeleteUser = (record: UserRow) => {
    if (record.role === "ADMIN") {
      messageApi.error("管理员账号不可删除");
      return;
    }
    if (!canDeleteUser) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    Modal.confirm({
      title: "确认删除用户？",
      content: "删除后无法恢复，请谨慎操作。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!window.api?.deleteUser) {
          messageApi.error("当前环境不支持用户管理");
          return;
        }
        const result = await window.api.deleteUser({ userId: record.id });
        if (result.success) {
          messageApi.success(result.message ?? "用户已删除");
          loadUsers();
        } else {
          messageApi.error(result.message ?? "删除失败");
        }
      },
    });
  };

  const openPermissionModal = (rule?: PermissionRule) => {
    if (rule) {
      setPermissionTarget(rule);
      permissionForm.setFieldsValue({
        name: rule.name,
        roles: rule.roles ?? [],
        permissions: rule.permissions,
      });
    } else {
      setPermissionTarget(null);
      permissionForm.resetFields();
    }
    setOpenPermission(true);
  };

  const handleSavePermissionRule = async () => {
    if (!canManageSystem) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    const values = await permissionForm.validateFields();
    const trimmedName = values.name.trim();
    const exists = permissionRules.some(
      (rule) => rule.name === trimmedName && rule.id !== permissionTarget?.id,
    );
    if (exists) {
      messageApi.error("规则名称已存在");
      return;
    }
    const now = new Date().toLocaleString();
    const nextRules = permissionTarget
      ? permissionRules.map((rule) =>
          rule.id === permissionTarget.id
            ? {
                ...rule,
                name: trimmedName,
                roles: values.roles ?? [],
                permissions: values.permissions ?? [],
              }
            : rule,
        )
      : [
          ...permissionRules,
          {
            id: createId(),
            name: trimmedName,
            roles: values.roles ?? [],
            permissions: values.permissions ?? [],
            createdAt: now,
          },
        ];
    setPermissionRules(nextRules);
    writePermissionRules(nextRules);
    setOpenPermission(false);
    setPermissionTarget(null);
    permissionForm.resetFields();
    messageApi.success("权限规则已保存");
  };

  const handleDeletePermissionRule = (rule: PermissionRule) => {
    if (!canManageSystem) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    Modal.confirm({
      title: "确认删除权限规则？",
      content: "删除后无法恢复，请谨慎操作。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => {
        const nextRules = permissionRules.filter((item) => item.id !== rule.id);
        setPermissionRules(nextRules);
        writePermissionRules(nextRules);
        messageApi.success("权限规则已删除");
      },
    });
  };

  const handleSaveBackupSettings = async () => {
    const values = await backupForm.validateFields();
    const nextSettings: BackupSettings = {
      enabled: Boolean(values.enabled),
      intervalMinutes: Math.max(5, Number(values.intervalMinutes)),
      maxBackups: Math.max(1, Number(values.maxBackups)),
    };
    setBackupSaving(true);
    setBackupSettings(nextSettings);
    writeBackupSettings(nextSettings);
    setBackupSaving(false);
    messageApi.success("备份设置已保存");
  };

  const handleExportBackup = async (item: BackupItem) => {
    if (!window.api?.exportBackup) {
      messageApi.error("当前环境不支持导出备份");
      return;
    }
    const result = await window.api.exportBackup({ id: item.id });
    if (result.success) {
      messageApi.success("备份已导出");
    } else {
      messageApi.error(result.message ?? "导出失败");
    }
  };

  const handleRestoreBackup = (item: BackupItem) => {
    Modal.confirm({
      title: "确认恢复备份？",
      content: "恢复将覆盖当前数据并重启应用，请谨慎操作。",
      okText: "确认恢复",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!window.api?.readBackup) {
          messageApi.error("当前环境不支持备份管理");
          return;
        }
        const result = await window.api.readBackup({ id: item.id });
        if (result.success && result.backup) {
          await applyBackup(result.backup as { localStorage: Record<string, string>; database?: string });
        } else {
          messageApi.error(result.message ?? "读取备份失败");
        }
      },
    });
  };

  const handleDeleteBackup = (item: BackupItem) => {
    Modal.confirm({
      title: "确认删除备份？",
      content: "删除后无法恢复，请谨慎操作。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!window.api?.deleteBackup) {
          messageApi.error("当前环境不支持备份管理");
          return;
        }
        const result = await window.api.deleteBackup({ id: item.id });
        if (result.success) {
          messageApi.success("备份已删除");
          loadBackups();
        } else {
          messageApi.error(result.message ?? "删除失败");
        }
      },
    });
  };

  const handleUploadBackup = (file: UploadFile) => {
    if (!file.originFileObj) {
      messageApi.error("无法读取备份文件");
      return;
    }
    setBackupUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const raw = String(event.target?.result ?? "");
        const parsed = JSON.parse(raw) as {
          localStorage?: Record<string, string>;
          database?: string;
        };
        if (!parsed?.localStorage) {
          messageApi.error("备份文件格式不正确");
          return;
        }
        Modal.confirm({
          title: "确认恢复备份文件？",
          content: "恢复将覆盖当前数据并重启应用，请谨慎操作。",
          okText: "确认恢复",
          cancelText: "取消",
          okButtonProps: { danger: true },
          onOk: async () => {
            await applyBackup({
              localStorage: parsed.localStorage ?? {},
              database: parsed.database,
            });
          },
        });
      } catch {
        messageApi.error("备份文件解析失败");
      } finally {
        setBackupUploading(false);
      }
    };
    reader.onerror = () => {
      messageApi.error("备份文件读取失败");
      setBackupUploading(false);
    };
    reader.readAsText(file.originFileObj);
  };

  const userColumns = [
      {
        title: "头像",
        dataIndex: "avatarUrl",
        render: (value: string | undefined, record: UserRow) => (
          <Avatar src={value}>
            {(record.displayName ?? record.username ?? "").slice(0, 1)}
          </Avatar>
        ),
      },
      {
        title: "姓名",
        dataIndex: "displayName",
        render: (_: unknown, record: UserRow) => record.displayName ?? record.username,
      },
      {
        title: "编号",
        dataIndex: "userCode",
        render: (value?: string) => value ?? "—",
      },
      {
        title: "用户组",
        dataIndex: "role",
        render: (value: string) => getRoleLabel(value),
      },
      { title: "电话", dataIndex: "phone", render: (value?: string) => value ?? "—" },
      { title: "邮箱", dataIndex: "email", render: (value?: string) => value ?? "—" },
      {
        title: "密钥状态",
        dataIndex: "recoveryBoundAt",
        render: (value?: string) => getKeyStatusLabel(value),
      },
      {
        title: "状态",
        dataIndex: "status",
        render: (value: string) => getStatusLabel(value),
      },
      { title: "创建时间", dataIndex: "createdAt", render: (value?: string) => value ?? "—" },
      {
        title: "操作",
        dataIndex: "action",
        render: (_: unknown, record: UserRow) => (
          <Space>
            <Button
              type="link"
              onClick={() => openRoleModal(record)}
              disabled={!canManageSystem}
            >
              修改用户组
            </Button>
            <Button
              type="link"
              onClick={() => openPasswordModal(record)}
              disabled={!canResetUserPassword}
            >
              修改密码
            </Button>
            <Button
              onClick={() => handleToggleStatus(record)}
              disabled={record.status === "ACTIVE" ? !canDisableUser : !canEnableUser}
            >
              {record.status === "ACTIVE" ? "封禁" : "解封"}
            </Button>
            <Button
              danger
              onClick={() => handleDeleteUser(record)}
              disabled={!canDeleteUser || record.role === "ADMIN"}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ];

  const handleDeleteRole = useCallback((record: RoleRow) => {
    if (!canManageSystem) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    Modal.confirm({
      title: "确认删除用户组？",
      content: "删除后无法恢复，请谨慎操作。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => {
        const nextRoles = roles.filter((item) => item.id !== record.id);
        const nextRules = permissionRules.map((rule) => ({
          ...rule,
          roles: (rule.roles ?? []).filter((role) => role !== record.name),
        }));
        setRoles(nextRoles);
        setPermissionRules(nextRules);
        writeRoleGroups(nextRoles);
        writePermissionRules(nextRules);
        messageApi.success("用户组已删除");
      },
    });
  }, [canManageSystem, messageApi, permissionRules, roles]);

  const roleColumns = useMemo(
    () => [
      { title: "用户组名称", dataIndex: "name" },
      { title: "用户组描述", dataIndex: "description" },
      {
        title: "操作",
        dataIndex: "action",
        render: (_: unknown, record: RoleRow) => (
          <Space>
            <Button danger onClick={() => handleDeleteRole(record)} disabled={!canManageSystem}>
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [canManageSystem, handleDeleteRole],
  );

  const auditColumns = useMemo(
    () => [
      { title: "动作", dataIndex: "action" },
      { title: "操作人", dataIndex: "actor" },
      { title: "时间", dataIndex: "createdAt" },
    ],
    [],
  );

  const permissionColumns = [
    { title: "规则名称", dataIndex: "name" },
    {
      title: "绑定用户组",
      dataIndex: "roles",
      render: (value: string[]) => (value?.length ? value.join("、") : "—"),
    },
    {
      title: "权限项",
      dataIndex: "permissions",
      render: (value: string[]) =>
        value?.length
          ? value.map((item) => permissionLabelMap.get(item) ?? item).join("、")
          : "—",
    },
    { title: "创建时间", dataIndex: "createdAt" },
    {
      title: "操作",
      dataIndex: "action",
      render: (_: unknown, record: PermissionRule) => (
        <Space>
          <Button
            type="link"
            onClick={() => openPermissionModal(record)}
            disabled={!canManageSystem}
          >
            编辑
          </Button>
          <Button
            danger
            onClick={() => handleDeletePermissionRule(record)}
            disabled={!canManageSystem}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const backupColumns = [
    { title: "备份文件", dataIndex: "id" },
    { title: "创建时间", dataIndex: "createdAt" },
    {
      title: "大小",
      dataIndex: "size",
      render: (value: number) => `${(value / 1024).toFixed(2)} KB`,
    },
    {
      title: "操作",
      dataIndex: "action",
      render: (_: unknown, record: BackupItem) => (
        <Space>
          <Button onClick={() => handleRestoreBackup(record)} loading={backupRestoring}>
            恢复
          </Button>
          <Button onClick={() => handleExportBackup(record)}>下载</Button>
          <Button danger onClick={() => handleDeleteBackup(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const handleCreateUser = async () => {
    if (!canCreateUser) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    if (!window.api?.createUser) {
      messageApi.error("当前环境不支持用户管理");
      return;
    }
    setCreatingUser(true);
    try {
      const values = await userForm.validateFields();
      const result = await window.api.createUser({
        username: values.displayName.trim(),
        password: values.password,
        role: values.role,
        displayName: values.displayName.trim(),
        phone: values.phone?.trim(),
        email: values.email?.trim(),
        avatarUrl: values.avatarUrl,
      });
      if (result.success) {
        setOpenUser(false);
        userForm.resetFields();
        setAvatarFiles([]);
        setCreatedRecoveryKey(result.recoveryKey ?? null);
        setOpenUserRecovery(true);
        messageApi.success("用户已创建");
        loadUsers();
      } else {
        messageApi.error(result.message ?? "创建用户失败");
      }
    } catch {
      messageApi.error("请检查表单信息");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateRole = async () => {
    if (!canManageSystem) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    const values = await roleForm.validateFields();
    const trimmedName = values.name.trim();
    const exists = roles.some((role) => role.name === trimmedName);
    if (exists) {
      messageApi.error("用户组名称已存在");
      return;
    }
    const nextRoles = [
      ...roles,
      {
        id: createId(),
        name: trimmedName,
        description: values.description?.trim() || undefined,
        createdAt: new Date().toLocaleString(),
      },
    ];
    setRoles(nextRoles);
    writeRoleGroups(nextRoles);
    setOpenRole(false);
    roleForm.resetFields();
  };

  const handleSaveUserRole = async () => {
    if (!roleTarget) {
      setOpenUserRole(false);
      return;
    }
    if (!canManageSystem) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    if (!window.api?.updateUserRole) {
      messageApi.error("当前环境不支持用户管理");
      return;
    }
    setSavingRole(true);
    try {
      const values = await userRoleForm.validateFields();
      const result = await window.api.updateUserRole({
        userId: roleTarget.id,
        role: values.role,
      });
      if (result.success) {
        messageApi.success(result.message ?? "用户组已更新");
        setOpenUserRole(false);
        setRoleTarget(null);
        userRoleForm.resetFields();
        loadUsers();
      } else {
        messageApi.error(result.message ?? "用户组更新失败");
      }
    } finally {
      setSavingRole(false);
    }
  };

  const handleResetUserPassword = async () => {
    if (!canResetUserPassword) {
      messageApi.error("没有权限执行该操作");
      return;
    }
    if (!passwordTarget) {
      setOpenUserPassword(false);
      return;
    }
    if (!window.api?.resetUserPassword) {
      messageApi.error("当前环境不支持用户管理");
      return;
    }
    setSavingUserPassword(true);
    try {
      const values = await userPasswordForm.validateFields();
      const result = await window.api.resetUserPassword({
        userId: passwordTarget.id,
        newPassword: values.newPassword,
      });
      if (result.success) {
        messageApi.success(result.message ?? "密码已更新");
        setOpenUserPassword(false);
        setPasswordTarget(null);
        userPasswordForm.resetFields();
      } else {
        messageApi.error(result.message ?? "密码更新失败");
      }
    } finally {
      setSavingUserPassword(false);
    }
  };

  const handleCloseUserRecovery = () => {
    setOpenUserRecovery(false);
    setCreatedRecoveryKey(null);
  };

  const handleChangePasswordWithOld = async (
    values: ChangePasswordWithOldValues,
  ) => {
    if (!currentUser?.username) {
      messageApi.error("请先登录");
      return;
    }
    setChanging(true);
    const result = await window.api.changePassword({
      username: currentUser.username,
      oldPassword: values.oldPassword,
      newPassword: values.newPassword,
    });
    if (result.success) {
      messageApi.success("密码已更新");
      setOpenPassword(false);
      oldPasswordForm.resetFields();
      recoveryResetForm.resetFields();
    } else {
      messageApi.error(result.message);
    }
    setChanging(false);
  };

  const handleChangePasswordWithRecovery = async (
    values: ChangePasswordWithRecoveryValues,
  ) => {
    if (!currentUser?.username) {
      messageApi.error("请先登录");
      return;
    }
    setChanging(true);
    const result = await window.api.resetPasswordByKey({
      username: currentUser.username,
      recoveryKey: values.recoveryKey,
      newPassword: values.newPassword,
    });
    if (result.success) {
      messageApi.success("密码已更新");
      setOpenPassword(false);
      oldPasswordForm.resetFields();
      recoveryResetForm.resetFields();
    } else {
      messageApi.error(result.message);
    }
    setChanging(false);
  };

  const handleRevealRecoveryKey = async (values: RevealRecoveryValues) => {
    if (!currentUser?.username) {
      messageApi.error("请先登录");
      return;
    }
    setRevealing(true);
    const result = await window.api.revealRecoveryKey({
      username: currentUser.username,
      password: values.password,
    });
    if (result.success) {
      setRecoveryKeyValue(result.recoveryKey);
    } else {
      messageApi.error(result.message);
    }
    setRevealing(false);
  };

  const handleCloseRecoveryView = () => {
    setOpenRecoveryView(false);
    setRecoveryKeyValue(null);
    recoveryForm.resetFields();
  };
  return (
    <Card>
      <Typography.Title level={4}>系统设置</Typography.Title>
      {contextHolder}
      {viewKey === "user" ? (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              onClick={() => {
                userForm.resetFields();
                userForm.setFieldsValue({ userCode: getNextUserCode() });
                setAvatarFiles([]);
                setOpenUser(true);
              }}
              disabled={!canCreateUser}
            >
              新增用户
            </Button>
          </Space>
          <Table
            rowKey="id"
            columns={userColumns}
            dataSource={users}
            loading={loadingUsers}
            pagination={{ pageSize: 8 }}
          />
        </div>
      ) : viewKey === "permission" ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Text>用户组管理</Typography.Text>
          <Space>
            <Button
              type="primary"
              onClick={() => setOpenRole(true)}
              disabled={!canManageSystem}
            >
              新增用户组
            </Button>
          </Space>
          <Table rowKey="id" columns={roleColumns} dataSource={roles} pagination={{ pageSize: 8 }} />
          <Typography.Text>权限规则</Typography.Text>
          <Space>
            <Button
              type="primary"
              onClick={() => openPermissionModal()}
              disabled={!canManageSystem}
            >
              新增规则
            </Button>
          </Space>
          <Table
            rowKey="id"
            columns={permissionColumns}
            dataSource={permissionRules}
            pagination={{ pageSize: 8 }}
          />
        </Space>
      ) : viewKey === "audit" ? (
        <Table
          rowKey="id"
          columns={auditColumns}
          dataSource={auditLogs}
          pagination={{ pageSize: 8 }}
        />
      ) : viewKey === "backup" ? (
        <div>
          <Form form={backupForm} layout="inline" style={{ marginBottom: 16 }}>
            <Form.Item name="enabled" valuePropName="checked" label="自动备份">
              <Switch />
            </Form.Item>
            <Form.Item name="intervalMinutes" label="间隔（分钟）">
              <InputNumber min={5} max={1440} />
            </Form.Item>
            <Form.Item name="maxBackups" label="备份数量">
              <InputNumber min={1} max={200} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleSaveBackupSettings} loading={backupSaving}>
                保存设置
              </Button>
            </Form.Item>
          </Form>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" onClick={createBackup}>
              立即备份
            </Button>
            <Upload
              accept=".json"
              maxCount={1}
              showUploadList={false}
              beforeUpload={() => false}
              onChange={(info) => handleUploadBackup(info.file)}
            >
              <Button loading={backupUploading}>上传备份文件并恢复</Button>
            </Upload>
          </Space>
          <Table
            rowKey="id"
            columns={backupColumns}
            dataSource={backupItems}
            loading={loadingBackups}
            pagination={{ pageSize: 8 }}
          />
        </div>
      ) : viewKey === "mail" ? (
        <Form form={mailForm} layout="vertical" style={{ maxWidth: 520 }}>
          <Form.Item
            name="user"
            label="发件邮箱"
            rules={[
              { required: true, message: "请输入发件邮箱" },
              { type: "email", message: "发件邮箱格式不正确" },
            ]}
          >
            <Input placeholder="请输入发件邮箱" />
          </Form.Item>
          <Form.Item
            name="pass"
            label="SMTP 授权码"
            rules={[{ required: true, message: "请输入邮箱授权码" }]}
          >
            <Input.Password placeholder="请输入邮箱授权码" />
          </Form.Item>
          <Form.Item
            name="host"
            label="SMTP 服务器"
            rules={[{ required: true, message: "请输入 SMTP 服务器" }]}
          >
            <Input placeholder="例如：smtp.qq.com" />
          </Form.Item>
          <Form.Item
            name="port"
            label="SMTP 端口"
            rules={[{ required: true, message: "请输入 SMTP 端口" }]}
          >
            <InputNumber min={1} max={65535} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="secure" label="SSL 加密" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            name="testTo"
            label="测试收件邮箱"
            rules={[{ type: "email", message: "邮箱格式不正确" }]}
          >
            <Input placeholder="用于测试发送，可选" />
          </Form.Item>
          <Space>
            <Button type="primary" onClick={handleSaveMailSettings} loading={mailSaving}>
              保存设置
            </Button>
            <Button onClick={handleTestMail} loading={mailTesting} disabled={mailLoading}>
              发送测试邮件
            </Button>
          </Space>
        </Form>
      ) : viewKey === "update" ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Space>
            <Typography.Text>当前版本：{currentVersion}</Typography.Text>
            {updateInfo?.available ? (
              <Typography.Text type="warning">发现可用更新</Typography.Text>
            ) : (
              <Typography.Text type="success">已是最新版本</Typography.Text>
            )}
          </Space>
          <Space>
            <Button type="primary" onClick={handleCheckUpdates} loading={checkingUpdate}>
              检查更新
            </Button>
            <Button
              onClick={handleDownloadUpdate}
              disabled={!updateInfo?.available}
              loading={downloadingUpdate}
            >
              立即更新
            </Button>
          </Space>
          {updateInfo?.available ? (
            <Space direction="vertical" style={{ width: "100%" }}>
              <Typography.Text>
                可用版本：{updateInfo.version ?? "未知"}
              </Typography.Text>
              {updateInfo.releaseName ? (
                <Typography.Text>更新标题：{updateInfo.releaseName}</Typography.Text>
              ) : null}
              {updateNotes.length > 0 ? (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Typography.Text>更新内容：</Typography.Text>
                  {updateNotes.map((note, index) => (
                    <Typography.Text key={`${note}-${index}`}>• {note}</Typography.Text>
                  ))}
                </Space>
              ) : (
                <Typography.Text>更新内容：暂无</Typography.Text>
              )}
            </Space>
          ) : (
            <Typography.Text>当前已是最新版本</Typography.Text>
          )}
        </Space>
      ) : (
        <Form layout="vertical" style={{ maxWidth: 480 }}>
          <Form.Item label="公司名称" name="company">
            <Input placeholder="请输入公司名称" />
          </Form.Item>
          <Form.Item label="默认仓库" name="warehouse">
            <Input placeholder="请输入默认仓库" />
          </Form.Item>
          <Form.Item label="管理员邮箱" name="email">
            <Input placeholder="请输入管理员邮箱" />
          </Form.Item>
          <Space>
            <Button type="primary" onClick={() => messageApi.success("设置已保存")}>
              保存设置
            </Button>
            <Button onClick={() => messageApi.info("已重置")}>重置</Button>
            <Button onClick={() => setOpenPassword(true)} disabled={!currentUser}>
              修改密码
            </Button>
            <Button onClick={() => setOpenRecoveryView(true)} disabled={!currentUser}>
              查看恢复密钥
            </Button>
          </Space>
        </Form>
      )}
      <Modal
        open={openUser}
        title="新增用户"
        onCancel={() => setOpenUser(false)}
        onOk={handleCreateUser}
        confirmLoading={creatingUser}
        okText="保存"
        cancelText="取消"
      >
        <Form form={userForm} layout="vertical" requiredMark={false}>
          <Form.Item
            name="avatarUrl"
            label="上传头像"
          >
            <Upload
              accept="image/png,image/jpeg,image/webp"
              maxCount={1}
              beforeUpload={() => false}
              fileList={avatarFiles}
              onChange={handleAvatarChange}
            >
              <Button>选择图片</Button>
            </Upload>
          </Form.Item>
          <Form.Item
            name="displayName"
            label="姓名"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="userCode" label="编号">
            <Input placeholder="系统自动生成" disabled />
          </Form.Item>
          <Form.Item
            name="role"
            label="用户组"
            rules={[{ required: true, message: "请选择用户组" }]}
          >
            <Select options={roleSelectOptions} placeholder="请选择用户组" />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input placeholder="请输入电话" />
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
            name="password"
            label="密码"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 8, max: 32, message: "密码长度需为 8-32 个字符" },
              { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: "密码需包含字母和数字" },
            ]}
          >
            <Input.Password placeholder="请输入密码" />
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
        </Form>
      </Modal>
      <Modal
        open={openUserRole}
        title="修改用户组"
        onCancel={() => setOpenUserRole(false)}
        onOk={handleSaveUserRole}
        confirmLoading={savingRole}
        okText="保存"
        cancelText="取消"
      >
        <Form form={userRoleForm} layout="vertical" requiredMark={false}>
          <Form.Item
            name="role"
            label="用户组"
            rules={[{ required: true, message: "请选择用户组" }]}
          >
            <Select options={roleSelectOptions} placeholder="请选择用户组" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={openUserPassword}
        title="修改用户密码"
        onCancel={() => setOpenUserPassword(false)}
        onOk={handleResetUserPassword}
        confirmLoading={savingUserPassword}
        okText="保存"
        cancelText="取消"
      >
        <Form form={userPasswordForm} layout="vertical" requiredMark={false}>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 8, max: 32, message: "密码长度需为 8-32 个字符" },
              { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: "密码需包含字母和数字" },
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
        </Form>
      </Modal>
      <Modal
        open={openUserRecovery}
        title="请保存恢复密钥"
        onCancel={handleCloseUserRecovery}
        onOk={handleCloseUserRecovery}
        okText="已保存"
        cancelText="关闭"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Text>恢复密钥仅展示一次，请妥善保存。</Typography.Text>
          <Input readOnly value={createdRecoveryKey ?? ""} />
        </Space>
      </Modal>
      <Modal
        open={openPermission}
        title={permissionTarget ? "编辑权限规则" : "新增权限规则"}
        onCancel={() => setOpenPermission(false)}
        onOk={handleSavePermissionRule}
        okText="保存"
        cancelText="取消"
      >
        <Form form={permissionForm} layout="vertical" requiredMark={false}>
          <Form.Item
            name="name"
            label="规则名称"
            rules={[{ required: true, message: "请输入规则名称" }]}
          >
            <Input placeholder="请输入规则名称" />
          </Form.Item>
          <Form.Item
            name="roles"
            label="绑定用户组"
            rules={[{ required: true, message: "请选择用户组" }]}
          >
            <Select
              mode="multiple"
              options={roleSelectOptions}
              placeholder="请选择用户组"
            />
          </Form.Item>
          <Form.Item
            name="permissions"
            label="权限项"
            rules={[{ required: true, message: "请选择权限项" }]}
          >
            <Select
              mode="multiple"
              options={permissionOptions}
              placeholder="请选择权限项"
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={openRole}
        title="新增用户组"
        onCancel={() => setOpenRole(false)}
        onOk={handleCreateRole}
        okText="保存"
        cancelText="取消"
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item
            name="name"
            label="用户组名称"
            rules={[{ required: true, message: "请输入用户组名称" }]}
          >
            <Input placeholder="请输入用户组名称" />
          </Form.Item>
          <Form.Item name="description" label="用户组描述">
            <Input placeholder="请输入用户组描述" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="修改密码"
        open={openPassword}
        onCancel={() => setOpenPassword(false)}
        footer={null}
        destroyOnClose
      >
        <Tabs
          defaultActiveKey="old"
          items={[
            {
              key: "old",
              label: "使用旧密码",
              children: (
                <Form
                  layout="vertical"
                  form={oldPasswordForm}
                  onFinish={handleChangePasswordWithOld}
                  requiredMark={false}
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
                    <Button type="primary" htmlType="submit" block loading={changing}>
                      更新密码
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: "recovery",
              label: "使用恢复密钥",
              children: (
                <Form
                  layout="vertical"
                  form={recoveryResetForm}
                  onFinish={handleChangePasswordWithRecovery}
                  requiredMark={false}
                >
                  <Form.Item
                    name="recoveryKey"
                    label="恢复密钥"
                    rules={[{ required: true, message: "请输入恢复密钥" }]}
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
                    <Button type="primary" htmlType="submit" block loading={changing}>
                      更新密码
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Modal>
      <Modal
        title="查看恢复密钥"
        open={openRecoveryView}
        onCancel={handleCloseRecoveryView}
        footer={null}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Form
            layout="vertical"
            form={recoveryForm}
            onFinish={handleRevealRecoveryKey}
            requiredMark={false}
          >
            <Form.Item
              name="password"
              label="登录密码"
              rules={[{ required: true, message: "请输入登录密码" }]}
            >
              <Input.Password placeholder="请输入登录密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={revealing}>
                查看恢复密钥
              </Button>
            </Form.Item>
          </Form>
          {recoveryKeyValue ? <Input value={recoveryKeyValue} readOnly /> : null}
        </Space>
      </Modal>
    </Card>
  );
};


export default SystemSettings;
