import { contextBridge, ipcRenderer } from "electron";

export type InitState = {
  initialized: boolean;
};

export type AuthPayload = {
  username: string;
  password: string;
};

export type RegisterAdminPayload = {
  username: string;
  password: string;
  email?: string;
  emailCode?: string;
};

export type AuthResult =
  | { success: true; user: { id: string; username: string; role: string } }
  | { success: false; message: string };

export type RegisterAdminResult =
  | {
      success: true;
      user: { id: string; username: string; role: string };
      recoveryKey: string;
    }
  | { success: false; message: string };

export type ActionResult =
  | { success: true; message?: string }
  | { success: false; message: string };

export type RecoveryKeyResult =
  | { success: true; recoveryKey: string }
  | { success: false; message: string };

export type RecoveryConfirmPayload = {
  userId: string;
  recoveryKey: string;
};

export type ResetByKeyPayload = {
  username: string;
  recoveryKey: string;
  newPassword: string;
};

export type ResetByEmailPayload = {
  username: string;
  email: string;
  emailCode: string;
  newPassword: string;
};

export type EmailCodePayload = {
  username: string;
  email: string;
};

export type ExternalLinkPayload = {
  url: string;
};

export type AdminEmailPayload = {
  userId: string;
  username: string;
  email: string;
};

export type AdminEmailVerifyPayload = {
  userId: string;
  username: string;
  email: string;
  emailCode: string;
};

export type ChangePasswordPayload = {
  username: string;
  oldPassword: string;
  newPassword: string;
};

export type CreateUserPayload = {
  username: string;
  password: string;
  role: string;
  displayName?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
};

export type UpdateUserRolePayload = {
  userId: string;
  role: string;
};

export type UpdateUserStatusPayload = {
  userId: string;
  status: string;
};

export type ResetUserPasswordPayload = {
  userId: string;
  newPassword: string;
};

export type DeleteUserPayload = {
  userId: string;
};

export type BackupCreatePayload = {
  localStorage: Record<string, string>;
};

export type BackupReadPayload = {
  id: string;
};

export type BackupRestorePayload = {
  database?: string;
};

export type MailSettingsPayload = {
  user: string;
  pass: string;
  host: string;
  port: number;
  secure: boolean;
};

