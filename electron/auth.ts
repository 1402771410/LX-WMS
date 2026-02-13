import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import os from "node:os";
import type { DatabaseInstance } from "./db.js";

export type UserRecord = {
  id: string;
  username: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  displayName?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  userCode?: string;
  recoveryBoundAt?: string;
};

export type AuthResult =
  | { success: true; user: UserRecord }
  | { success: false; message: string };

export type RegisterAdminResult =
  | { success: true; user: UserRecord; recoveryKey: string }
  | { success: false; message: string };

export type ActionResult =
  | { success: true; message?: string }
  | { success: false; message: string };

export type RecoveryKeyResult =
  | { success: true; recoveryKey: string }
  | { success: false; message: string };

export type ListUsersResult =
  | { success: true; users: UserRecord[] }
  | { success: false; message: string };

export type CreateUserPayload = {
  username: string;
  password: string;
  role: string;
  displayName?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
};

export type CreateUserResult =
  | { success: true; user: UserRecord; recoveryKey: string }
  | { success: false; message: string };

export type EmailCodePurpose = "admin_register" | "password_reset" | "admin_email_bind";

export type EmailCodeRecord = {
  code: string;
  email: string;
  expiresAt: string;
};

type EmailSendRecord = {
  sentAt: string;
};

const EMAIL_CODE_SEND_INTERVAL_SECONDS = 120;

const createPasswordHash = (
  password: string,
  salt?: string,
): { hash: string; salt: string } => {
  const usedSalt = salt ?? randomUUID().replace(/-/g, "");
  const hashBuffer = scryptSync(password, usedSalt, 64);
  return { hash: hashBuffer.toString("hex"), salt: usedSalt };
};

const isPasswordMatch = (
  password: string,
  salt: string,
  storedHash: string,
): boolean => {
  const { hash } = createPasswordHash(password, salt);
  const hashBuffer = Buffer.from(hash, "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");
  if (hashBuffer.length !== storedBuffer.length) {
    return false;
  }
  return timingSafeEqual(hashBuffer, storedBuffer);
};

const createRecoveryKey = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    const part = bytes.subarray(i, i + 4);
    const group = Array.from(part)
      .map((value) => chars[value % chars.length])
      .join("");
    chunks.push(group);
  }
  return `RK-${chunks.join("-")}`;
};

const formatUserCode = (value: number): string =>
  `U-${String(value).padStart(4, "0")}`;

const getNextUserCode = (db: DatabaseInstance): string => {
  const rows = db
    .prepare("SELECT user_code as userCode FROM users WHERE user_code IS NOT NULL")
    .all() as { userCode?: string }[];
  const maxValue = rows.reduce((max, row) => {
    const match = row.userCode?.match(/^U-(\d+)$/);
    const num = match ? Number(match[1]) : 0;
    return Number.isFinite(num) && num > max ? num : max;
  }, 0);
  return formatUserCode(maxValue + 1);
};

const getRecoveryKeySecret = (db: DatabaseInstance): string => {
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get("recovery_key_secret") as { value: string } | undefined;
  if (row?.value) {
    return row.value;
  }
  const secret = randomBytes(32).toString("base64");
  db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run(
    "recovery_key_secret",
    secret,
  );
  return secret;
};

const readAppSetting = (db: DatabaseInstance, key: string): string | null => {
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
};

