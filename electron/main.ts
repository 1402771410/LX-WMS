import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import nodemailer from "nodemailer";
import { validateMailSettings } from "./mail.js";
import { applyMigrations, createDatabase, initializeDatabase } from "./db.js";
import {
  changePasswordWithOldPassword,
  confirmRecoveryKeyBinding,
  createUser,
  createEmailCode,
  hasAdminUser,
  login,
  listUsers,
  registerAdmin,
  removeUser,
  resetPasswordByEmailCode,
  resetUserPassword,
  resetPasswordByRecoveryKey,
  saveEmailCode,
  validateRecoveryKey,
  verifyEmailCodeSendInterval,
  verifyEmailCode,
  revealRecoveryKey,
  updateUserRole,
  updateUserStatus,
  markEmailCodeSent,
  updateProfile,
  type UpdateProfilePayload,
} from "./auth.js";
import { checkForUpdates, setupAutoUpdater } from "./updater.js";

type AuthPayload = {
  username: string;
  password: string;
};

type RegisterAdminPayload = {
  username: string;
  password: string;
  email?: string;
  emailCode?: string;
};

type RecoveryConfirmPayload = {
  userId: string;
  recoveryKey: string;
};

type ResetByKeyPayload = {
  username: string;
  recoveryKey: string;
  newPassword: string;
};

type ResetByEmailPayload = {
  username: string;
  email: string;
  emailCode: string;
  newPassword: string;
};

type EmailCodePayload = {
  username: string;
  email: string;
};

type ExternalLinkPayload = {
  url: string;
};

type AdminEmailPayload = {
  userId: string;
  username: string;
  email: string;
};

type AdminEmailVerifyPayload = {
  userId: string;
  username: string;
  email: string;
  emailCode: string;
};

type ChangePasswordPayload = {
  username: string;
  oldPassword: string;
  newPassword: string;
};

type CreateUserPayload = {
  username: string;
  password: string;
  role: string;
  displayName?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
};

type UpdateUserRolePayload = {
  userId: string;
  role: string;
};

type UpdateUserStatusPayload = {
  userId: string;
  status: string;
};

type ResetUserPasswordPayload = {
  userId: string;
  newPassword: string;
};

type DeleteUserPayload = {
  userId: string;
};

type BackupCreatePayload = {
  localStorage: Record<string, string>;
};

type BackupReadPayload = {
  id: string;
};

type BackupRestorePayload = {
  database?: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const appRoot = isDev ? process.cwd() : app.getAppPath();

let mainWindow: BrowserWindow | null = null;
const databasePath = path.join(app.getPath("userData"), "lx-wms.db");
const db = createDatabase(databasePath);

initializeDatabase(db);
const migrationsPath = path.join(appRoot, "electron", "migrations");
applyMigrations(db, migrationsPath);

const normalizeInput = (value: string): string => value.trim();
const normalizeRecoveryKey = (value: string): string =>
  value.trim().toUpperCase();

const DEFAULT_SMTP_SETTINGS: Record<string, string> = {
  smtp_host: "smtp.qq.com",
  smtp_port: "465",
  smtp_secure: "true",
};

const readAppSetting = (key: string): string | null => {
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
};

const getMailSetting = (key: string): string | null => {
  const fromDb = readAppSetting(key);
  if (fromDb) {
    return fromDb;
  }
  const envKey = `LX_WMS_${key.toUpperCase()}`;
  const fromEnv = process.env[envKey];
  if (fromEnv) {
    return fromEnv;
  }
  return DEFAULT_SMTP_SETTINGS[key] ?? null;
};

const getMailerConfig = (): {
  ok: true;
  user: string;
  pass: string;
  host: string;
  port: number;
  secure: boolean;
} | { ok: false; message: string } => {
  const user = getMailSetting("smtp_user") ?? "";
  const pass = getMailSetting("smtp_pass") ?? "";
  const host = getMailSetting("smtp_host") ?? "smtp.qq.com";
  const portRaw = getMailSetting("smtp_port") ?? "465";
  const secureRaw = getMailSetting("smtp_secure") ?? "true";
  const result = validateMailSettings({
    user,
    pass,
    host,
    port: portRaw,
    secure: secureRaw,
  });
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, ...result.settings };
};

const isMailConfigured = (): boolean => {
  const result = getMailerConfig();
  return result.ok;
};