const api = {
  getInitState: (): Promise<InitState> =>
    ipcRenderer.invoke("app:get-init-state"),
  getAppVersion: (): Promise<{ version: string }> =>
    ipcRenderer.invoke("app:get-version"),
  openExternal: (payload: ExternalLinkPayload): Promise<ActionResult> =>
    ipcRenderer.invoke("app:open-external", payload),
  registerAdmin: (payload: RegisterAdminPayload): Promise<RegisterAdminResult> =>
    ipcRenderer.invoke("auth:register-admin", payload),
  sendAdminEmailCode: (payload: EmailCodePayload): Promise<ActionResult> =>
    ipcRenderer.invoke("auth:send-admin-email-code", payload),
  getAdminEmailStatus: (payload: { userId: string; username: string }): Promise<{
    success: boolean;
    email?: string;
    verified?: boolean;
    mailConfigured?: boolean;
    message?: string;
  }> => ipcRenderer.invoke("admin:get-email-status", payload),
  sendAdminBindEmailCode: (payload: AdminEmailPayload): Promise<ActionResult> =>
    ipcRenderer.invoke("admin:send-bind-email-code", payload),
  bindAdminEmail: (payload: AdminEmailVerifyPayload): Promise<ActionResult> =>
    ipcRenderer.invoke("admin:bind-email", payload),
  login: (payload: AuthPayload): Promise<AuthResult> =>
    ipcRenderer.invoke("auth:login", payload),
  confirmRecoveryKey: (payload: RecoveryConfirmPayload): Promise<ActionResult> =>
    ipcRenderer.invoke("auth:confirm-recovery-key", payload),
  validateRecoveryKey: (
    payload: Pick<ResetByKeyPayload, "username" | "recoveryKey">,
  ): Promise<ActionResult> =>
    ipcRenderer.invoke("auth:validate-recovery-key", payload),
  resetPasswordByKey: (payload: ResetByKeyPayload): Promise<ActionResult> =>
    ipcRenderer.invoke("auth:reset-password-by-key", payload),
  sendResetEmailCode: (payload: EmailCodePayload): Promise<ActionResult> =>
    ipcRenderer.invoke("auth:send-reset-email-code", payload),
  resetPasswordByEmail: (payload: ResetByEmailPayload): Promise<ActionResult> =>
    ipcRenderer.invoke("auth:reset-password-by-email", payload),
  changePassword: (payload: ChangePasswordPayload): Promise<ActionResult> =>
    ipcRenderer.invoke("auth:change-password", payload),
  revealRecoveryKey: (payload: AuthPayload): Promise<RecoveryKeyResult> =>
    ipcRenderer.invoke("auth:reveal-recovery-key", payload),
  listUsers: (): Promise<{ success: boolean; users?: unknown; message?: string }> =>
    ipcRenderer.invoke("user:list"),
  createUser: (payload: CreateUserPayload): Promise<{ success: boolean; user?: unknown; recoveryKey?: string; message?: string }> =>
    ipcRenderer.invoke("user:create", payload),
  updateUserRole: (payload: UpdateUserRolePayload): Promise<ActionResult> =>
    ipcRenderer.invoke("user:update-role", payload),
  updateUserStatus: (payload: UpdateUserStatusPayload): Promise<ActionResult> =>
    ipcRenderer.invoke("user:update-status", payload),
  resetUserPassword: (payload: ResetUserPasswordPayload): Promise<ActionResult> =>
    ipcRenderer.invoke("user:reset-password", payload),
  deleteUser: (payload: DeleteUserPayload): Promise<ActionResult> =>
    ipcRenderer.invoke("user:delete", payload),
  checkForUpdates: (): Promise<{
    available: boolean;
    version?: string;
    releaseName?: string;
    releaseNotes?: string | string[];
  }> => ipcRenderer.invoke("update:check"),
  downloadUpdate: (): Promise<ActionResult> =>
    ipcRenderer.invoke("update:download"),
  listBackups: (): Promise<{ success: boolean; items?: unknown; message?: string }> =>
    ipcRenderer.invoke("backup:list"),
  createBackup: (payload: BackupCreatePayload): Promise<{ success: boolean; item?: unknown; message?: string }> =>
    ipcRenderer.invoke("backup:create", payload),
  readBackup: (payload: BackupReadPayload): Promise<{ success: boolean; backup?: unknown; message?: string }> =>
    ipcRenderer.invoke("backup:read", payload),
  deleteBackup: (payload: BackupReadPayload): Promise<ActionResult> =>
    ipcRenderer.invoke("backup:delete", payload),
  exportBackup: (payload: BackupReadPayload): Promise<ActionResult> =>
    ipcRenderer.invoke("backup:export", payload),
  restoreDatabase: (payload: BackupRestorePayload): Promise<ActionResult> =>
    ipcRenderer.invoke("backup:restore-db", payload),
  getMailSettings: (): Promise<{ success: boolean; settings?: MailSettingsPayload; message?: string }> =>
    ipcRenderer.invoke("mail:get-settings"),
  getMailStatus: (): Promise<{ success: boolean; configured?: boolean; message?: string }> =>
    ipcRenderer.invoke("mail:get-status"),
  saveMailSettings: (payload: MailSettingsPayload): Promise<ActionResult> =>
    ipcRenderer.invoke("mail:save-settings", payload),
  testMail: (payload: { to: string }): Promise<ActionResult> =>
    ipcRenderer.invoke("mail:test", payload),
};

contextBridge.exposeInMainWorld("api", api);