const writeAppSetting = (
  db: DatabaseInstance,
  key: string,
  value: string,
): void => {
  db.prepare(
    `
      INSERT INTO app_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
  ).run(key, value);
};

const removeAppSetting = (db: DatabaseInstance, key: string): void => {
  db.prepare("DELETE FROM app_settings WHERE key = ?").run(key);
};

const getEmailCodeKey = (purpose: EmailCodePurpose, username: string): string =>
  `email_code:${purpose}:${username}`;

const getEmailSendRecordKey = (purpose: EmailCodePurpose, username: string): string =>
  `email_code_send:${purpose}:${username}`;

export const createEmailCode = (): string =>
  String(100000 + Math.floor(Math.random() * 900000));

export const saveEmailCode = (
  db: DatabaseInstance,
  purpose: EmailCodePurpose,
  username: string,
  email: string,
  code: string,
  expiresAt: string,
): void => {
  const key = getEmailCodeKey(purpose, username);
  const record: EmailCodeRecord = {
    code,
    email: email.trim().toLowerCase(),
    expiresAt,
  };
  writeAppSetting(db, key, JSON.stringify(record));
};

export const verifyEmailCode = (
  db: DatabaseInstance,
  purpose: EmailCodePurpose,
  username: string,
  email: string,
  code: string,
): ActionResult => {
  const key = getEmailCodeKey(purpose, username);
  const raw = readAppSetting(db, key);
  if (!raw) {
    return { success: false, message: "验证码已失效，请重新获取" };
  }
  try {
    const record = JSON.parse(raw) as EmailCodeRecord;
    const now = Date.now();
    const expiresAt = Date.parse(record.expiresAt);
    if (!Number.isFinite(expiresAt) || now > expiresAt) {
      removeAppSetting(db, key);
      return { success: false, message: "验证码已过期，请重新获取" };
    }
    if (record.email !== email.trim().toLowerCase()) {
      return { success: false, message: "邮箱与验证码不匹配" };
    }
    if (record.code !== code.trim()) {
      return { success: false, message: "验证码不正确" };
    }
    removeAppSetting(db, key);
    return { success: true };
  } catch {
    removeAppSetting(db, key);
    return { success: false, message: "验证码已失效，请重新获取" };
  }
};

export const verifyEmailCodeSendInterval = (
  db: DatabaseInstance,
  purpose: EmailCodePurpose,
  username: string,
): ActionResult => {
  const key = getEmailSendRecordKey(purpose, username);
  const raw = readAppSetting(db, key);
  if (!raw) {
    return { success: true };
  }
  try {
    const record = JSON.parse(raw) as EmailSendRecord;
    const lastSentAt = Date.parse(record.sentAt);
    if (!Number.isFinite(lastSentAt)) {
      removeAppSetting(db, key);
      return { success: true };
    }
    const now = Date.now();
    const elapsed = now - lastSentAt;
    const intervalMs = EMAIL_CODE_SEND_INTERVAL_SECONDS * 1000;
    if (elapsed >= intervalMs) {
      return { success: true };
    }
    const remainingSeconds = Math.ceil((intervalMs - elapsed) / 1000);
    return {
      success: false,
      message: `发送过于频繁，请${remainingSeconds}秒后再试`,
    };
  } catch {
    removeAppSetting(db, key);
    return { success: true };
  }
};

export const markEmailCodeSent = (
  db: DatabaseInstance,
  purpose: EmailCodePurpose,
  username: string,
  sentAt: string = new Date().toISOString(),
): void => {
  const key = getEmailSendRecordKey(purpose, username);
  const record: EmailSendRecord = { sentAt };
  writeAppSetting(db, key, JSON.stringify(record));
};

const encryptRecoveryKey = (
  recoveryKey: string,
  secret: string,
): { cipherText: string; iv: string; tag: string } => {
  const key = Buffer.from(secret, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(recoveryKey, "utf8"),
    cipher.final(),
  ]);
  return {
    cipherText: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
};

const decryptRecoveryKey = (
  cipherText: string,
  iv: string,
  tag: string,
  secret: string,
): string => {
  const key = Buffer.from(secret, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
};

const getDeviceFingerprint = (): string => {
  const networkMap = os.networkInterfaces();
  const macs = Object.values(networkMap)
    .flat()
    .filter((item) => item && !item.internal && item.mac)
    .map((item) => item?.mac ?? "")
    .filter((mac) => mac && mac !== "00:00:00:00:00:00")
    .sort();
  const seed = [os.hostname(), ...macs].join("|");
  return createHash("sha256").update(seed).digest("hex");
};

export const hasAdminUser = (db: DatabaseInstance): boolean => {
  const row = db
    .prepare(
      "SELECT COUNT(1) as count FROM users WHERE role = ? AND status = ?",
    )
    .get("ADMIN", "ACTIVE") as { count: number };
  return row.count > 0;
};

export const registerAdmin = (
  db: DatabaseInstance,
  username: string,
  password: string,
  email: string,
): RegisterAdminResult => {
  if (hasAdminUser(db)) {
    return { success: false, message: "系统已初始化，无法再次注册管理员" };
  }
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username) as { id: string } | undefined;
  if (existing) {
    return { success: false, message: "用户名已存在" };
  }
  const now = new Date().toISOString();
  const userId = randomUUID();
  const { hash, salt } = createPasswordHash(password);
  const userCode = getNextUserCode(db);
  db.prepare(
    `
      INSERT INTO users (id, username, password_hash, password_salt, role, status, created_at, updated_at, user_code, display_name, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    userId,
    username,
    hash,
    salt,
    "ADMIN",
    "ACTIVE",
    now,
    now,
    userCode,
    username,
    email.trim(),
  );
  const recoveryKey = createRecoveryKey();
  const secret = getRecoveryKeySecret(db);
  const encrypted = encryptRecoveryKey(recoveryKey, secret);
  db.prepare(
    `
      UPDATE users
      SET recovery_key_cipher = ?, recovery_key_iv = ?, recovery_key_tag = ?, updated_at = ?
      WHERE id = ?
    `,
  ).run(
    encrypted.cipherText,
    encrypted.iv,
    encrypted.tag,
    now,
    userId,
  );
  return {
    success: true,
    user: {
      id: userId,
      username,
      role: "ADMIN",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      displayName: username,
      userCode,
      email: email.trim(),
    },
    recoveryKey,
  };
};

export const login = (
  db: DatabaseInstance,
  username: string,
  password: string,
): AuthResult => {
  const row = db
    .prepare(
      `
        SELECT id, username, password_hash as passwordHash, password_salt as passwordSalt, role, status, created_at as createdAt, updated_at as updatedAt,
          display_name as displayName, phone, email, avatar_url as avatarUrl, user_code as userCode, recovery_key_bound_at as recoveryBoundAt
        FROM users
        WHERE username = ?
      `,
    )
    .get(username) as
    | {
        id: string;
        username: string;
        passwordHash: string;
        passwordSalt: string;
        role: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        displayName?: string;
        phone?: string;
        email?: string;
        avatarUrl?: string;
        userCode?: string;
        recoveryBoundAt?: string;
      }
    | undefined;
  if (!row) {
    return { success: false, message: "用户名或密码错误" };
  }
  if (row.status !== "ACTIVE") {
    return { success: false, message: "账户已被禁用，请联系管理员" };
  }
  if (!isPasswordMatch(password, row.passwordSalt, row.passwordHash)) {
    return { success: false, message: "用户名或密码错误" };
  }
  return {
    success: true,
    user: {
      id: row.id,
      username: row.username,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      displayName: row.displayName ?? undefined,
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
      userCode: row.userCode ?? undefined,
      recoveryBoundAt: row.recoveryBoundAt ?? undefined,
    },
  };
};

export const listUsers = (db: DatabaseInstance): ListUsersResult => {
  try {
    const rows = db
      .prepare(
        `
          SELECT id, username, role, status, created_at as createdAt, updated_at as updatedAt,
            display_name as displayName, phone, email, avatar_url as avatarUrl, user_code as userCode, recovery_key_bound_at as recoveryBoundAt
          FROM users
          ORDER BY created_at DESC
        `,
      )
      .all() as UserRecord[];
    return { success: true, users: rows };
  } catch {
    return { success: false, message: "读取用户失败" };
  }
};

export const createUser = (
  db: DatabaseInstance,
  payload: CreateUserPayload,
): CreateUserResult => {
  const username = payload.username.trim();
  if (!username) {
    return { success: false, message: "姓名不能为空" };
  }
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username) as { id: string } | undefined;
  if (existing) {
    return { success: false, message: "用户已存在" };
  }
  const { hash, salt } = createPasswordHash(payload.password);
  const now = new Date().toISOString();
  const userId = randomUUID();
  const userCode = getNextUserCode(db);
  const recoveryKey = createRecoveryKey();
  const secret = getRecoveryKeySecret(db);
  const encrypted = encryptRecoveryKey(recoveryKey, secret);
  db.prepare(
    `
      INSERT INTO users (id, username, password_hash, password_salt, role, status, created_at, updated_at, display_name, phone, email, avatar_url, user_code,
        recovery_key_cipher, recovery_key_iv, recovery_key_tag, recovery_key_bound_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    userId,
    username,
    hash,
    salt,
    payload.role,
    "ACTIVE",
    now,
    now,
    payload.displayName?.trim() || username,
    payload.phone?.trim() || null,
    payload.email?.trim() || null,
    payload.avatarUrl || null,
    userCode,
    encrypted.cipherText,
    encrypted.iv,
    encrypted.tag,
    now,
  );
  return {
    success: true,
    user: {
      id: userId,
      username,
      role: payload.role,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      displayName: payload.displayName?.trim() || username,
      phone: payload.phone?.trim() || undefined,
      email: payload.email?.trim() || undefined,
      avatarUrl: payload.avatarUrl || undefined,
      userCode,
      recoveryBoundAt: now,
    },
    recoveryKey,
  };
};

export const validateRecoveryKey = (
  db: DatabaseInstance,
  username: string,
  recoveryKey: string,
): ActionResult => {
  const row = db
    .prepare(
      `
        SELECT recovery_key_cipher as cipher, recovery_key_iv as iv, recovery_key_tag as tag
        FROM users
        WHERE username = ?
      `,
    )
    .get(username) as
    | { cipher: string; iv: string; tag: string }
    | undefined;
  if (!row?.cipher || !row.iv || !row.tag) {
    return { success: false, message: "恢复密钥不存在或未绑定" };
  }
  const secret = getRecoveryKeySecret(db);
  const storedKey = decryptRecoveryKey(row.cipher, row.iv, row.tag, secret);
  if (storedKey !== recoveryKey) {
    return { success: false, message: "恢复密钥不正确" };
  }
  return { success: true };
};

export const updateUserRole = (
  db: DatabaseInstance,
  userId: string,
  role: string,
): ActionResult => {
  const row = db
    .prepare("SELECT role FROM users WHERE id = ?")
    .get(userId) as { role?: string } | undefined;
  if (!row) {
    return { success: false, message: "用户不存在" };
  }
  if (row.role === "ADMIN") {
    return { success: false, message: "管理员账号不可修改用户组" };
  }
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").run(
    role,
    now,
    userId,
  );
  return { success: true, message: "用户组已更新" };
};

export const updateUserStatus = (
  db: DatabaseInstance,
  userId: string,
  status: string,
): ActionResult => {
  const row = db
    .prepare("SELECT role FROM users WHERE id = ?")
    .get(userId) as { role?: string } | undefined;
  if (!row) {
    return { success: false, message: "用户不存在" };
  }
  if (row.role === "ADMIN") {
    return { success: false, message: "管理员账号状态不可修改" };
  }
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?").run(
    status,
    now,
    userId,
  );
  return { success: true, message: "状态已更新" };
};

export const resetUserPassword = (
  db: DatabaseInstance,
  userId: string,
  newPassword: string,
): ActionResult => {
  const { hash, salt } = createPasswordHash(newPassword);
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?",
  ).run(hash, salt, now, userId);
  return { success: true, message: "密码已更新" };
};

export const resetPasswordByEmailCode = (
  db: DatabaseInstance,
  username: string,
  email: string,
  code: string,
  newPassword: string,
): ActionResult => {
  const row = db
    .prepare(
      `
        SELECT id, status, email
        FROM users
        WHERE username = ?
      `,
    )
    .get(username) as
    | { id: string; status: string; email?: string }
    | undefined;
  if (!row || row.status !== "ACTIVE") {
    return { success: false, message: "账号不存在或已停用" };
  }
  if (!row.email || row.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return { success: false, message: "账号与邮箱不匹配" };
  }
  const verifyResult = verifyEmailCode(
    db,
    "password_reset",
    username,
    email,
    code,
  );
  if (!verifyResult.success) {
    return verifyResult;
  }
  const { hash, salt } = createPasswordHash(newPassword);
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?",
  ).run(hash, salt, now, row.id);
  return { success: true, message: "密码已更新" };
};

export const removeUser = (
  db: DatabaseInstance,
  userId: string,
): ActionResult => {
  const row = db
    .prepare("SELECT role FROM users WHERE id = ?")
    .get(userId) as { role?: string } | undefined;
  if (!row) {
    return { success: false, message: "用户不存在" };
  }
  if (row.role === "ADMIN") {
    return { success: false, message: "管理员账号不可删除" };
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  return { success: true, message: "用户已删除" };
};

export const confirmRecoveryKeyBinding = (
  db: DatabaseInstance,
  userId: string,
  recoveryKey: string,
): ActionResult => {
  const row = db
    .prepare(
      `
        SELECT recovery_key_cipher as cipher, recovery_key_iv as iv, recovery_key_tag as tag
        FROM users
        WHERE id = ?
      `,
    )
    .get(userId) as
    | { cipher: string; iv: string; tag: string }
    | undefined;
  if (!row?.cipher || !row.iv || !row.tag) {
    return { success: false, message: "未找到恢复密钥记录" };
  }
  const secret = getRecoveryKeySecret(db);
  const storedKey = decryptRecoveryKey(row.cipher, row.iv, row.tag, secret);
  if (storedKey !== recoveryKey) {
    return { success: false, message: "恢复密钥校验失败" };
  }
  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE users
      SET device_fingerprint = ?, recovery_key_bound_at = ?, updated_at = ?
      WHERE id = ?
    `,
  ).run(getDeviceFingerprint(), now, now, userId);
  return { success: true };
};