const writeAppSetting = (key: string, value: string): void => {
  db.prepare(
    `
      INSERT INTO app_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
  ).run(key, value);
};

const getAdminEmailStatus = (
  userId: string,
): { email: string; verified: boolean } => {
  const row = db
    .prepare("SELECT email FROM users WHERE id = ?")
    .get(userId) as { email?: string } | undefined;
  const email = row?.email?.trim() ?? "";
  const verifiedEmail = (readAppSetting("admin_email_verified") ?? "")
    .trim()
    .toLowerCase();
  const verified =
    !!email && !!verifiedEmail && email.trim().toLowerCase() === verifiedEmail;
  return { email, verified };
};

const getMailSettingsSnapshot = (): {
  user: string;
  pass: string;
  host: string;
  port: number;
  secure: boolean;
} => {
  const user = getMailSetting("smtp_user") ?? "";
  const pass = getMailSetting("smtp_pass") ?? "";
  const host = getMailSetting("smtp_host") ?? "smtp.qq.com";
  const portRaw = getMailSetting("smtp_port") ?? "465";
  const secureRaw = getMailSetting("smtp_secure") ?? "true";
  return {
    user,
    pass,
    host,
    port: Number(portRaw),
    secure: secureRaw === "true",
  };
};

const sendMail = async (
  to: string,
  subject: string,
  text: string,
): Promise<{ success: boolean; message?: string }> => {
  const config = getMailerConfig();
  if (!config.ok) {
    return { success: false, message: config.message };
  }
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
  try {
    await transporter.sendMail({
      from: `LX-WMS <${config.user}>`,
      to,
      subject,
      text,
    });
    return { success: true };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "邮件发送失败";
    return { success: false, message: messageText };
  }
};

const validateUsername = (username: string): string | null => {
  if (username.length < 2 || username.length > 32) {
    return "用户名长度需为 2-32 个字符";
  }
  if (/\s/.test(username)) {
    return "用户名不能包含空格";
  }
  return null;
};

const validatePassword = (password: string): string | null => {
  if (password.length < 8 || password.length > 32) {
    return "密码长度需为 8-32 个字符";
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "密码需包含字母和数字";
  }
  return null;
};

const validateEmail = (email: string): string | null => {
  if (!email) return null;
  const normalized = email.trim();
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  return ok ? null : "邮箱格式不正确";
};

const validatePhone = (phone: string): string | null => {
  if (!phone) return null;
  const normalized = phone.trim();
  const ok = /^\d{6,20}$/.test(normalized);
  return ok ? null : "电话需为 6-20 位数字";
};

const backupDir = path.join(app.getPath("userData"), "backups");
const ensureBackupDir = () => {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
};

const listBackupFiles = (): { id: string; createdAt: string; size: number }[] => {
  ensureBackupDir();
  const files = fs.readdirSync(backupDir).filter((file) => file.endsWith(".json"));
  return files
    .map((file) => {
      const fullPath = path.join(backupDir, file);
      const stat = fs.statSync(fullPath);
      let createdAt = stat.mtime.toISOString();
      try {
        const raw = fs.readFileSync(fullPath, "utf-8");
        const parsed = JSON.parse(raw) as { createdAt?: string };
        if (parsed?.createdAt) {
          createdAt = parsed.createdAt;
        }
      } catch {
        return null;
      }
      return { id: file, createdAt, size: stat.size };
    })
    .filter((item): item is { id: string; createdAt: string; size: number } => Boolean(item))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

const createMainWindow = (): BrowserWindow => {
  const preloadPath = path.join(appRoot, "electron", "preload.cjs");

  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });
  window.setMenuBarVisibility(false);

  const devServerUrl = "http://localhost:5173";
  if (isDev) {
    window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return window;
};

ipcMain.handle("app:get-init-state", () => {
  return { initialized: hasAdminUser(db) };
});

ipcMain.handle("auth:register-admin", (_, payload: RegisterAdminPayload) => {
  const username = normalizeInput(payload.username ?? "");
  const password = payload.password ?? "";
  const email = normalizeInput(payload.email ?? "");
  const usernameError = validateUsername(username);
  if (usernameError) {
    return { success: false, message: usernameError };
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { success: false, message: passwordError };
  }
  if (email) {
    const emailError = validateEmail(email);
    if (emailError) {
      return { success: false, message: emailError };
    }
  }
  const result = registerAdmin(db, username, password, email);
  return result;
});

ipcMain.handle("auth:send-admin-email-code", async (_, payload: EmailCodePayload) => {
  void payload;
  return { success: false, message: "管理员初始化不需要邮箱验证码" };
});

ipcMain.handle("user:list", () => {
  return listUsers(db);
});

ipcMain.handle("user:create", (_, payload: CreateUserPayload) => {
  const username = normalizeInput(payload.username ?? "");
  const password = payload.password ?? "";
  const role = normalizeInput(payload.role ?? "");
  if (!username) {
    return { success: false, message: "姓名不能为空" };
  }
  const usernameError = validateUsername(username);
  if (usernameError) {
    return { success: false, message: usernameError };
  }
  if (!role) {
    return { success: false, message: "请选择用户组" };
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { success: false, message: passwordError };
  }
  if (!payload.email) {
    return { success: false, message: "请输入邮箱" };
  }
  const emailError = validateEmail(payload.email ?? "");
  if (emailError) {
    return { success: false, message: emailError };
  }
  const phoneError = validatePhone(payload.phone ?? "");
  if (phoneError) {
    return { success: false, message: phoneError };
  }
  const result = createUser(db, {
    username,
    password,
    role,
    displayName: payload.displayName,
    phone: payload.phone,
    email: payload.email,
    avatarUrl: payload.avatarUrl,
  });
  if (!result.success) {
    return result;
  }
  if (payload.email) {
    void sendMail(
      payload.email,
      "LX-WMS 用户恢复密钥",
      `您的恢复密钥为：${result.recoveryKey}\n请妥善保存，勿泄露给他人。`,
    );
  }
  return result;
});

ipcMain.handle("user:update-profile", (_, payload: UpdateProfilePayload) => {
  if (!payload.userId) {
    return { success: false, message: "用户信息无效" };
  }
  const username = payload.displayName?.trim() || "";
  if (username) {
    const usernameError = validateUsername(username);
    if (usernameError) {
      return { success: false, message: usernameError };
    }
  }
  if (payload.phone) {
    const phoneError = validatePhone(payload.phone);
    if (phoneError) {
      return { success: false, message: phoneError };
    }
  }
  if (payload.email) {
    const emailError = validateEmail(payload.email);
    if (emailError) {
      return { success: false, message: emailError };
    }
  }
  return updateProfile(db, payload);
});

ipcMain.handle("user:update-role", (_, payload: UpdateUserRolePayload) => {
  return updateUserRole(db, payload.userId, payload.role);
});

ipcMain.handle("user:update-status", (_, payload: UpdateUserStatusPayload) => {
  return updateUserStatus(db, payload.userId, payload.status);
});

ipcMain.handle("user:reset-password", (_, payload: ResetUserPasswordPayload) => {
  const passwordError = validatePassword(payload.newPassword ?? "");
  if (passwordError) {
    return { success: false, message: passwordError };
  }
  return resetUserPassword(db, payload.userId, payload.newPassword);
});

ipcMain.handle("user:delete", (_, payload: DeleteUserPayload) => {
  if (payload.userId === "") {
    return { success: false, message: "用户信息无效" };
  }
  return removeUser(db, payload.userId);
});

ipcMain.handle("auth:login", (_, payload: AuthPayload) => {
  const username = normalizeInput(payload.username ?? "");
  const password = payload.password ?? "";
  const usernameError = validateUsername(username);
  if (usernameError) {
    return { success: false, message: usernameError };
  }
  if (!password) {
    return { success: false, message: "请输入密码" };
  }
  return login(db, username, password);
});

ipcMain.handle(
  "auth:confirm-recovery-key",
  (_, payload: RecoveryConfirmPayload) => {
    const userId = normalizeInput(payload.userId ?? "");
    const recoveryKey = normalizeRecoveryKey(payload.recoveryKey ?? "");
    if (!userId) {
      return { success: false, message: "用户信息无效" };
    }
    if (!recoveryKey) {
      return { success: false, message: "请输入恢复密钥" };
    }
    return confirmRecoveryKeyBinding(db, userId, recoveryKey);
  },
);

ipcMain.handle(
  "auth:reset-password-by-key",
  (_, payload: ResetByKeyPayload) => {
    const username = normalizeInput(payload.username ?? "");
    const recoveryKey = normalizeRecoveryKey(payload.recoveryKey ?? "");
    const newPassword = payload.newPassword ?? "";
    const usernameError = validateUsername(username);
    if (usernameError) {
      return { success: false, message: usernameError };
    }
    if (!recoveryKey) {
      return { success: false, message: "请输入恢复密钥" };
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return { success: false, message: passwordError };
    }
    return resetPasswordByRecoveryKey(db, username, recoveryKey, newPassword);
  },
);

ipcMain.handle(
  "auth:validate-recovery-key",
  (_, payload: Pick<ResetByKeyPayload, "username" | "recoveryKey">) => {
    const username = normalizeInput(payload.username ?? "");
    const recoveryKey = normalizeRecoveryKey(payload.recoveryKey ?? "");
    const usernameError = validateUsername(username);
    if (usernameError) {
      return { success: false, message: usernameError };
    }
    if (!recoveryKey) {
      return { success: false, message: "请输入恢复密钥" };
    }
    return validateRecoveryKey(db, username, recoveryKey);
  },
);

ipcMain.handle("auth:send-reset-email-code", async (_, payload: EmailCodePayload) => {
  const username = normalizeInput(payload.username ?? "");
  const email = normalizeInput(payload.email ?? "");
  const usernameError = validateUsername(username);
  if (usernameError) {
    return { success: false, message: usernameError };
  }
  const emailError = validateEmail(email);
  if (emailError) {
    return { success: false, message: emailError };
  }
  const userRow = db
    .prepare("SELECT email FROM users WHERE username = ?")
    .get(username) as { email?: string } | undefined;
  if (!userRow?.email || userRow.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return { success: false, message: "账号与邮箱不匹配" };
  }
  const intervalResult = verifyEmailCodeSendInterval(db, "password_reset", username);
  if (!intervalResult.success) {
    return intervalResult;
  }
  const code = createEmailCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  saveEmailCode(db, "password_reset", username, email, code, expiresAt);
  const sendResult = await sendMail(
    email,
    "LX-WMS 重置密码验证码",
    `您的重置密码验证码为：${code}\n有效期 10 分钟，请勿泄露给他人。`,
  );
  if (sendResult.success) {
    markEmailCodeSent(db, "password_reset", username);
    return { success: true };
  }
  return { success: false, message: sendResult.message ?? "发送失败" };
});

ipcMain.handle("auth:reset-password-by-email", (_, payload: ResetByEmailPayload) => {
  const username = normalizeInput(payload.username ?? "");
  const email = normalizeInput(payload.email ?? "");
  const emailCode = normalizeInput(payload.emailCode ?? "");
  const newPassword = payload.newPassword ?? "";
  const usernameError = validateUsername(username);
  if (usernameError) {
    return { success: false, message: usernameError };
  }
  const emailError = validateEmail(email);
  if (emailError) {
    return { success: false, message: emailError };
  }
  if (!emailCode) {
    return { success: false, message: "请输入邮箱验证码" };
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return { success: false, message: passwordError };
  }
  return resetPasswordByEmailCode(db, username, email, emailCode, newPassword);
});

ipcMain.handle(
  "auth:change-password",
  (_, payload: ChangePasswordPayload) => {
    const username = normalizeInput(payload.username ?? "");
    const oldPassword = payload.oldPassword ?? "";
    const newPassword = payload.newPassword ?? "";
    const usernameError = validateUsername(username);
    if (usernameError) {
      return { success: false, message: usernameError };
    }
    if (!oldPassword) {
      return { success: false, message: "请输入旧密码" };
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return { success: false, message: passwordError };
    }
    return changePasswordWithOldPassword(db, username, oldPassword, newPassword);
  },
);

ipcMain.handle("auth:reveal-recovery-key", (_, payload: AuthPayload) => {
  const username = normalizeInput(payload.username ?? "");
  const password = payload.password ?? "";
  const usernameError = validateUsername(username);
  if (usernameError) {
    return { success: false, message: usernameError };
  }
  if (!password) {
    return { success: false, message: "请输入密码" };
  }
  return revealRecoveryKey(db, username, password);
});

ipcMain.handle("app:get-version", () => {
  return { version: app.getVersion() };
});

ipcMain.handle("app:open-external", async (_, payload: ExternalLinkPayload) => {
  const url = normalizeInput(payload?.url ?? "");
  if (!url) {
    return { success: false, message: "链接不能为空" };
  }
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch {
    return { success: false, message: "无法打开链接" };
  }
});

ipcMain.handle("mail:get-settings", () => {
  return { success: true, settings: getMailSettingsSnapshot() };
});

ipcMain.handle("mail:get-status", () => {
  return { success: true, configured: isMailConfigured() };
});

ipcMain.handle(
  "admin:get-email-status",
  (_, payload: { userId: string; username: string }) => {
    const userId = normalizeInput(payload.userId ?? "");
    const username = normalizeInput(payload.username ?? "");
    if (!userId || !username) {
      return { success: false, message: "管理员信息不完整" };
    }
    const row = db
      .prepare("SELECT id, username, role FROM users WHERE id = ?")
      .get(userId) as { id: string; username: string; role: string } | undefined;
    if (!row || row.username !== username || row.role !== "ADMIN") {
      return { success: false, message: "管理员信息不匹配" };
    }
    const status = getAdminEmailStatus(userId);
    return {
      success: true,
      email: status.email,
      verified: status.verified,
      mailConfigured: isMailConfigured(),
    };
  },
);

ipcMain.handle("admin:send-bind-email-code", async (_, payload: AdminEmailPayload) => {
  if (!isMailConfigured()) {
    return { success: false, message: "请先完成邮件设置" };
  }
  const userId = normalizeInput(payload.userId ?? "");
  const username = normalizeInput(payload.username ?? "");
  const email = normalizeInput(payload.email ?? "");
  if (!userId || !username) {
    return { success: false, message: "管理员信息不完整" };
  }
  const row = db
    .prepare("SELECT id, username, role FROM users WHERE id = ?")
    .get(userId) as { id: string; username: string; role: string } | undefined;
  if (!row || row.username !== username || row.role !== "ADMIN") {
    return { success: false, message: "管理员信息不匹配" };
  }
  const emailError = validateEmail(email);
  if (emailError) {
    return { success: false, message: emailError };
  }
  const intervalResult = verifyEmailCodeSendInterval(db, "admin_email_bind", username);
  if (!intervalResult.success) {
    return intervalResult;
  }
  const code = createEmailCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  saveEmailCode(db, "admin_email_bind", username, email, code, expiresAt);
  const sendResult = await sendMail(
    email,
    "LX-WMS 管理员邮箱验证码",
    `您的管理员邮箱验证码为：${code}\n有效期 10 分钟，请勿泄露给他人。`,
  );
  if (sendResult.success) {
    markEmailCodeSent(db, "admin_email_bind", username);
    return { success: true };
  }
  return { success: false, message: sendResult.message ?? "发送失败" };
});

ipcMain.handle("admin:bind-email", (_, payload: AdminEmailVerifyPayload) => {
  if (!isMailConfigured()) {
    return { success: false, message: "请先完成邮件设置" };
  }
  const userId = normalizeInput(payload.userId ?? "");
  const username = normalizeInput(payload.username ?? "");
  const email = normalizeInput(payload.email ?? "");
  const emailCode = normalizeInput(payload.emailCode ?? "");
  if (!userId || !username) {
    return { success: false, message: "管理员信息不完整" };
  }
  const row = db
    .prepare("SELECT id, username, role FROM users WHERE id = ?")
    .get(userId) as { id: string; username: string; role: string } | undefined;
  if (!row || row.username !== username || row.role !== "ADMIN") {
    return { success: false, message: "管理员信息不匹配" };
  }
  const emailError = validateEmail(email);
  if (emailError) {
    return { success: false, message: emailError };
  }
  if (!emailCode) {
    return { success: false, message: "请输入邮箱验证码" };
  }
  const verifyResult = verifyEmailCode(
    db,
    "admin_email_bind",
    username,
    email,
    emailCode,
  );
  if (!verifyResult.success) {
    return verifyResult;
  }
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET email = ?, updated_at = ? WHERE id = ?").run(
    email.trim(),
    now,
    userId,
  );
  writeAppSetting("admin_email_verified", email.trim().toLowerCase());
  return { success: true, message: "管理员邮箱已验证" };
});

ipcMain.handle("mail:save-settings", (_, payload) => {
  const result = validateMailSettings(payload ?? {});
  if (!result.ok) {
    return { success: false, message: result.message };
  }
  writeAppSetting("smtp_user", result.settings.user);
  writeAppSetting("smtp_pass", result.settings.pass);
  writeAppSetting("smtp_host", result.settings.host);
  writeAppSetting("smtp_port", String(result.settings.port));
  writeAppSetting("smtp_secure", result.settings.secure ? "true" : "false");
  return { success: true, message: "邮件设置已保存" };
});

ipcMain.handle("mail:test", async (_, payload) => {
  const to = normalizeInput(payload?.to ?? "");
  const emailError = validateEmail(to);
  if (emailError) {
    return { success: false, message: emailError };
  }
  const result = await sendMail(
    to,
    "LX-WMS 测试邮件",
    "这是一封来自 LX-WMS 的测试邮件。",
  );
  if (result.success) {
    return { success: true, message: "测试邮件已发送" };
  }
  return result;
});

ipcMain.handle("update:check", async () => {
  try {
    const result = await checkForUpdates();
    if (!result?.updateInfo) {
      return { available: false };
    }
    const info = result.updateInfo;
    return {
      available: true,
      version: info.version,
      releaseName: info.releaseName,
      releaseNotes: info.releaseNotes,
    };
  } catch {
    return { available: false };
  }
});

ipcMain.handle("update:download", async () => {
  try {
    const result = await checkForUpdates();
    if (!result?.updateInfo) {
      return { success: false, message: "暂无可用更新" };
    }
    const updater = (await import("electron-updater")).default.autoUpdater;
    updater.autoDownload = true;
    await updater.downloadUpdate();
    return { success: true, message: "已开始下载更新" };
  } catch {
    return { success: false, message: "更新失败" };
  }
});

ipcMain.handle("update:install", async () => {
  try {
    const updater = (await import("electron-updater")).default.autoUpdater;
    updater.quitAndInstall();
    return { success: true, message: "正在重启安装" };
  } catch {
    return { success: false, message: "安装失败" };
  }
});

ipcMain.handle("backup:list", () => {
  return { success: true, items: listBackupFiles() };
});

ipcMain.handle("backup:create", (_, payload: BackupCreatePayload) => {
  try {
    ensureBackupDir();
    const createdAt = new Date().toISOString();
    const dbBase64 = fs.readFileSync(databasePath).toString("base64");
    const content = JSON.stringify(
      { version: 1, createdAt, localStorage: payload.localStorage, database: dbBase64 },
      null,
      2,
    );
    const fileName = `backup-${createdAt.replace(/[:.]/g, "-")}.json`;
    const fullPath = path.join(backupDir, fileName);
    fs.writeFileSync(fullPath, content, "utf-8");
    return { success: true, item: { id: fileName, createdAt, size: content.length } };
  } catch {
    return { success: false, message: "备份失败" };
  }
});

ipcMain.handle("backup:read", (_, payload: BackupReadPayload) => {
  try {
    const fullPath = path.join(backupDir, payload.id);
    const raw = fs.readFileSync(fullPath, "utf-8");
    const parsed = JSON.parse(raw) as {
      version: number;
      createdAt: string;
      localStorage: Record<string, string>;
      database?: string;
    };
    return { success: true, backup: parsed };
  } catch {
    return { success: false, message: "读取备份失败" };
  }
});

ipcMain.handle("backup:delete", (_, payload: BackupReadPayload) => {
  try {
    const fullPath = path.join(backupDir, payload.id);
    fs.unlinkSync(fullPath);
    return { success: true };
  } catch {
    return { success: false, message: "删除失败" };
  }
});

ipcMain.handle("backup:export", async (_, payload: BackupReadPayload) => {
  try {
    const fullPath = path.join(backupDir, payload.id);
    const result = await dialog.showSaveDialog({
      title: "保存备份文件",
      defaultPath: payload.id,
      filters: [{ name: "备份文件", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) {
      return { success: false, message: "已取消保存" };
    }
    fs.copyFileSync(fullPath, result.filePath);
    return { success: true };
  } catch {
    return { success: false, message: "保存失败" };
  }
});

ipcMain.handle("backup:restore-db", (_, payload: BackupRestorePayload) => {
  try {
    if (!payload.database) {
      return { success: false, message: "备份数据不完整" };
    }
    const buffer = Buffer.from(payload.database, "base64");
    fs.writeFileSync(databasePath, buffer);
    app.relaunch();
    app.exit(0);
    return { success: true };
  } catch {
    return { success: false, message: "恢复失败" };
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  mainWindow = createMainWindow();
  setupAutoUpdater(mainWindow);
  if (!isDev) {
    checkForUpdates();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});
