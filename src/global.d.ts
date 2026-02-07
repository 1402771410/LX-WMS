import type { InitState, UserInfo } from "./types/runtime";

export type AuthPayload = {
  username: string;
  password: string;
};

export type RegisterAdminPayload = {
  username: string;
  password: string;
  email: string;
  emailCode: string;
};

export type AuthResult =
  | { success: true; user: UserInfo }
  | { success: false; message: string };

export type RegisterAdminResult =
  | { success: true; user: UserInfo; recoveryKey: string }
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

export type ApiBridge = {
  getInitState: () => Promise<InitState>;
  getAppVersion: () => Promise<{ version: string }>;
  registerAdmin: (payload: RegisterAdminPayload) => Promise<RegisterAdminResult>;
  sendAdminEmailCode: (payload: EmailCodePayload) => Promise<ActionResult>;
  login: (payload: AuthPayload) => Promise<AuthResult>;
  confirmRecoveryKey: (payload: RecoveryConfirmPayload) => Promise<ActionResult>;
  validateRecoveryKey: (
    payload: Pick<ResetByKeyPayload, "username" | "recoveryKey">,
  ) => Promise<ActionResult>;
  resetPasswordByKey: (payload: ResetByKeyPayload) => Promise<ActionResult>;
  sendResetEmailCode: (payload: EmailCodePayload) => Promise<ActionResult>;
  resetPasswordByEmail: (payload: ResetByEmailPayload) => Promise<ActionResult>;
  changePassword: (payload: ChangePasswordPayload) => Promise<ActionResult>;
  revealRecoveryKey: (payload: AuthPayload) => Promise<RecoveryKeyResult>;
  listUsers: () => Promise<{ success: boolean; users?: unknown; message?: string }>;
  createUser: (payload: CreateUserPayload) => Promise<{ success: boolean; user?: unknown; recoveryKey?: string; message?: string }>;
  updateUserRole: (payload: UpdateUserRolePayload) => Promise<ActionResult>;
  updateUserStatus: (payload: UpdateUserStatusPayload) => Promise<ActionResult>;
  resetUserPassword: (payload: ResetUserPasswordPayload) => Promise<ActionResult>;
  deleteUser: (payload: DeleteUserPayload) => Promise<ActionResult>;
  checkForUpdates: () => Promise<{
    available: boolean;
    version?: string;
    releaseName?: string;
    releaseNotes?: string | string[];
  }>;
  downloadUpdate: () => Promise<ActionResult>;
  listBackups: () => Promise<{ success: boolean; items?: unknown; message?: string }>;
  createBackup: (payload: BackupCreatePayload) => Promise<{ success: boolean; item?: unknown; message?: string }>;
  readBackup: (payload: BackupReadPayload) => Promise<{ success: boolean; backup?: unknown; message?: string }>;
  deleteBackup: (payload: BackupReadPayload) => Promise<ActionResult>;
  exportBackup: (payload: BackupReadPayload) => Promise<ActionResult>;
  restoreDatabase: (payload: BackupRestorePayload) => Promise<ActionResult>;
};

declare global {
  interface Window {
    api: ApiBridge;
  }
}