export const resetPasswordByRecoveryKey = (
  db: DatabaseInstance,
  username: string,
  recoveryKey: string,
  newPassword: string,
): ActionResult => {
  const row = db
    .prepare(
      `
        SELECT id, status, recovery_key_cipher as cipher, recovery_key_iv as iv, recovery_key_tag as tag,
               device_fingerprint as fingerprint, recovery_key_bound_at as boundAt
        FROM users
        WHERE username = ?
      `,
    )
    .get(username) as
    | {
        id: string;
        status: string;
        cipher: string | null;
        iv: string | null;
        tag: string | null;
        fingerprint: string | null;
        boundAt: string | null;
      }
    | undefined;
  if (!row || row.status !== "ACTIVE") {
    return { success: false, message: "用户名或恢复密钥错误" };
  }
  if (!row.cipher || !row.iv || !row.tag) {
    return { success: false, message: "未生成恢复密钥，请联系管理员" };
  }
  const secret = getRecoveryKeySecret(db);
  const storedKey = decryptRecoveryKey(row.cipher, row.iv, row.tag, secret);
  if (storedKey !== recoveryKey) {
    return { success: false, message: "用户名或恢复密钥错误" };
  }
  const now = new Date().toISOString();
  const currentFingerprint = getDeviceFingerprint();
  const shouldRebind = row.fingerprint !== currentFingerprint;
  const { hash, salt } = createPasswordHash(newPassword);
  db.prepare(
    `
      UPDATE users
      SET password_hash = ?, password_salt = ?, device_fingerprint = ?, recovery_key_bound_at = ?, updated_at = ?
      WHERE id = ?
    `,
  ).run(
    hash,
    salt,
    currentFingerprint,
    shouldRebind ? now : row.boundAt ?? now,
    now,
    row.id,
  );
  return {
    success: true,
    message: shouldRebind ? "已在新设备绑定恢复密钥" : undefined,
  };
};

export const changePasswordWithOldPassword = (
  db: DatabaseInstance,
  username: string,
  oldPassword: string,
  newPassword: string,
): ActionResult => {
  const row = db
    .prepare(
      `
        SELECT id, status, password_hash as passwordHash, password_salt as passwordSalt
        FROM users
        WHERE username = ?
      `,
    )
    .get(username) as
    | {
        id: string;
        status: string;
        passwordHash: string;
        passwordSalt: string;
      }
    | undefined;
  if (!row || row.status !== "ACTIVE") {
    return { success: false, message: "用户名或密码错误" };
  }
  if (!isPasswordMatch(oldPassword, row.passwordSalt, row.passwordHash)) {
    return { success: false, message: "用户名或密码错误" };
  }
  const now = new Date().toISOString();
  const { hash, salt } = createPasswordHash(newPassword);
  db.prepare(
    `
      UPDATE users
      SET password_hash = ?, password_salt = ?, updated_at = ?
      WHERE id = ?
    `,
  ).run(hash, salt, now, row.id);
  return { success: true };
};

export const revealRecoveryKey = (
  db: DatabaseInstance,
  username: string,
  password: string,
): RecoveryKeyResult => {
  const row = db
    .prepare(
      `
        SELECT status, password_hash as passwordHash, password_salt as passwordSalt,
               recovery_key_cipher as cipher, recovery_key_iv as iv, recovery_key_tag as tag
        FROM users
        WHERE username = ?
      `,
    )
    .get(username) as
    | {
        status: string;
        passwordHash: string;
        passwordSalt: string;
        cipher: string | null;
        iv: string | null;
        tag: string | null;
      }
    | undefined;
  if (!row || row.status !== "ACTIVE") {
    return { success: false, message: "用户名或密码错误" };
  }
  if (!isPasswordMatch(password, row.passwordSalt, row.passwordHash)) {
    return { success: false, message: "用户名或密码错误" };
  }
  if (!row.cipher || !row.iv || !row.tag) {
    return { success: false, message: "未生成恢复密钥，请联系管理员" };
  }
  const secret = getRecoveryKeySecret(db);
  return {
    success: true,
    recoveryKey: decryptRecoveryKey(row.cipher, row.iv, row.tag, secret),
  };
};

export type UpdateProfilePayload = {
  userId: string;
  displayName?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
};

export const updateProfile = (
  db: DatabaseInstance,
  payload: UpdateProfilePayload,
): ActionResult => {
  const { userId, displayName, phone, email, avatarUrl } = payload;
  const row = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(userId) as { id: string } | undefined;
  if (!row) {
    return { success: false, message: "用户不存在" };
  }
  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE users
      SET display_name = ?, phone = ?, email = ?, avatar_url = ?, updated_at = ?
      WHERE id = ?
    `,
  ).run(
    displayName?.trim() || null,
    phone?.trim() || null,
    email?.trim() || null,
    avatarUrl || null,
    now,
    userId,
  );
  return { success: true, message: "个人资料已更新" };
};

